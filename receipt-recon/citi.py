"""Parser for Citi (Costco Anywhere Visa Business) statement PDFs.

Citi groups transactions per cardholder. The card last-4 is in a header line
in the CARDHOLDER SUMMARY block, e.g. ``ANDREW P MACLURG Card ending in 6146``.
The actual transaction sections, after ``BUSINESS ACCOUNT SUMMARY``, are
delimited by bare-name separator lines like ``ANDREW P MACLURG`` /
``DAVID UMANZIO``.

Transaction rows come in two shapes::

    03/16 03/17 UBER *TRIP HELP.UBER.COMCA $17.99
    03/29 ENDEL SUBSCRIPTION BERLIN DE $19.99

(One date or two; the amount is always last and always has a ``$`` prefix.
Credits/refunds are written as ``-$760.17``.)
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from pathlib import Path

import pdfplumber

from bofa import Charge


_CARDHOLDER_HDR_RE = re.compile(r"^([A-Z][A-Z .']+?)\s+Card ending in\s+(\d{4})\s*$")
_CARDHOLDER_NAME_RE = re.compile(r"^([A-Z][A-Z .']+[A-Z])\s*$")
_CARD_ANY_RE = re.compile(r"Card ending in\s+(\d{4})")
_ACCOUNT_NUMBER_RE = re.compile(r"Account number ending in[:\s]+(\d{4})", re.I)

# Two-date variant: txn date, post date, description, amount.
_TXN_TWO_DATES_RE = re.compile(
    r"""^\s*
    (?P<txn>\d{2}/\d{2})\s+
    (?P<post>\d{2}/\d{2})\s+
    (?P<desc>.+?)\s+
    -?\$(?P<amount>[\d,]+\.\d{2})\s*$
    """,
    re.VERBOSE,
)

# One-date variant (Citi sometimes drops the post date).
_TXN_ONE_DATE_RE = re.compile(
    r"""^\s*
    (?P<txn>\d{2}/\d{2})\s+
    (?P<desc>.+?)\s+
    -?\$(?P<amount>[\d,]+\.\d{2})\s*$
    """,
    re.VERBOSE,
)

_NEG_RE = re.compile(r"-\$[\d,]+\.\d{2}\s*$")

_PERIOD_RE = re.compile(
    r"Billing Period:\s*\d{2}/\d{2}/\d{2}\s*-\s*\d{2}/\d{2}/(\d{2})"
)
_END_MONTH_RE = re.compile(
    r"Billing Period:\s*\d{2}/\d{2}/\d{2}\s*-\s*(\d{2})/\d{2}/\d{2}"
)

_SKIP_LINE_FRAGMENTS = (
    "INTEREST CHARGED",
    "TOTAL FEES",
    "TOTAL INTEREST",
    "Card ending in",
    "CARDHOLDER SUMMARY",
    "BUSINESS ACCOUNT SUMMARY",
    "PHONE NUMBER:",
    "FOLIO NUMBER:",
    "ARRIVE:",
)

# Marker that real transactions are about to start.
_TXN_SECTION_START = "BUSINESS ACCOUNT SUMMARY"


def _statement_year(text: str) -> int:
    m = _PERIOD_RE.search(text)
    if not m:
        raise ValueError("Could not find Citi billing period")
    return 2000 + int(m.group(1))


def _statement_end_month(text: str) -> int:
    m = _END_MONTH_RE.search(text)
    if not m:
        raise ValueError("Could not find Citi closing month")
    return int(m.group(1))


def _make_date(month_day: str, statement_year: int, statement_end_month: int) -> date:
    month = int(month_day[:2])
    day = int(month_day[3:])
    year = statement_year
    if month > statement_end_month:
        year = statement_year - 1
    return date(year, month, day)


def _build_name_to_card(all_text: str) -> dict[str, str]:
    """Map cardholder name → card last-4.

    Newer statements have clean ``<NAME> Card ending in NNNN`` lines we can
    match directly. Older statements interleave columns so the primary's
    "Card ending in 6146" gets mangled — for those we fall back to the
    account-level ``Account number ending in: NNNN`` for the primary name and
    pair any remaining ``Card ending in`` mentions with subsequent names in
    document order.
    """
    mapping: dict[str, str] = {}

    # 1) Direct hits: "<NAME> Card ending in NNNN" on a single line.
    for line in all_text.split("\n"):
        m = _CARDHOLDER_HDR_RE.match(line.strip())
        if m:
            mapping[m.group(1).strip()] = m.group(2)

    # 2) Carve out the cardholder summary block (between CARDHOLDER SUMMARY
    # and BUSINESS ACCOUNT SUMMARY) and order-pair any remaining names with
    # any unconsumed "Card ending in" mentions.
    block_match = re.search(
        r"CARDHOLDER SUMMARY(?P<body>.*?)BUSINESS ACCOUNT SUMMARY",
        all_text,
        flags=re.DOTALL,
    )
    if block_match:
        body = block_match.group("body")
        names_in_order: list[str] = []
        for ln in body.split("\n"):
            stripped = ln.strip()
            nm = _CARDHOLDER_NAME_RE.match(stripped)
            if nm and nm.group(1) not in names_in_order:
                names_in_order.append(nm.group(1))

        cards_in_order = _CARD_ANY_RE.findall(body)

        # Drop names already mapped (newer statements): we only need to
        # assign cards to the leftovers.
        leftovers = [n for n in names_in_order if n not in mapping]

        # Primary cardholder gets the account's own last-4 (always there).
        acct = _ACCOUNT_NUMBER_RE.search(all_text)
        if leftovers and acct:
            primary_card = acct.group(1)
            mapping[leftovers[0]] = primary_card
            leftovers = leftovers[1:]
            # Don't double-assign that card to a secondary cardholder.
            cards_in_order = [c for c in cards_in_order if c != primary_card]

        for name, card in zip(leftovers, cards_in_order):
            mapping[name] = card

    return mapping


def parse_pdf(path: str | Path) -> list[Charge]:
    path = Path(path)
    charges: list[Charge] = []

    with pdfplumber.open(path) as pdf:
        head = pdf.pages[0].extract_text() or ""
        year = _statement_year(head)
        end_month = _statement_end_month(head)

        all_text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        name_to_card = _build_name_to_card(all_text)

        # Default card = the account number on page 1 (the primary cardholder).
        # Payments/credits at the top of the transaction section come before
        # any per-name marker and belong to the primary account.
        acct = _ACCOUNT_NUMBER_RE.search(all_text)
        default_card = acct.group(1) if acct else (
            next(iter(name_to_card.values())) if len(name_to_card) == 1 else ""
        )

        in_txn_section = False
        current_card = default_card

        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw in text.split("\n"):
                line = raw.rstrip()
                stripped = line.strip()

                if _TXN_SECTION_START in stripped:
                    in_txn_section = True
                    continue

                if not in_txn_section:
                    continue

                if stripped in name_to_card:
                    current_card = name_to_card[stripped]
                    continue

                if any(frag in line for frag in _SKIP_LINE_FRAGMENTS):
                    continue

                if "$" not in line:
                    continue
                if not current_card:
                    continue

                negative = bool(_NEG_RE.search(line))
                m = _TXN_TWO_DATES_RE.match(line) or _TXN_ONE_DATE_RE.match(line)
                if not m:
                    continue

                amount = Decimal(m.group("amount").replace(",", ""))
                if negative:
                    amount = -amount

                txn_date = _make_date(m.group("txn"), year, end_month)
                post_date = (
                    _make_date(m.group("post"), year, end_month)
                    if "post" in m.groupdict() and m.group("post")
                    else txn_date
                )
                charges.append(
                    Charge(
                        issuer="Citi",
                        last_4=current_card,
                        txn_date=txn_date,
                        post_date=post_date,
                        description=m.group("desc").strip(),
                        amount=amount,
                        reference="",
                        source_file=str(path),
                    )
                )
    return charges

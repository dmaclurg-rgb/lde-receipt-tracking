"""Parser for Bank of America credit card statement PDFs.

Transactions look like::

    03/04 03/06 ARCO #42466 AMPM INDIO CA 3684 5868 17.81

That is: ``<txn MM/DD> <post MM/DD> <description...> <ref4> <last4> <amount>``.
Amounts may be negative and may contain commas. Sections are introduced by
``Payments and Other Credits`` and ``Purchases and Adjustments`` headings; the
sign on each amount already encodes credit vs. debit, so we don't rely on the
section header for sign.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pdfplumber


@dataclass(frozen=True)
class Charge:
    issuer: str
    last_4: str
    txn_date: date
    post_date: date
    description: str
    amount: Decimal
    reference: str
    source_file: str

    @property
    def is_credit(self) -> bool:
        return self.amount < Decimal("0")


_TXN_RE = re.compile(
    r"""^\s*
    (?P<txn>\d{2}/\d{2})\s+
    (?P<post>\d{2}/\d{2})\s+
    (?P<desc>.+?)\s+
    (?P<ref>\d{4})\s+
    (?P<last4>\d{4})\s+
    (?P<amount>-?[\d,]+\.\d{2})\s*$
    """,
    re.VERBOSE,
)

# "March 6 - April 5, 2026" — capture the year immediately after the date.
_PERIOD_RE = re.compile(
    r"[A-Za-z]+\s+\d+\s*-\s*[A-Za-z]+\s+\d+\s*,\s*(20\d{2})"
)
# Fallback: "Statement Closing Date 04/05/2026"
_CLOSING_RE = re.compile(r"Statement Closing Date\s+\d{2}/\d{2}/(20\d{2})")


def _statement_year(text: str) -> int:
    m = _PERIOD_RE.search(text) or _CLOSING_RE.search(text)
    if not m:
        raise ValueError("Could not find statement year in BofA PDF")
    return int(m.group(1))


def _make_date(month_day: str, statement_year: int, statement_end_month: int | None) -> date:
    """Resolve MM/DD into a full date.

    Statements span a year boundary (Dec → Jan). If the statement ends in
    January and we see a December txn, that txn is in the prior year. We use
    the statement_end_month hint when available; otherwise default to the
    statement_year.
    """
    month = int(month_day[:2])
    day = int(month_day[3:])
    year = statement_year
    if statement_end_month is not None and month > statement_end_month:
        year = statement_year - 1
    return date(year, month, day)


def parse_pdf(path: str | Path) -> list[Charge]:
    path = Path(path)
    charges: list[Charge] = []

    with pdfplumber.open(path) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""
        year = _statement_year(first_page_text)

        # Try to detect statement end month, e.g. "March 6 - April 5, 2026".
        end_month = None
        m = re.search(
            r"-\s*([A-Za-z]+)\s+\d+\s*,\s*20\d{2}", first_page_text
        )
        if m:
            try:
                end_month = datetime.strptime(m.group(1)[:3], "%b").month
            except ValueError:
                pass

        # Locate the account number (last 4) for the issuer-level metadata.
        # BofA prints "Account# 4078 9000 4861 5868" — we use the last group.
        acct_match = re.search(r"Account#?\s*(?:\d{4}\s*){3}(\d{4})", first_page_text)
        last_4_hint = acct_match.group(1) if acct_match else ""

        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.split("\n"):
                m = _TXN_RE.match(raw_line)
                if not m:
                    continue
                amount = Decimal(m.group("amount").replace(",", ""))
                txn_date = _make_date(m.group("txn"), year, end_month)
                post_date = _make_date(m.group("post"), year, end_month)
                charges.append(
                    Charge(
                        issuer="BofA",
                        last_4=m.group("last4") or last_4_hint,
                        txn_date=txn_date,
                        post_date=post_date,
                        description=m.group("desc").strip(),
                        amount=amount,
                        reference=m.group("ref"),
                        source_file=str(path),
                    )
                )
    return charges

"""Parser for Home Depot Pro ``Purchase History`` CSV exports."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Iterable

import houses


@dataclass(frozen=True)
class HDRow:
    txn_date: date
    receipt_added_date: date | None
    order_origin: str
    purchaser: str
    transaction_id: str
    register_number: str
    job_name: str
    house: str | None
    pre_tax_amount: Decimal
    total_amount: Decimal
    order_number: str
    cards: tuple[str, ...]
    invoice_number: str
    source_file: str
    raw: dict = field(repr=False)

    @property
    def is_refund(self) -> bool:
        return self.total_amount < 0


def _parse_date(s: str) -> date | None:
    s = s.strip()
    if not s:
        return None
    return datetime.strptime(s, "%Y-%m-%d").date()


def _parse_money(s: str) -> Decimal:
    if s is None:
        return Decimal("0")
    s = s.strip().replace("$", "").replace(",", "")
    if not s:
        return Decimal("0")
    return Decimal(s)


def _parse_cards(s: str) -> tuple[str, ...]:
    """Extract last-4 digits from the ``Card/Account Nickname`` column.

    Format examples: ``X-7990``, ``X-7990, X-XXXX``, empty.
    """
    if not s:
        return ()
    out: list[str] = []
    for piece in s.split(","):
        piece = piece.strip()
        if not piece or piece.upper() in {"X-XXXX", "XXXX"}:
            continue
        if "-" in piece:
            piece = piece.split("-", 1)[1]
        if piece.isdigit():
            out.append(piece)
    return tuple(out)


def parse_csv(path: str | Path) -> list[HDRow]:
    path = Path(path)
    rows: list[HDRow] = []
    with path.open(newline="") as f:
        # The export has 6 lines of preamble before the actual header row.
        # Skip until we find a line starting with "Date,".
        lines = f.readlines()

    header_idx = next(
        (i for i, ln in enumerate(lines) if ln.startswith("Date,Receipt Added Date,")),
        None,
    )
    if header_idx is None:
        raise ValueError(f"{path}: could not find HD CSV header row")

    reader = csv.DictReader(lines[header_idx:])
    for raw in reader:
        if not raw.get("Date"):
            continue
        txn_date = _parse_date(raw["Date"])
        if txn_date is None:
            continue
        job_name = (raw.get("Job Name") or "").strip()
        rows.append(
            HDRow(
                txn_date=txn_date,
                receipt_added_date=_parse_date(raw.get("Receipt Added Date") or ""),
                order_origin=(raw.get("Order Origin") or "").strip(),
                purchaser=(raw.get("Purchaser/Buyer Name-ID") or "").strip(),
                transaction_id=(raw.get("Transaction ID") or "").strip(),
                register_number=(raw.get("Register Number") or "").strip(),
                job_name=job_name,
                house=houses.resolve(job_name),
                pre_tax_amount=_parse_money(raw.get("Pre-tax Amount") or ""),
                total_amount=_parse_money(raw.get("Total Amount Paid") or ""),
                order_number=(raw.get("Order Number") or "").strip(),
                cards=_parse_cards(raw.get("Payment") or raw.get("Card/Account Nickname") or ""),
                invoice_number=(raw.get("Invoice Number") or "").strip(),
                source_file=str(path),
                raw=dict(raw),
            )
        )
    return rows


def group_by_card_and_date(rows: Iterable[HDRow]) -> dict[tuple[str, date], list[HDRow]]:
    """Group HD rows by (card last-4, date) for sum-matching against statements.

    A row with multiple cards (split tender) appears in each card's bucket.
    """
    out: dict[tuple[str, date], list[HDRow]] = {}
    for r in rows:
        for card in r.cards or ("",):
            out.setdefault((card, r.txn_date), []).append(r)
    return out

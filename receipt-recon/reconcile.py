"""CLI: reconcile credit-card statements against Home Depot purchase exports.

Usage::

    python reconcile.py STATEMENT [STATEMENT ...] HD_CSV [HD_CSV ...] \\
        [--out reports/]

Each statement is auto-detected as BofA or Citi based on its first-page text.
HD CSVs are detected by header. The tool prints a summary to stdout and writes
four CSVs to ``--out`` (default ``reports/``):

    matched.csv             — charge ↔ receipt(s) ↔ house
    missing_receipts.csv    — charges with no matching HD row (alert mgmt)
    unmatched_receipts.csv  — HD rows with no matching charge
    owner_billing.csv       — per-house totals (owner statement input)
    overhead.csv            — shared business expenses, tracked separately
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import bofa
import citi
import home_depot
import houses
import match


def _sniff(path: Path) -> str:
    """Return ``'bofa' | 'citi' | 'hd' | 'unknown'`` based on file content."""
    if path.suffix.lower() == ".csv":
        with path.open() as f:
            head = f.read(2048)
        if "Home Depot" in head or "Purchase Tracking" in head or "Job Name" in head:
            return "hd"
        return "unknown"
    if path.suffix.lower() == ".pdf":
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            head = pdf.pages[0].extract_text() or ""
        if "Bank of America" in head or "bankofamerica.com" in head:
            return "bofa"
        if "Citi" in head or "citicards.com" in head:
            return "citi"
    return "unknown"


def _money(d: Decimal) -> str:
    sign = "-" if d < 0 else ""
    return f"{sign}${abs(d):,.2f}"


def _write_matched(rows: list[match.Match], path: Path) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "charge_date", "charge_amount", "card_last4", "issuer", "description",
            "house", "needs_review", "is_split", "receipt_count",
            "receipt_invoices", "receipt_job_names", "statement_file",
        ])
        for m in rows:
            w.writerow([
                m.charge.txn_date.isoformat(),
                str(m.charge.amount),
                m.charge.last_4,
                m.charge.issuer,
                m.charge.description,
                "" if m.house is None else (
                    "OVERHEAD" if m.house == houses.OVERHEAD else m.house
                ),
                "yes" if m.needs_review else "",
                "yes" if m.is_split else "",
                len(m.receipts),
                "; ".join(r.invoice_number or r.transaction_id for r in m.receipts),
                "; ".join(r.job_name for r in m.receipts),
                m.charge.source_file,
            ])


def _write_missing(rows: list[match.UnmatchedCharge], path: Path) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "charge_date", "charge_amount", "card_last4", "issuer",
            "description", "reason", "statement_file",
        ])
        for u in rows:
            w.writerow([
                u.charge.txn_date.isoformat(),
                str(u.charge.amount),
                u.charge.last_4,
                u.charge.issuer,
                u.charge.description,
                u.reason,
                u.charge.source_file,
            ])


def _write_orphans(rows: list[match.OrphanReceipt], path: Path) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "txn_date", "amount", "cards", "house", "job_name",
            "invoice_number", "transaction_id", "reason", "source_file",
        ])
        for o in rows:
            w.writerow([
                o.row.txn_date.isoformat(),
                str(o.row.total_amount),
                ",".join(o.row.cards),
                "" if o.row.house is None else (
                    "OVERHEAD" if o.row.house == houses.OVERHEAD else o.row.house
                ),
                o.row.job_name,
                o.row.invoice_number,
                o.row.transaction_id,
                o.reason,
                o.row.source_file,
            ])


def _write_owner_billing(matches: list[match.Match], path: Path, overhead_path: Path) -> None:
    by_house: dict[str, list[match.Match]] = defaultdict(list)
    for m in matches:
        if m.house is None:
            continue
        by_house[m.house].append(m)

    with path.open("w", newline="") as ob, overhead_path.open("w", newline="") as oh:
        ow = csv.writer(ob)
        ow.writerow([
            "house", "charge_date", "charge_amount", "card_last4",
            "issuer", "description", "receipt_invoices", "statement_file",
        ])
        hw = csv.writer(oh)
        hw.writerow([
            "charge_date", "charge_amount", "card_last4", "issuer",
            "description", "job_name", "receipt_invoices", "statement_file",
        ])
        for house_name, items in sorted(by_house.items()):
            for m in items:
                row = [
                    m.charge.txn_date.isoformat(),
                    str(m.charge.amount),
                    m.charge.last_4,
                    m.charge.issuer,
                    m.charge.description,
                    "; ".join(r.invoice_number or r.transaction_id for r in m.receipts),
                    m.charge.source_file,
                ]
                if house_name == houses.OVERHEAD:
                    hw.writerow([
                        m.charge.txn_date.isoformat(),
                        str(m.charge.amount),
                        m.charge.last_4,
                        m.charge.issuer,
                        m.charge.description,
                        "; ".join(r.job_name for r in m.receipts),
                        "; ".join(r.invoice_number or r.transaction_id for r in m.receipts),
                        m.charge.source_file,
                    ])
                else:
                    ow.writerow([house_name] + row)


def _print_summary(
    statements: dict[str, int],
    hd_rows: int,
    matches: list[match.Match],
    unmatched: list[match.UnmatchedCharge],
    orphans: list[match.OrphanReceipt],
) -> None:
    print()
    print("=" * 72)
    print("RECONCILIATION SUMMARY")
    print("=" * 72)
    for src, n in statements.items():
        print(f"  {src:<10}  {n:>4} charges")
    print(f"  {'HD CSV':<10}  {hd_rows:>4} receipt rows")
    print()

    by_house: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    review_count = 0
    overhead_total = Decimal("0")
    for m in matches:
        if m.needs_review:
            review_count += 1
        if m.house == houses.OVERHEAD:
            overhead_total += m.charge.amount
        elif m.house is not None:
            by_house[m.house] += m.charge.amount

    print(f"MATCHED             {len(matches):>4} HD charges  "
          f"({sum((m.charge.amount for m in matches), Decimal('0')):>12} total)")
    print(f"  needs review      {review_count:>4}")
    print(f"  overhead          {overhead_total:>12}")
    print()
    print("PER-HOUSE TOTALS (owner billing)")
    for house_name, total in sorted(by_house.items(), key=lambda kv: -kv[1]):
        print(f"  {house_name:<35} {_money(total):>14}")
    print()

    missing_hd = [u for u in unmatched if "no HD receipt" in u.reason or "none sum" in u.reason]
    non_hd = [u for u in unmatched if "non-Home-Depot" in u.reason]
    print(f"MISSING HD RECEIPTS  {len(missing_hd):>4}  (alert management)")
    for u in missing_hd:
        print(f"  {u.charge.txn_date}  X-{u.charge.last_4}  "
              f"{_money(u.charge.amount):>12}  {u.charge.description[:40]}")
    print()
    print(f"NON-HD CHARGES       {len(non_hd):>4}  (need Slack receipts)")
    print(f"ORPHAN HD RECEIPTS   {len(orphans):>4}  (refunds / pending posts)")


def main() -> int:
    p = argparse.ArgumentParser(description="Reconcile card statements against HD receipts")
    p.add_argument("inputs", nargs="+", type=Path, help="PDF statements and HD CSV exports")
    p.add_argument("--out", type=Path, default=Path("reports"))
    args = p.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    statements_summary: dict[str, int] = {"BofA": 0, "Citi": 0}
    all_charges: list[bofa.Charge] = []
    all_hd: list[home_depot.HDRow] = []

    for path in args.inputs:
        kind = _sniff(path)
        if kind == "bofa":
            ch = bofa.parse_pdf(path)
            all_charges.extend(ch)
            statements_summary["BofA"] += len(ch)
            print(f"[BofA]   {path.name}: {len(ch)} charges", file=sys.stderr)
        elif kind == "citi":
            ch = citi.parse_pdf(path)
            all_charges.extend(ch)
            statements_summary["Citi"] += len(ch)
            print(f"[Citi]   {path.name}: {len(ch)} charges", file=sys.stderr)
        elif kind == "hd":
            rows = home_depot.parse_csv(path)
            all_hd.extend(rows)
            print(f"[HD]     {path.name}: {len(rows)} rows", file=sys.stderr)
        else:
            print(f"[skip]   {path.name}: unknown format", file=sys.stderr)

    matches, unmatched, orphans = match.reconcile(all_charges, all_hd)

    _write_matched(matches, args.out / "matched.csv")
    _write_missing(unmatched, args.out / "missing_receipts.csv")
    _write_orphans(orphans, args.out / "unmatched_receipts.csv")
    _write_owner_billing(
        matches, args.out / "owner_billing.csv", args.out / "overhead.csv"
    )

    _print_summary(statements_summary, len(all_hd), matches, unmatched, orphans)
    print()
    print(f"Reports written to {args.out}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

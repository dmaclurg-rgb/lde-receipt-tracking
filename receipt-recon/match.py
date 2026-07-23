"""Three-way matching engine: card-statement charge ↔ HD CSV row(s) ↔ house.

For each Home Depot charge on a card statement we look for one or more HD CSV
rows with the same card last-4 and a transaction date within a tolerance
window, whose ``Total Amount Paid`` either equals the charge directly or sums
to it across line-itemized rows.

Non-Home-Depot charges are returned as ``UnmatchedCharge`` records so the
dashboard can solicit a Slack-uploaded receipt for each. HD CSV rows that
never matched a statement charge are returned as ``OrphanReceipt`` records
(usually pending posts or refunds awaiting credit).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from itertools import combinations

from bofa import Charge
from home_depot import HDRow


# Match window: HD posts can lag the card by a few days.
DATE_TOLERANCE_DAYS = 4
# Two amounts that round-trip through cents are considered equal.
AMOUNT_TOLERANCE = Decimal("0.02")

_HD_DESC_RE = re.compile(r"home\s*depot|homedepot", re.I)


def is_home_depot(charge: Charge) -> bool:
    return bool(_HD_DESC_RE.search(charge.description))


@dataclass(frozen=True)
class Match:
    charge: Charge
    receipts: tuple[HDRow, ...]
    house: str | None  # canonical name, OVERHEAD sentinel, or None for review

    @property
    def is_split(self) -> bool:
        return len(self.receipts) > 1

    @property
    def needs_review(self) -> bool:
        return self.house is None or any(r.house != self.receipts[0].house for r in self.receipts)


@dataclass(frozen=True)
class UnmatchedCharge:
    """An HD charge with no matching HD CSV row (missing receipt) OR a
    non-HD charge that has no Slack receipt yet."""
    charge: Charge
    reason: str


@dataclass(frozen=True)
class OrphanReceipt:
    """An HD CSV row that didn't match any statement charge."""
    row: HDRow
    reason: str


def _amounts_equal(a: Decimal, b: Decimal) -> bool:
    return abs(a - b) <= AMOUNT_TOLERANCE


def _candidate_rows(
    charge: Charge,
    hd_rows: list[HDRow],
    used: set[int],
) -> list[HDRow]:
    """HD rows on the same card within the date tolerance, excluding any
    already consumed by a previous match."""
    out: list[HDRow] = []
    for i, r in enumerate(hd_rows):
        if i in used:
            continue
        if charge.last_4 not in r.cards:
            continue
        if abs((r.txn_date - charge.txn_date).days) > DATE_TOLERANCE_DAYS:
            continue
        out.append(r)
    return out


def _find_subset(
    rows: list[HDRow], target: Decimal, max_size: int = 6
) -> list[HDRow] | None:
    """Find any subset of ``rows`` whose ``total_amount`` sums to ``target``.

    Returns the smallest such subset (preferring single-row matches), or None.
    Bounded by ``max_size`` to keep this from exploding on big days.
    """
    for size in range(1, min(max_size, len(rows)) + 1):
        for combo in combinations(rows, size):
            total = sum((r.total_amount for r in combo), Decimal("0"))
            if _amounts_equal(total, target):
                return list(combo)
    return None


def _consensus_house(rows: list[HDRow]) -> str | None:
    """Consensus canonical house across a set of receipts.

    If they all agree, return that house. If they disagree, return None
    (matcher routes to review queue). Empty/None job names abstain from
    voting; they only block consensus if every row is empty.
    """
    voted = [r.house for r in rows if r.house]
    if not voted:
        return None
    if all(h == voted[0] for h in voted):
        return voted[0]
    return None


def reconcile(
    charges: list[Charge],
    hd_rows: list[HDRow],
) -> tuple[list[Match], list[UnmatchedCharge], list[OrphanReceipt]]:
    matches: list[Match] = []
    unmatched: list[UnmatchedCharge] = []
    used: set[int] = set()
    row_index = {id(r): i for i, r in enumerate(hd_rows)}

    # Sort charges by date so the earliest claim wins on contested rows.
    for charge in sorted(charges, key=lambda c: c.txn_date):
        if not is_home_depot(charge):
            unmatched.append(
                UnmatchedCharge(
                    charge=charge,
                    reason="non-Home-Depot vendor; needs Slack receipt",
                )
            )
            continue

        candidates = _candidate_rows(charge, hd_rows, used)
        if not candidates:
            unmatched.append(
                UnmatchedCharge(
                    charge=charge,
                    reason=(
                        f"no HD receipt on card X-{charge.last_4} "
                        f"within ±{DATE_TOLERANCE_DAYS}d of {charge.txn_date}"
                    ),
                )
            )
            continue

        # 1) Try a single-row exact match (most common, most confident).
        single = next(
            (r for r in candidates if _amounts_equal(r.total_amount, charge.amount)),
            None,
        )
        chosen: list[HDRow]
        if single:
            chosen = [single]
        else:
            # 2) Itemized: sum of multiple same-day same-card rows.
            subset = _find_subset(candidates, charge.amount)
            if subset is None:
                unmatched.append(
                    UnmatchedCharge(
                        charge=charge,
                        reason=(
                            f"HD receipts exist on X-{charge.last_4} near "
                            f"{charge.txn_date} but none sum to ${charge.amount}"
                        ),
                    )
                )
                continue
            chosen = subset

        for r in chosen:
            used.add(row_index[id(r)])

        matches.append(
            Match(
                charge=charge,
                receipts=tuple(chosen),
                house=_consensus_house(chosen),
            )
        )

    orphans: list[OrphanReceipt] = []
    for i, r in enumerate(hd_rows):
        if i in used:
            continue
        reason = (
            "refund/void awaiting card credit" if r.is_refund
            else "no matching card statement charge"
        )
        orphans.append(OrphanReceipt(row=r, reason=reason))

    return matches, unmatched, orphans

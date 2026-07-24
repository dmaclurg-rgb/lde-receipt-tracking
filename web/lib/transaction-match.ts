import { prisma } from "@/lib/prisma";
import type { Transaction } from "@prisma/client";

const MATCH_WINDOW_DAYS = 10;

/**
 * Looks for an existing card-statement Transaction with the exact same
 * amount within +/- 10 days of a receipt's captured date — used to
 * auto-link an auto-ingested receipt (email/Slack) to the real charge it
 * came from, rather than leaving it as a standalone needs-review item.
 * Exact-amount matching is deliberately strict (no fuzzy tolerance): a
 * wrong auto-link would misfile an owner-billable charge, which is worse
 * than a receipt sitting unmatched for a human to attach manually.
 *
 * When more than one transaction shares the amount/date window, prefers one
 * with no receipt linked yet; an itemized split can legitimately have more
 * than one, so an already-linked transaction isn't excluded outright.
 */
export async function findMatchingTransaction(
  amountCents: number,
  aroundDate: Date
): Promise<Transaction | null> {
  const windowMs = MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const candidates = await prisma.transaction.findMany({
    where: {
      amountCents,
      txnDate: {
        gte: new Date(aroundDate.getTime() - windowMs),
        lte: new Date(aroundDate.getTime() + windowMs),
      },
    },
    include: { receipts: true },
  });
  if (candidates.length === 0) return null;

  const unlinked = candidates.filter((t) => t.receipts.length === 0);
  const pool = unlinked.length > 0 ? unlinked : candidates;
  pool.sort(
    (a, b) =>
      Math.abs(a.txnDate.getTime() - aroundDate.getTime()) -
      Math.abs(b.txnDate.getTime() - aroundDate.getTime())
  );
  return pool[0];
}

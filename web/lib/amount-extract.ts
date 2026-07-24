const DOLLAR_AMOUNT_RE = /\$\s?([\d,]+\.\d{2})/g;

function toCents(dollarString: string): number {
  return Math.round(parseFloat(dollarString.replace(/,/g, "")) * 100);
}

/**
 * Best-effort dollar-amount extraction from vendor email/Slack text, for
 * matching an auto-ingested receipt to the credit-card charge it came from
 * (see lib/transaction-match.ts). Deliberately conservative — a wrong amount
 * would auto-link the wrong charge, which is worse than leaving the receipt
 * in the needs-review queue, so this only returns a value when it's
 * confident:
 *   1. A line mentioning "total" with exactly one dollar figure on it, or
 *   2. Exactly one dollar figure anywhere in the whole text.
 * Multiple ambiguous amounts with no "total" line returns null rather than
 * guessing (e.g. an order confirmation listing per-item prices plus a
 * subtotal, tax, and total — those cases fall through to the vendor-history
 * suggestion path instead).
 */
export function extractAmountCents(text: string): number | null {
  // "(?<!sub)total" excludes "Subtotal" while matching "Total"/"Grand
  // Total"/"Order Total" — receipts list subtotal before the real total, so
  // take the LAST qualifying line, not the first.
  const totalLineRe = /(?<!sub)total/i;
  let lastTotalMatch: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!totalLineRe.test(line)) continue;
    const matches = [...line.matchAll(DOLLAR_AMOUNT_RE)];
    if (matches.length === 1) lastTotalMatch = matches[0][1];
  }
  if (lastTotalMatch) return toCents(lastTotalMatch);

  const all = [...text.matchAll(DOLLAR_AMOUNT_RE)].map((m) => m[1]);
  const unique = [...new Set(all)];
  if (unique.length === 1) return toCents(unique[0]);

  return null;
}

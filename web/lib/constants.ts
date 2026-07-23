import type { Category, PaymentMethod } from "@prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank Transfer",
  zelle: "Zelle",
  wire: "Wire",
  bofa_card: "Bank of America Card",
  citi_card: "Citi Card",
  home_depot_card: "Home Depot Card",
};

export const PAYMENT_METHODS = Object.keys(
  PAYMENT_METHOD_LABELS
) as PaymentMethod[];

export const CATEGORY_LABELS: Record<Category, string> = {
  overhead: "Company Overhead",
  property: "Owner Property",
};

export const OVERHEAD_OPTION_VALUE = "__OVERHEAD__";

/**
 * Best-effort keyword detection for free-text sources (Slack captions) that
 * don't go through the Add Receipt form's required dropdown. Returns null
 * when nothing matches — left for human follow-up rather than guessed.
 */
export function detectPaymentMethodFromText(text: string): PaymentMethod | null {
  const t = text.toLowerCase();
  if (t.includes("zelle")) return "zelle";
  if (t.includes("wire")) return "wire";
  if (t.includes("home depot") || t.includes("hd card")) return "home_depot_card";
  if (t.includes("citi")) return "citi_card";
  if (t.includes("bofa") || t.includes("bank of america")) return "bofa_card";
  if (t.includes("bank transfer") || t.includes("ach")) return "bank_transfer";
  return null;
}

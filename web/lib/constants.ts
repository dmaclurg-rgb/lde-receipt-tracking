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

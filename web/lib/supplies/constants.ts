import type { SupplyOrderStatus, SupplyVendor } from "@prisma/client";

export const VENDOR_LABELS: Record<SupplyVendor, string> = {
  amazon: "Amazon",
  instacart: "Instacart",
  costco: "Costco",
  home_depot: "Home Depot",
  specialty: "Specialty / Owner-Preferred",
  pool_supply: "Local Pool Supply",
  other: "Other",
};

// Order the "order sheet" sections should render in — matches the policy's
// vendor priority (Amazon/Instacart first, specialty/pool last).
export const VENDOR_ORDER: SupplyVendor[] = [
  "amazon",
  "instacart",
  "costco",
  "home_depot",
  "specialty",
  "pool_supply",
  "other",
];

// Single-emoji placeholder shown in place of a real product photo — the
// source spreadsheet's "Link to Photos" column pointed at local filenames,
// not embedded images, so the catalog ships without real thumbnails until
// someone pastes an image URL in via /supplies/catalog.
export const VENDOR_ICONS: Record<SupplyVendor, string> = {
  amazon: "📦",
  instacart: "🛒",
  costco: "🏬",
  home_depot: "🧰",
  specialty: "✨",
  pool_supply: "🏊",
  other: "🔗",
};

export const STATUS_LABELS: Record<SupplyOrderStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  delivered: "Delivered",
};

// Sizes offered for linen items (sheets, duvet covers/inserts, pillowcases).
// SupplyItem.sizeOptions is stored per-item as JSON so this isn't the only
// possible set, but it's what the catalog seed uses today.
export const DEFAULT_SIZE_OPTIONS = ["Twin XL", "Queen", "King", "Cal King"];

// Used by the catalog admin page to default the vendor field when someone
// pastes a product URL instead of picking a vendor manually.
export function detectVendorFromUrl(url: string | null | undefined): SupplyVendor {
  if (!url) return "other";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host.includes("amazon.")) return "amazon";
  if (host.includes("instacart.")) return "instacart";
  if (host.includes("costco.")) return "costco";
  if (host.includes("homedepot.") || host.includes("lowes.")) return "home_depot";
  return "other";
}

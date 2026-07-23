"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/supplies", label: "Order Supplies" },
  { href: "/supplies/orders", label: "Track Orders" },
  { href: "/supplies/catalog", label: "Catalog" },
];

export default function SuppliesNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-4 border-b border-neutral-200 text-sm font-medium dark:border-neutral-800">
      {TABS.map((tab) => {
        const active =
          tab.href === "/supplies" ? pathname === "/supplies" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-1 py-2 transition-colors ${
              active
                ? "border-brand-gold text-neutral-900 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

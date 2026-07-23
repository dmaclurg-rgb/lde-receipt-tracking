import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const [needsReview, receiptCount, transactionCount] = await Promise.all([
    prisma.transaction.count({ where: { needsReview: true } }),
    prisma.receipt.count(),
    prisma.transaction.count(),
  ]);

  const cards = [
    { label: "Charges needing review", value: needsReview, href: "/review" },
    { label: "Receipts on file", value: receiptCount, href: "/review" },
    { label: "Total transactions", value: transactionCount, href: "/review" },
  ];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Receipt Tracking</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <div className="text-3xl font-semibold">{c.value}</div>
            <div className="text-sm text-neutral-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/receipts/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          + Add a receipt
        </Link>
        <Link
          href="/statements"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
        >
          Upload a statement / CSV
        </Link>
      </div>
    </main>
  );
}

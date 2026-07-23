import { prisma } from "@/lib/prisma";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function monthBounds(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const monthStr =
    typeof params.month === "string" ? params.month : new Date().toISOString().slice(0, 7);
  const { start, end } = monthBounds(monthStr);

  const transactions = await prisma.transaction.findMany({
    where: { txnDate: { gte: start, lt: end } },
    include: { property: true },
  });

  const byProperty = new Map<string, number>();
  let overheadTotal = 0;
  let needsReviewTotal = 0;

  for (const t of transactions) {
    if (t.needsReview) {
      needsReviewTotal += t.amountCents;
      continue;
    }
    if (t.category === "overhead") {
      overheadTotal += t.amountCents;
    } else if (t.property) {
      byProperty.set(t.property.name, (byProperty.get(t.property.name) ?? 0) + t.amountCents);
    }
  }

  const rows = Array.from(byProperty.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Monthly Owner Billing & Overhead</h1>

      <form method="get" className="mb-6 flex items-center gap-3 text-sm">
        <label htmlFor="month">Month</label>
        <input
          id="month"
          type="month"
          name="month"
          defaultValue={monthStr}
          className="rounded border border-neutral-300 p-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button type="submit" className="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
          Go
        </button>
        <a
          href={`/api/reports/export?month=${monthStr}`}
          className="ml-auto underline"
        >
          Export CSV
        </a>
      </form>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            <th className="py-2">Property</th>
            <th className="py-2 text-right">Owner-billable total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, cents]) => (
            <tr key={name} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2">{name}</td>
              <td className="py-2 text-right">{money(cents)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-neutral-300 font-medium dark:border-neutral-700">
            <td className="py-2">Company Overhead</td>
            <td className="py-2 text-right">{money(overheadTotal)}</td>
          </tr>
        </tbody>
      </table>

      {needsReviewTotal !== 0 && (
        <p className="mt-4 text-sm text-amber-600">
          {money(needsReviewTotal)} in charges this month still need review and
          are excluded from the totals above — see the{" "}
          <a href="/review?status=needs_review" className="underline">
            Review page
          </a>
          .
        </p>
      )}
    </main>
  );
}

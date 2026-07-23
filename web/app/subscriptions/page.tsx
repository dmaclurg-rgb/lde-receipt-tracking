import { prisma } from "@/lib/prisma";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// A normalized vendor key so "UBER *TRIP HELP.UBER.COMCA" and
// "UBER *TRIP 8/2 HELP.UBER.COMCA" still group together: strip digits/dates
// and collapse whitespace.
function normalizeVendor(description: string): string {
  return description
    .toLowerCase()
    .replace(/[0-9/#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function SubscriptionsPage() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { txnDate: "asc" },
  });

  const groups = new Map<
    string,
    { description: string; amountCents: number; months: Set<string>; count: number }
  >();

  for (const t of transactions) {
    const vendor = normalizeVendor(t.description);
    const key = `${vendor}|${t.amountCents}`;
    const month = t.txnDate.toISOString().slice(0, 7);
    const existing = groups.get(key);
    if (existing) {
      existing.months.add(month);
      existing.count++;
    } else {
      groups.set(key, {
        description: t.description,
        amountCents: t.amountCents,
        months: new Set([month]),
        count: 1,
      });
    }
  }

  // Recurring = the same vendor + amount charged in 2+ distinct months.
  const recurring = Array.from(groups.values())
    .filter((g) => g.months.size >= 2)
    .sort((a, b) => b.months.size - a.months.size);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Subscriptions</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Same vendor + amount charged in 2 or more different months — review
        whether each is still in use, or should be cancelled.
      </p>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            <th className="py-2">Vendor</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2 text-right">Months charged</th>
          </tr>
        </thead>
        <tbody>
          {recurring.map((g) => (
            <tr key={`${g.description}-${g.amountCents}`} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2 max-w-md truncate" title={g.description}>{g.description}</td>
              <td className="py-2 text-right">{money(g.amountCents)}</td>
              <td className="py-2 text-right">{g.months.size}</td>
            </tr>
          ))}
          {recurring.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-neutral-500">
                No recurring charges detected yet — upload more than one
                month of statements to see subscriptions here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

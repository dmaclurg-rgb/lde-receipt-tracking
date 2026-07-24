import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/admin";
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import AssignPropertyControl from "./AssignPropertyControl";
import ManualTransactionForm from "./ManualTransactionForm";
import NotesField from "./NotesField";
import ReceiptMatcher from "./ReceiptMatcher";

function money(cents: number): string {
  const dollars = cents / 100;
  return dollars < 0
    ? `-$${Math.abs(dollars).toFixed(2)}`
    : `$${dollars.toFixed(2)}`;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await currentAdmin())) redirect("/");

  const params = await searchParams;
  const propertyFilter = typeof params.property === "string" ? params.property : undefined;
  const statusFilter = typeof params.status === "string" ? params.status : undefined;

  const properties = await prisma.property.findMany({ orderBy: { name: "asc" } });

  const where: Prisma.TransactionWhereInput = {
    ...(propertyFilter === "overhead"
      ? { category: "overhead" }
      : propertyFilter
        ? { propertyId: propertyFilter }
        : {}),
    ...(statusFilter === "needs_review" ? { needsReview: true } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { property: true, receipts: { include: { receipt: true } } },
    orderBy: { txnDate: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Review</h1>

      <div className="mb-6">
        <ManualTransactionForm properties={properties} />
      </div>

      <form className="mb-4 flex flex-wrap gap-3 text-sm" method="get">
        <select name="property" defaultValue={propertyFilter ?? ""} className="rounded border border-neutral-300 p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">All properties</option>
          <option value="overhead">Company Overhead</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter ?? ""} className="rounded border border-neutral-300 p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">All statuses</option>
          <option value="needs_review">Needs review only</option>
        </select>
        <button type="submit" className="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Method</th>
              <th className="py-2 pr-3">Property / Category</th>
              <th className="py-2 pr-3">Receipts</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-3 whitespace-nowrap">{t.txnDate.toISOString().slice(0, 10)}</td>
                <td className="py-2 pr-3 max-w-xs truncate" title={t.description}>{t.description}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{money(t.amountCents)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{PAYMENT_METHOD_LABELS[t.paymentMethod]}</td>
                <td className="py-2 pr-3">
                  {t.needsReview ? (
                    <AssignPropertyControl transactionId={t.id} properties={properties} />
                  ) : (
                    <span>{t.property?.name ?? (t.category ? CATEGORY_LABELS[t.category] : "—")}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <ReceiptMatcher
                    transactionId={t.id}
                    linked={t.receipts.map((tr) => ({
                      id: tr.receipt.id,
                      description: tr.receipt.description,
                      capturedAt: tr.receipt.capturedAt.toISOString(),
                      fileUrl: tr.receipt.fileUrl,
                    }))}
                  />
                </td>
                <td className="py-2 pr-3">
                  {t.needsReview ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                      Needs review
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                      Matched
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <NotesField transactionId={t.id} initialNotes={t.notes ?? ""} />
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-neutral-500">
                  No transactions yet — upload a statement or log a manual entry above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

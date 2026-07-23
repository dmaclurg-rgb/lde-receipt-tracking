import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import SuppliesNav from "../SuppliesNav";
import { STATUS_LABELS } from "@/lib/supplies/constants";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
};

export default async function SupplyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : undefined;
  const propertyFilter = typeof params.property === "string" ? params.property : undefined;

  const properties = await prisma.property.findMany({ orderBy: { name: "asc" } });

  const where: Prisma.SupplyOrderWhereInput = {
    ...(statusFilter ? { status: statusFilter as "pending" | "ordered" | "delivered" } : {}),
    ...(propertyFilter ? { propertyId: propertyFilter } : {}),
  };

  const orders = await prisma.supplyOrder.findMany({
    where,
    include: { property: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Track Orders</h1>
      <SuppliesNav />

      <form className="mb-4 flex flex-wrap gap-3 text-sm" method="get">
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded border border-neutral-300 p-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="property"
          defaultValue={propertyFilter ?? ""}
          className="rounded border border-neutral-300 p-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3">Submitted</th>
              <th className="py-2 pr-3">Property</th>
              <th className="py-2 pr-3">Requested By</th>
              <th className="py-2 pr-3">Items</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-3 whitespace-nowrap">
                  {order.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-2 pr-3">
                  <Link href={`/supplies/orders/${order.id}`} className="hover:underline">
                    {order.property.name}
                  </Link>
                </td>
                <td className="py-2 pr-3">{order.requestedByName ?? order.requestedByEmail}</td>
                <td className="py-2 pr-3">{order.items.length}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-500">
                  No orders yet — submit one from{" "}
                  <Link href="/supplies" className="underline">
                    Order Supplies
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

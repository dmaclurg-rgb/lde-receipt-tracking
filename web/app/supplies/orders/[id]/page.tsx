import { notFound } from "next/navigation";
import type { SupplyVendor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VENDOR_LABELS, VENDOR_ORDER, detectVendorFromUrl } from "@/lib/supplies/constants";
import OrderActions from "./OrderActions";

interface LineItem {
  id: string;
  name: string;
  url: string | null;
  vendor: SupplyVendor;
  quantity: number;
  size: string | null;
}

export default async function SupplyOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.supplyOrder.findUnique({
    where: { id },
    include: { property: true, items: { include: { supplyItem: true } } },
  });

  if (!order) notFound();

  const lines: LineItem[] = order.items.map((item) =>
    item.supplyItem
      ? {
          id: item.id,
          name: item.supplyItem.name,
          url: item.supplyItem.url,
          vendor: item.supplyItem.vendor,
          quantity: item.quantity,
          size: item.size,
        }
      : {
          id: item.id,
          name: item.adHocName ?? "Item",
          url: item.adHocUrl,
          vendor: detectVendorFromUrl(item.adHocUrl),
          quantity: item.quantity,
          size: item.size,
        }
  );

  const grouped = VENDOR_ORDER.map((vendor) => ({
    vendor,
    lines: lines.filter((l) => l.vendor === vendor),
  })).filter((g) => g.lines.length > 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">{order.property.name} — Order Sheet</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Requested by {order.requestedByName ?? order.requestedByEmail} on{" "}
        {order.createdAt.toISOString().slice(0, 10)}
        {order.notes ? ` — "${order.notes}"` : ""}
      </p>

      <div className="mb-6 flex flex-col gap-6">
        {grouped.map((group) => (
          <div key={group.vendor}>
            <h2 className="mb-2 text-sm font-semibold text-neutral-500">
              {VENDOR_LABELS[group.vendor]}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <span>
                    {line.name}
                    {line.size ? ` — ${line.size}` : ""}
                    <span className="text-neutral-500"> × {line.quantity}</span>
                  </span>
                  {line.url ? (
                    <a
                      href={line.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                      View / Add to Cart →
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-neutral-400">No link on file</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <OrderActions
        orderId={order.id}
        status={order.status}
        orderConfirmation={order.orderConfirmation}
        expectedDelivery={order.expectedDelivery?.toISOString().slice(0, 10) ?? null}
        deliveryNotes={order.deliveryNotes}
        orderedAt={order.orderedAt?.toISOString().slice(0, 10) ?? null}
        deliveredAt={order.deliveredAt?.toISOString().slice(0, 10) ?? null}
      />
    </main>
  );
}

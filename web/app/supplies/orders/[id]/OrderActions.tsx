"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplyOrderStatus } from "@prisma/client";

interface Props {
  orderId: string;
  status: SupplyOrderStatus;
  orderConfirmation: string | null;
  expectedDelivery: string | null;
  deliveryNotes: string | null;
  orderedAt: string | null;
  deliveredAt: string | null;
}

export default function OrderActions({
  orderId,
  status,
  orderConfirmation,
  expectedDelivery,
  deliveryNotes,
  orderedAt,
  deliveredAt,
}: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(orderConfirmation ?? "");
  const [delivery, setDelivery] = useState(expectedDelivery ?? "");
  const [notes, setNotes] = useState(deliveryNotes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markOrdered(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplies/orders/${orderId}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderConfirmation: confirmation.trim() || undefined,
          expectedDelivery: delivery || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to mark as ordered.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function markDelivered(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplies/orders/${orderId}/deliver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNotes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to mark as delivered.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "pending") {
    return (
      <form onSubmit={markOrdered} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-semibold">Mark as Ordered</h2>
        <div className="mb-3 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Order confirmation # (optional)"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="date"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            className="rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-brand-gold-contrast disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Mark as Ordered"}
        </button>
      </form>
    );
  }

  if (status === "ordered") {
    return (
      <form onSubmit={markDelivered} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="mb-3 text-sm text-neutral-500">
          Ordered{orderedAt ? ` on ${orderedAt}` : ""}
          {orderConfirmation ? ` — confirmation #${orderConfirmation}` : ""}
          {expectedDelivery ? ` — expected ${expectedDelivery}` : ""}
        </p>
        <h2 className="mb-3 text-sm font-semibold">Mark as Delivered</h2>
        <textarea
          placeholder="Notes (optional) — condition, shortages, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mb-3 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-brand-gold-contrast disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Mark as Delivered"}
        </button>
      </form>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
      Delivered{deliveredAt ? ` on ${deliveredAt}` : ""}.
      {deliveryNotes ? ` ${deliveryNotes}` : ""}
    </div>
  );
}

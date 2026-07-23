"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OVERHEAD_OPTION_VALUE, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";

const MANUAL_METHODS = PAYMENT_METHODS.filter((m) =>
  ["bank_transfer", "zelle", "wire"].includes(m)
);

export default function ManualTransactionForm({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(MANUAL_METHODS[0]);
  const [property, setProperty] = useState(OVERHEAD_OPTION_VALUE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amountDollars: parseFloat(amount),
          txnDate,
          paymentMethod,
          property,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to log transaction.");
      setDescription("");
      setAmount("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
      >
        + Log Bank Transfer / Zelle / Wire
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Date</label>
        <input
          type="date"
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          required
          className="rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Amount</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-28 rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as (typeof MANUAL_METHODS)[number])}
          className="rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {MANUAL_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Property</label>
        <select
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          className="rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value={OVERHEAD_OPTION_VALUE}>Company Overhead</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 min-w-[200px] flex-col">
        <label className="text-xs text-neutral-500">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand-gold px-3 py-1.5 text-sm font-medium text-brand-gold-contrast transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-neutral-500 underline"
      >
        Cancel
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

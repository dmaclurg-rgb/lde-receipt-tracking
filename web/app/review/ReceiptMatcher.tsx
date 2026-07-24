"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface LinkedReceipt {
  id: string;
  description: string;
  capturedAt: string;
  fileUrl: string | null;
}

interface Candidate extends LinkedReceipt {
  daysApart: number;
}

export default function ReceiptMatcher({
  transactionId,
  linked,
}: {
  transactionId: string;
  linked: LinkedReceipt[];
}) {
  const router = useRouter();
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPicker() {
    const rect = attachButtonRef.current?.getBoundingClientRect();
    if (rect) setPopoverPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    setOpen(true);
    setError(null);
    if (candidates) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/receipts`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load candidates.");
      setCandidates(body.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function attach(receiptId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId }),
      });
      if (!res.ok) throw new Error("Failed to attach receipt.");
      setOpen(false);
      setCandidates(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function detach(receiptId: string) {
    setLoading(true);
    try {
      await fetch(`/api/transactions/${transactionId}/receipts/${receiptId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {linked.map((r) => (
          <span
            key={r.id}
            className="group flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800"
            title={r.description}
          >
            {r.fileUrl ? (
              <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="max-w-[100px] truncate underline">
                {r.description}
              </a>
            ) : (
              <span className="max-w-[100px] truncate">{r.description}</span>
            )}
            <button
              onClick={() => detach(r.id)}
              disabled={loading}
              className="text-neutral-400 hover:text-red-500"
              aria-label="Detach"
            >
              ×
            </button>
          </span>
        ))}
        <button
          ref={attachButtonRef}
          onClick={openPicker}
          className="rounded border border-dashed border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:border-brand-gold hover:text-brand-gold dark:border-neutral-700"
        >
          + Attach
        </button>
      </div>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            style={{ top: popoverPos.top, left: popoverPos.left }}
            className="fixed z-20 w-72 rounded-md border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Candidate receipts</span>
              <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-700">
                Close
              </button>
            </div>
            {loading && <p className="text-xs text-neutral-500">Loading…</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {!loading && candidates && candidates.length === 0 && (
              <p className="text-xs text-neutral-500">
                No unattached receipts found for this property/category.
              </p>
            )}
            <ul className="max-h-64 overflow-y-auto">
              {candidates?.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => attach(c.id)}
                    disabled={loading}
                    className="flex w-full flex-col items-start rounded px-1.5 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="truncate font-medium">{c.description}</span>
                    <span className="text-neutral-500">
                      {c.capturedAt.slice(0, 10)} · {Math.round(c.daysApart)}d apart
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

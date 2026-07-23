"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OVERHEAD_OPTION_VALUE } from "@/lib/constants";

interface Props {
  transactionId: string;
  properties: { id: string; name: string }[];
}

export default function AssignPropertyControl({ transactionId, properties }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(OVERHEAD_OPTION_VALUE);
  const [saving, setSaving] = useState(false);

  async function assign() {
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: value }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-neutral-300 p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value={OVERHEAD_OPTION_VALUE}>Company Overhead</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={assign}
        disabled={saving}
        className="rounded bg-brand-gold px-2 py-1 text-xs font-medium text-brand-gold-contrast transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
      >
        Assign
      </button>
    </div>
  );
}

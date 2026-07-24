"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotesField({
  transactionId,
  initialNotes,
}: {
  transactionId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === initialNotes) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      placeholder="Add a note…"
      disabled={saving}
      className="w-full min-w-[140px] rounded border border-transparent bg-transparent p-1 text-xs placeholder:text-neutral-500 hover:border-neutral-300 focus:border-brand-gold focus:bg-white focus:outline-none disabled:opacity-50 dark:hover:border-neutral-700 dark:focus:bg-neutral-900"
    />
  );
}

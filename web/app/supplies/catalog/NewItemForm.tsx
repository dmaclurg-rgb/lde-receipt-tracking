"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewItemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isCommon, setIsCommon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/supplies/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim() || undefined, isCommon }),
      });
      if (!res.ok) throw new Error("Failed to add item.");
      setName("");
      setUrl("");
      setIsCommon(false);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
      >
        + Add catalog item
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Product URL (vendor auto-detected)"
        className="rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={isCommon} onChange={(e) => setIsCommon(e.target.checked)} />
        Commonly purchased
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-gold px-4 py-1.5 text-xs font-medium text-brand-gold-contrast disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add Item"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs dark:border-neutral-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

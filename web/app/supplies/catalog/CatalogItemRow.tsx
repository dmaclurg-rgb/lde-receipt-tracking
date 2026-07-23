"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplyVendor } from "@prisma/client";
import { VENDOR_LABELS } from "@/lib/supplies/constants";

interface Item {
  id: string;
  name: string;
  vendor: SupplyVendor;
  url: string | null;
  imageUrl: string | null;
  alternativeNote: string | null;
  isCommon: boolean;
  sizeOptions: string[] | null;
  active: boolean;
}

const VENDORS = Object.keys(VENDOR_LABELS) as SupplyVendor[];

export default function CatalogItemRow({ item }: { item: Item }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name);
  const [vendor, setVendor] = useState<SupplyVendor>(item.vendor);
  const [url, setUrl] = useState(item.url ?? "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [alternativeNote, setAlternativeNote] = useState(item.alternativeNote ?? "");
  const [isCommon, setIsCommon] = useState(item.isCommon);
  const [active, setActive] = useState(item.active);
  const [sizeOptionsText, setSizeOptionsText] = useState(item.sizeOptions?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const sizeOptions = sizeOptionsText.trim()
        ? sizeOptionsText.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      const res = await fetch(`/api/supplies/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          vendor,
          url: url.trim() || null,
          imageUrl: imageUrl.trim() || null,
          alternativeNote: alternativeNote.trim() || null,
          isCommon,
          active,
          sizeOptions,
        }),
      });
      if (!res.ok) throw new Error("Failed to save.");
      router.refresh();
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${!item.active ? "text-neutral-400 line-through" : ""}`}>
            {item.name}
          </p>
          <p className="text-xs text-neutral-500">
            {VENDOR_LABELS[item.vendor]}
            {item.isCommon ? " · Common" : ""}
            {item.sizeOptions ? ` · Sizes: ${item.sizeOptions.join(", ")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700"
        >
          {expanded ? "Close" : "Edit"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value as SupplyVendor)}
              className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
            >
              {VENDORS.map((v) => (
                <option key={v} value={v}>
                  {VENDOR_LABELS[v]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={isCommon} onChange={(e) => setIsCommon(e.target.checked)} />
              Commonly purchased
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Product URL (Amazon/Instacart/etc.)"
            className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            value={alternativeNote}
            onChange={(e) => setAlternativeNote(e.target.value)}
            placeholder="Alternative / notes (optional)"
            className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            value={sizeOptionsText}
            onChange={(e) => setSizeOptionsText(e.target.value)}
            placeholder="Size options, comma-separated (leave blank if none) — e.g. Twin XL, Queen, King, Cal King"
            className="rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {error && <p className="text-red-600">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="self-start rounded-md bg-brand-gold px-4 py-1.5 text-xs font-medium text-brand-gold-contrast disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

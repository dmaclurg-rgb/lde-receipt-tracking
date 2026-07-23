"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OVERHEAD_OPTION_VALUE, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";

interface Props {
  properties: { id: string; name: string }[];
}

interface StagedFile {
  file: File;
  previewUrl: string;
}

export default function NewReceiptForm({ properties }: Props) {
  const router = useRouter();
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [property, setProperty] = useState(OVERHEAD_OPTION_VALUE);
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setStaged((prev) => [...prev, ...next]);
  }

  function removeStaged(index: number) {
    setStaged((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (staged.length === 0) {
      setError("Add at least one photo or file.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("property", property);
      formData.set("description", description.trim());
      formData.set("paymentMethod", paymentMethod);
      formData.set("source", "app_upload");
      for (const { file } of staged) {
        formData.append("files", file);
      }

      const res = await fetch("/api/receipts", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to submit receipt.");
      }

      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      router.push("/review");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Photos / Files</label>
        <div className="flex flex-wrap gap-3">
          {staged.map((s, i) => (
            <div key={s.previewUrl} className="relative h-24 w-24 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
              {s.file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                  {s.file.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeStaged(i)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            📷 Take Photo
          </button>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
          >
            Upload File
          </button>
        </div>
        {/* capture="environment" opens the device's rear camera directly on
            mobile; tapping "Take Photo" repeatedly stages multiple shots. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <label htmlFor="property" className="mb-1 block text-sm font-medium">
          Property
        </label>
        <select
          id="property"
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          className="w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value={OVERHEAD_OPTION_VALUE}>Company Overhead</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description (required for audit purposes)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="What was this purchase for?"
          className="w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div>
        <label htmlFor="paymentMethod" className="mb-1 block text-sm font-medium">
          Payment Method
        </label>
        <select
          id="paymentMethod"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {PAYMENT_METHODS.map((pm) => (
            <option key={pm} value={pm}>
              {PAYMENT_METHOD_LABELS[pm]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? "Submitting…" : "Submit Receipt"}
      </button>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function StatementUploadForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    unmatched: number;
    orphans: number;
    skippedFiles: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (files.length === 0) {
      setError("Attach at least one BofA/Citi PDF or Home Depot CSV.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/statements/reconcile", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to reconcile.");
      setResult(body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div
        className="cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
        }}
      >
        {files.length === 0
          ? "Drag & drop BofA/Citi PDFs or Home Depot CSVs here, or click to choose"
          : files.map((f) => f.name).join(", ")}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv"
          multiple
          className="hidden"
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? "Reconciling…" : "Reconcile"}
      </button>

      {result && (
        <div className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <p>{result.matched} charges matched to Home Depot receipts.</p>
          <p>{result.unmatched} charges still need a receipt or manual review.</p>
          <p>{result.orphans} Home Depot receipts had no matching card charge.</p>
          {result.skippedFiles.length > 0 && (
            <p className="mt-2 text-amber-600">
              Could not detect file type for: {result.skippedFiles.join(", ")}
            </p>
          )}
          <a href="/review" className="mt-3 inline-block underline">
            Go to Review →
          </a>
        </div>
      )}
    </form>
  );
}

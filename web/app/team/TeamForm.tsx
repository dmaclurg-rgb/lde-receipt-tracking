"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined, isAdmin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save login.");
      setSuccess(`Login saved for ${body.user.email}.`);
      setEmail("");
      setName("");
      setPassword("");
      setIsAdmin(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-56 rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40 rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Password</label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="min. 8 characters"
          className="w-40 rounded border border-neutral-300 p-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <label className="flex items-center gap-2 pb-1.5 text-sm">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Admin
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand-gold px-3 py-1.5 text-sm font-medium text-brand-gold-contrast transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save login"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      {success && <p className="w-full text-sm text-emerald-600">{success}</p>}
    </form>
  );
}

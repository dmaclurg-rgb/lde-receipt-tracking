import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import TeamForm from "./TeamForm";

export default async function TeamPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Team Logins</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Add a new teammate, or re-enter an existing email with a new password to reset it.
      </p>

      <div className="mb-8">
        <TeamForm />
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            <th className="py-2">Email</th>
            <th className="py-2">Name</th>
            <th className="py-2">Admin</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.name ?? "—"}</td>
              <td className="py-2">{u.isAdmin ? "Yes" : ""}</td>
              <td className="py-2">{u.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

function monthBounds(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const monthStr = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const { start, end } = monthBounds(monthStr);

  const transactions = await prisma.transaction.findMany({
    where: { txnDate: { gte: start, lt: end } },
    include: { property: true },
    orderBy: { txnDate: "asc" },
  });

  const header = [
    "date",
    "description",
    "amount",
    "payment_method",
    "property_or_overhead",
    "needs_review",
    "source_file",
  ];
  const lines = [header.join(",")];
  for (const t of transactions) {
    lines.push(
      [
        t.txnDate.toISOString().slice(0, 10),
        csvEscape(t.description),
        (t.amountCents / 100).toFixed(2),
        PAYMENT_METHOD_LABELS[t.paymentMethod],
        t.property?.name ?? (t.category === "overhead" ? "Company Overhead" : ""),
        t.needsReview ? "yes" : "",
        csvEscape(t.sourceFile ?? ""),
      ]
        .map(String)
        .join(",")
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="owner-billing-${monthStr}.csv"`,
    },
  });
}

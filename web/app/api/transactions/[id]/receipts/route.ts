import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Candidate receipts to attach to this transaction: same property/category,
// not already linked to this transaction, closest in date first. Kept
// manual/suggestion-only rather than auto-matched — a wrong owner-billing
// allocation is worse than a receipt sitting unmatched for a human to catch.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/transactions/[id]/receipts">
) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const alreadyLinked = await prisma.transactionReceipt.findMany({
    where: { transactionId: id },
    select: { receiptId: true },
  });
  const excludeIds = alreadyLinked.map((l) => l.receiptId);

  const candidates = await prisma.receipt.findMany({
    where: {
      id: { notIn: excludeIds.length ? excludeIds : undefined },
      category: txn.category ?? undefined,
      propertyId: txn.category === "property" ? txn.propertyId : undefined,
    },
    orderBy: { capturedAt: "desc" },
    take: 100,
  });

  const withDelta = candidates
    .map((r) => ({
      ...r,
      daysApart: Math.abs(
        (r.capturedAt.getTime() - txn.txnDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => a.daysApart - b.daysApart)
    .slice(0, 20);

  return NextResponse.json({ candidates: withDelta });
}

const AttachSchema = z.object({ receiptId: z.string().min(1) });

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/transactions/[id]/receipts">
) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = AttachSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const link = await prisma.transactionReceipt.upsert({
    where: { transactionId_receiptId: { transactionId: id, receiptId: parsed.data.receiptId } },
    update: {},
    create: { transactionId: id, receiptId: parsed.data.receiptId },
  });
  return NextResponse.json({ link }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertLedgerRow } from "@/lib/notion";
import { OVERHEAD_OPTION_VALUE, PAYMENT_METHODS } from "@/lib/constants";

// Manual entries — bank transfer / Zelle / wire have no statement PDF to
// parse, so the team logs them directly here instead of via
// /api/statements/reconcile.
const ManualTxnSchema = z.object({
  description: z.string().min(1),
  amountDollars: z.coerce.number(),
  txnDate: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS as [string, ...string[]]),
  property: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ManualTxnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { description, amountDollars, txnDate, paymentMethod, property } = parsed.data;

  const isOverhead = property === OVERHEAD_OPTION_VALUE;
  const propertyRecord = isOverhead
    ? null
    : await prisma.property.findUnique({ where: { id: property } });
  if (!isOverhead && !propertyRecord) {
    return NextResponse.json({ error: "Unknown property." }, { status: 400 });
  }

  const txn = await prisma.transaction.create({
    data: {
      source: "manual",
      description,
      amountCents: Math.round(amountDollars * 100),
      txnDate: new Date(txnDate),
      paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number],
      category: isOverhead ? "overhead" : "property",
      propertyId: propertyRecord?.id,
      needsReview: false,
    },
  });

  const notionPageId = await upsertLedgerRow({
    title: description,
    date: txn.txnDate,
    amountCents: txn.amountCents,
    property: propertyRecord?.name ?? null,
    category: txn.category!,
    paymentMethod: txn.paymentMethod,
    needsReview: false,
  });
  if (notionPageId) {
    await prisma.transaction.update({ where: { id: txn.id }, data: { notionPageId } });
  }

  return NextResponse.json({ transaction: txn }, { status: 201 });
}

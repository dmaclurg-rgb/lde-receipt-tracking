import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/transactions/[id]/receipts/[receiptId]">
) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, receiptId } = await ctx.params;
  await prisma.transactionReceipt.delete({
    where: { transactionId_receiptId: { transactionId: id, receiptId } },
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { OVERHEAD_OPTION_VALUE } from "@/lib/constants";

const UpdateSchema = z.object({
  property: z.string().min(1).optional(), // property id, or the OVERHEAD sentinel
  notes: z.string().optional(),
});

// Resolves a needs-review transaction by assigning it to a property (or
// Company Overhead), and/or updates its admin notes. Used from the Review
// page for both the property-assignment control and the inline notes field.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  if (parsed.data.property === undefined && parsed.data.notes === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const data: Prisma.TransactionUpdateInput = {};

  if (parsed.data.property !== undefined) {
    const isOverhead = parsed.data.property === OVERHEAD_OPTION_VALUE;
    const propertyRecord = isOverhead
      ? null
      : await prisma.property.findUnique({ where: { id: parsed.data.property } });
    if (!isOverhead && !propertyRecord) {
      return NextResponse.json({ error: "Unknown property." }, { status: 400 });
    }
    data.category = isOverhead ? "overhead" : "property";
    data.property = propertyRecord ? { connect: { id: propertyRecord.id } } : { disconnect: true };
    data.needsReview = false;
  }

  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes;
  }

  const txn = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json({ transaction: txn });
}

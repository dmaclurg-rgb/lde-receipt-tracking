import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OVERHEAD_OPTION_VALUE } from "@/lib/constants";

const UpdateSchema = z.object({
  property: z.string().min(1), // property id, or the OVERHEAD sentinel
});

// Resolves a needs-review transaction by assigning it to a property (or
// Company Overhead). Used from the Review page for charges the matcher
// couldn't confidently route on its own.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const isOverhead = parsed.data.property === OVERHEAD_OPTION_VALUE;
  const propertyRecord = isOverhead
    ? null
    : await prisma.property.findUnique({ where: { id: parsed.data.property } });
  if (!isOverhead && !propertyRecord) {
    return NextResponse.json({ error: "Unknown property." }, { status: 400 });
  }

  const txn = await prisma.transaction.update({
    where: { id },
    data: {
      category: isOverhead ? "overhead" : "property",
      propertyId: propertyRecord?.id ?? null,
      needsReview: false,
    },
  });

  return NextResponse.json({ transaction: txn });
}

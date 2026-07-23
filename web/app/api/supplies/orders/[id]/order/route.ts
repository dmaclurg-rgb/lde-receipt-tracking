import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MarkOrderedSchema = z.object({
  orderConfirmation: z.string().optional(),
  expectedDelivery: z.string().optional(),
});

// Marks an order sheet as placed with the vendor(s). Confirmation # and
// expected delivery are both optional — the office may not have them yet
// when they first mark it ordered.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/supplies/orders/[id]/order">
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = MarkOrderedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { orderConfirmation, expectedDelivery } = parsed.data;

  const existing = await prisma.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = await prisma.supplyOrder.update({
    where: { id },
    data: {
      status: "ordered",
      orderedByEmail: session.user.email,
      orderedAt: new Date(),
      orderConfirmation: orderConfirmation || null,
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
    },
  });

  return NextResponse.json({ order });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MarkDeliveredSchema = z.object({
  deliveryNotes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/supplies/orders/[id]/deliver">
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = MarkDeliveredSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = await prisma.supplyOrder.update({
    where: { id },
    data: {
      status: "delivered",
      deliveredAt: new Date(),
      deliveryNotes: parsed.data.deliveryNotes || null,
    },
  });

  return NextResponse.json({ order });
}

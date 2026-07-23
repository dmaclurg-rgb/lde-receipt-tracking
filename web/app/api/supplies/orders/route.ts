import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ItemSchema = z
  .object({
    supplyItemId: z.string().optional(),
    adHocName: z.string().optional(),
    adHocUrl: z.string().optional(),
    quantity: z.coerce.number().int().min(1).default(1),
    size: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((item) => Boolean(item.supplyItemId) || Boolean(item.adHocName), {
    message: "Each item needs either a catalog item or a name.",
  });

const CreateOrderSchema = z.object({
  propertyId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(ItemSchema).min(1, "Add at least one item."),
});

// Creates a supply order sheet for a property. No approval step — the
// office places every order on the back end, so this just records the
// request as `pending` for them to work from.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { propertyId, notes, items } = parsed.data;

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    return NextResponse.json({ error: "Unknown property." }, { status: 400 });
  }

  const order = await prisma.supplyOrder.create({
    data: {
      propertyId,
      requestedByEmail: session.user.email,
      requestedByName: session.user.name ?? null,
      notes,
      items: {
        create: items.map((item) => ({
          supplyItemId: item.supplyItemId ?? null,
          adHocName: item.adHocName ?? null,
          adHocUrl: item.adHocUrl ?? null,
          quantity: item.quantity,
          size: item.size ?? null,
          notes: item.notes ?? null,
        })),
      },
    },
    include: { items: true, property: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}

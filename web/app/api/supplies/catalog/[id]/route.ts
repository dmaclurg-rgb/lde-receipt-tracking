import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VENDORS = [
  "amazon",
  "instacart",
  "costco",
  "home_depot",
  "specialty",
  "pool_supply",
  "other",
] as const;

const UpdateItemSchema = z.object({
  name: z.string().min(1).optional(),
  vendor: z.enum(VENDORS).optional(),
  url: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  alternativeNote: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isCommon: z.boolean().optional(),
  sizeOptions: z.array(z.string()).nullable().optional(),
  active: z.boolean().optional(),
});

// Catalog links/photos/flags are meant to be easy to fix without a deploy —
// this is that edit path, open to any logged-in team member.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/supplies/catalog/[id]">
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.supplyItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const { sizeOptions, ...rest } = parsed.data;

  const item = await prisma.supplyItem.update({
    where: { id },
    data: {
      ...rest,
      ...(sizeOptions !== undefined
        ? { sizeOptions: sizeOptions === null ? Prisma.JsonNull : sizeOptions }
        : {}),
    },
  });

  return NextResponse.json({ item });
}

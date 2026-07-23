import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { detectVendorFromUrl } from "@/lib/supplies/constants";

const VENDORS = [
  "amazon",
  "instacart",
  "costco",
  "home_depot",
  "specialty",
  "pool_supply",
  "other",
] as const;

const CreateItemSchema = z.object({
  name: z.string().min(1),
  vendor: z.enum(VENDORS).optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  alternativeNote: z.string().optional(),
  notes: z.string().optional(),
  isCommon: z.boolean().default(false),
  sizeOptions: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const data = parsed.data;

  const item = await prisma.supplyItem.create({
    data: {
      name: data.name,
      vendor: data.vendor ?? detectVendorFromUrl(data.url),
      url: data.url || null,
      imageUrl: data.imageUrl || null,
      alternativeNote: data.alternativeNote || null,
      notes: data.notes || null,
      isCommon: data.isCommon,
      sizeOptions: data.sizeOptions ?? undefined,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

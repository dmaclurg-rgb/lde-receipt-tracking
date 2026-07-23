import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { upsertLedgerRow } from "@/lib/notion";
import { OVERHEAD_OPTION_VALUE, PAYMENT_METHODS } from "@/lib/constants";
import type { Category } from "@prisma/client";

const FieldsSchema = z.object({
  property: z.string().min(1),
  description: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS as [string, ...string[]]),
  source: z.enum(["app_upload", "app_camera", "slack", "email_auto"]).default("app_upload"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = FieldsSchema.safeParse({
    property: formData.get("property"),
    description: formData.get("description"),
    paymentMethod: formData.get("paymentMethod"),
    source: formData.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { property, description, paymentMethod, source } = parsed.data;

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  const isOverhead = property === OVERHEAD_OPTION_VALUE;
  const category: Category = isOverhead ? "overhead" : "property";
  const propertyRecord = isOverhead
    ? null
    : await prisma.property.findUnique({ where: { id: property } });
  if (!isOverhead && !propertyRecord) {
    return NextResponse.json({ error: "Unknown property." }, { status: 400 });
  }

  const now = new Date();
  const folderLabel = isOverhead ? "Company Overhead" : propertyRecord!.name;

  const created = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.save({
      buffer,
      filename: file.name || "receipt",
      mimeType: file.type || "application/octet-stream",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      folderLabel,
    });

    const receipt = await prisma.receipt.create({
      data: {
        fileId: stored.fileId,
        fileUrl: stored.fileUrl,
        storagePath: stored.storagePath,
        uploadedBy: session.user.email,
        category,
        propertyId: propertyRecord?.id,
        description,
        paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number],
        source,
        capturedAt: now,
      },
    });

    const notionPageId = await upsertLedgerRow({
      title: description,
      date: now,
      amountCents: 0, // receipts don't carry a parsed amount until matched to a transaction
      property: propertyRecord?.name ?? null,
      category,
      paymentMethod: receipt.paymentMethod,
      needsReview: true,
      fileUrl: stored.fileUrl,
    });
    if (notionPageId) {
      await prisma.receipt.update({ where: { id: receipt.id }, data: { notionPageId } });
    }

    created.push(receipt);
  }

  return NextResponse.json({ receipts: created }, { status: 201 });
}

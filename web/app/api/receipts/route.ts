import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createReceipt, UnknownPropertyError } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/constants";

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

  try {
    const created = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      created.push(
        await createReceipt({
          buffer,
          filename: file.name || "receipt",
          mimeType: file.type || "application/octet-stream",
          property,
          description,
          paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number],
          source,
          uploadedBy: session.user.email,
        })
      );
    }
    return NextResponse.json({ receipts: created }, { status: 201 });
  } catch (err) {
    if (err instanceof UnknownPropertyError) {
      return NextResponse.json({ error: "Unknown property." }, { status: 400 });
    }
    throw err;
  }
}

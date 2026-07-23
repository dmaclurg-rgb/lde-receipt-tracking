import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { upsertLedgerRow } from "@/lib/notion";
import { OVERHEAD_OPTION_VALUE } from "@/lib/constants";
import type { Category, PaymentMethod, Receipt, ReceiptSource } from "@prisma/client";

export interface CreateReceiptParams {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /** A Property id, or the OVERHEAD_OPTION_VALUE sentinel. */
  property: string;
  description: string;
  paymentMethod: PaymentMethod | null;
  source: ReceiptSource;
  uploadedBy: string;
  capturedAt?: Date;
  slackChannel?: string;
  slackTs?: string;
}

export class UnknownPropertyError extends Error {}

/**
 * The single path every receipt image takes into the system, regardless of
 * where it came from — the app's Add Receipt form, and the Slack webhook
 * (app/api/slack/events/route.ts), both call this. Handles: resolving the
 * property/category, filing the file via whichever StorageAdapter is
 * active, creating the Prisma row, and syncing it to the Notion ledger.
 */
export async function createReceipt(params: CreateReceiptParams): Promise<Receipt> {
  const isOverhead = params.property === OVERHEAD_OPTION_VALUE;
  const propertyRecord = isOverhead
    ? null
    : await prisma.property.findUnique({ where: { id: params.property } });
  if (!isOverhead && !propertyRecord) {
    throw new UnknownPropertyError(`Unknown property: ${params.property}`);
  }

  const category: Category = isOverhead ? "overhead" : "property";
  const capturedAt = params.capturedAt ?? new Date();
  const folderLabel = isOverhead ? "Company Overhead" : propertyRecord!.name;

  const stored = await storage.save({
    buffer: params.buffer,
    filename: params.filename,
    mimeType: params.mimeType,
    year: capturedAt.getFullYear(),
    month: capturedAt.getMonth() + 1,
    folderLabel,
  });

  const receipt = await prisma.receipt.create({
    data: {
      fileId: stored.fileId,
      fileUrl: stored.fileUrl,
      storagePath: stored.storagePath,
      uploadedBy: params.uploadedBy,
      category,
      propertyId: propertyRecord?.id,
      description: params.description,
      paymentMethod: params.paymentMethod,
      source: params.source,
      capturedAt,
      slackChannel: params.slackChannel,
      slackTs: params.slackTs,
    },
  });

  const notionPageId = await upsertLedgerRow({
    title: params.description,
    date: capturedAt,
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

  return receipt;
}

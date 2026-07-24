import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { upsertLedgerRow } from "@/lib/notion";
import { OVERHEAD_OPTION_VALUE } from "@/lib/constants";
import { recordConfirmedAssignment } from "@/lib/vendor-history";
import { findMatchingTransaction } from "@/lib/transaction-match";
import type { Category, PaymentMethod, Receipt, ReceiptSource, ResolutionSource } from "@prisma/client";

export interface CreateReceiptParams {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /**
   * A Property id, the OVERHEAD_OPTION_VALUE sentinel, or null when the
   * source can't tell (e.g. an auto-ingested email order confirmation) —
   * null lands the receipt in the needs-review queue for an admin to assign.
   */
  property: string | null;
  description: string;
  paymentMethod: PaymentMethod | null;
  source: ReceiptSource;
  uploadedBy: string;
  capturedAt?: Date;
  slackChannel?: string;
  slackTs?: string;
  emailMessageId?: string;
  /**
   * Only used when `property` is null — a rule-based or vendor-history
   * guess to pre-fill category/propertyId with. Still leaves the receipt
   * needsReview: true; this is a suggestion for the Review page, never an
   * authoritative assignment. See lib/transaction-resolution.ts.
   */
  propertySuggestion?: {
    propertyId: string | null;
    isOverhead: boolean;
    resolvedBy: ResolutionSource;
  } | null;
  /**
   * True only for call sites where a human directly picked `property`
   * themselves (the app upload form) — records the assignment into the
   * vendor-history learning log. Never set true for auto-ingestion, even
   * when a suggestion above was accepted, since accepting a suggestion
   * happens later via the PATCH route, not at creation time.
   */
  isHumanConfirmed?: boolean;
  /**
   * A dollar amount extracted from the source text (email body/subject, or
   * a Slack caption) — only used when `property` is null. If it exactly
   * matches an existing card-statement Transaction within +/- 10 days, the
   * receipt is auto-linked to that charge instead of landing in the
   * standalone needs-review queue. See lib/transaction-match.ts.
   */
  amountHintCents?: number;
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
  let needsReview = params.property === null;
  const isOverhead = params.property === OVERHEAD_OPTION_VALUE;
  const propertyRecord =
    needsReview || isOverhead
      ? null
      : await prisma.property.findUnique({ where: { id: params.property! } });
  if (!needsReview && !isOverhead && !propertyRecord) {
    throw new UnknownPropertyError(`Unknown property: ${params.property}`);
  }

  const capturedAt = params.capturedAt ?? new Date();

  let category: Category | null = needsReview ? null : isOverhead ? "overhead" : "property";
  let suggestedPropertyId: string | undefined;
  let resolvedBy: ResolutionSource | null = null;
  let matchedTransactionId: string | null = null;
  let matchedTransactionPropertyName: string | null = null;

  if (needsReview && params.amountHintCents != null) {
    // An exact amount+date match to a real card charge is a much stronger
    // signal than a vendor-name guess, so it takes priority over the
    // suggestion below — and unlike a suggestion, it's confident enough to
    // resolve the receipt outright rather than just pre-filling a form.
    const matched = await findMatchingTransaction(params.amountHintCents, capturedAt);
    if (matched) {
      category = matched.category;
      suggestedPropertyId = matched.propertyId ?? undefined;
      matchedTransactionId = matched.id;
      needsReview = false;
      if (matched.propertyId) {
        const p = await prisma.property.findUnique({ where: { id: matched.propertyId } });
        matchedTransactionPropertyName = p?.name ?? null;
      }
    }
  }
  if (needsReview && params.propertySuggestion) {
    category = params.propertySuggestion.isOverhead ? "overhead" : "property";
    suggestedPropertyId = params.propertySuggestion.propertyId ?? undefined;
    resolvedBy = params.propertySuggestion.resolvedBy;
  }
  // Storage foldering is unaffected by a suggestion — it's still
  // unconfirmed, so the file goes to the same review-queue location as any
  // other needs-review receipt until an admin actually confirms it. A
  // transaction-amount match is confident enough to file for real, though.
  const folderLabel = needsReview
    ? "Needs Review"
    : matchedTransactionId
      ? (matchedTransactionPropertyName ?? "Company Overhead")
      : isOverhead
        ? "Company Overhead"
        : propertyRecord!.name;

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
      filename: params.filename,
      mimeType: params.mimeType,
      uploadedBy: params.uploadedBy,
      category,
      propertyId: propertyRecord?.id ?? suggestedPropertyId,
      description: params.description,
      paymentMethod: params.paymentMethod,
      source: params.source,
      capturedAt,
      needsReview,
      resolvedBy,
      slackChannel: params.slackChannel,
      slackTs: params.slackTs,
      emailMessageId: params.emailMessageId,
    },
  });

  if (matchedTransactionId) {
    await prisma.transactionReceipt.create({
      data: { transactionId: matchedTransactionId, receiptId: receipt.id },
    });
  }

  if (params.isHumanConfirmed && !needsReview && category) {
    await recordConfirmedAssignment("receipt", params.description, category, propertyRecord?.id ?? null, params.uploadedBy);
  }

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

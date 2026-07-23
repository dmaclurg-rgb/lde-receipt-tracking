import { prisma } from "@/lib/prisma";
import { upsertLedgerRow } from "@/lib/notion";
import type {
  ReconcileResponse,
  RemoteCharge,
  RemoteHDRow,
} from "@/lib/matching-service";
import type { Category, PaymentMethod } from "@prisma/client";

function centsFromDecimalString(s: string): number {
  return Math.round(parseFloat(s) * 100);
}

function issuerToPaymentMethod(issuer: string): PaymentMethod {
  if (issuer === "BofA") return "bofa_card";
  if (issuer === "Citi") return "citi_card";
  return "home_depot_card";
}

async function resolvePropertyId(houseName: string | null): Promise<{
  propertyId: string | null;
  category: Category | null;
}> {
  if (!houseName) return { propertyId: null, category: null };
  if (houseName === "OVERHEAD") return { propertyId: null, category: "overhead" };
  const property = await prisma.property.findUnique({ where: { name: houseName } });
  return { propertyId: property?.id ?? null, category: property ? "property" : null };
}

async function upsertTransaction(params: {
  source: "bofa" | "citi" | "home_depot";
  issuer: string | null;
  last4: string | null;
  txnDate: Date;
  postDate: Date | null;
  description: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  category: Category | null;
  propertyId: string | null;
  needsReview: boolean;
  isSplit: boolean;
  sourceFile: string | null;
}) {
  const existing = await prisma.transaction.findFirst({
    where: {
      sourceFile: params.sourceFile,
      txnDate: params.txnDate,
      amountCents: params.amountCents,
      description: params.description,
      last4: params.last4,
    },
  });
  if (existing) return existing;

  const txn = await prisma.transaction.create({ data: params });

  const notionPageId = await upsertLedgerRow({
    title: params.description,
    date: params.txnDate,
    amountCents: params.amountCents,
    property: params.propertyId
      ? (await prisma.property.findUnique({ where: { id: params.propertyId } }))?.name ?? null
      : null,
    category: params.category ?? "overhead",
    paymentMethod: params.paymentMethod,
    needsReview: params.needsReview,
  });
  if (notionPageId) {
    await prisma.transaction.update({ where: { id: txn.id }, data: { notionPageId } });
  }
  return txn;
}

function chargeToTxnFields(charge: RemoteCharge) {
  return {
    issuer: charge.issuer,
    last4: charge.last_4,
    txnDate: new Date(charge.txn_date),
    postDate: charge.post_date ? new Date(charge.post_date) : null,
    description: charge.description,
    amountCents: centsFromDecimalString(charge.amount),
    sourceFile: charge.source_file,
    paymentMethod: issuerToPaymentMethod(charge.issuer),
  };
}

export interface PersistSummary {
  matched: number;
  unmatched: number;
  orphans: number;
  skippedFiles: string[];
}

/**
 * Writes a receipt-recon/service.py `/reconcile` response into Transaction
 * rows (deduped by sourceFile+date+amount+description+last4) and syncs each
 * to the Notion ledger. Shared by the /api/statements/reconcile route and
 * scripts/smoke-test-statement.ts.
 */
export async function persistReconcileResult(
  result: ReconcileResponse
): Promise<PersistSummary> {
  let matchedCount = 0;
  for (const m of result.matches) {
    const { propertyId, category } = await resolvePropertyId(m.house);
    await upsertTransaction({
      source: m.charge.issuer === "BofA" ? "bofa" : "citi",
      ...chargeToTxnFields(m.charge),
      category,
      propertyId,
      needsReview: m.needs_review,
      isSplit: m.is_split,
    });
    matchedCount++;
  }

  for (const u of result.unmatched) {
    await upsertTransaction({
      source: u.charge.issuer === "BofA" ? "bofa" : "citi",
      ...chargeToTxnFields(u.charge),
      category: null,
      propertyId: null,
      needsReview: true,
      isSplit: false,
    });
  }

  let orphanCount = 0;
  for (const o of result.orphans) {
    const row: RemoteHDRow = o.row;
    const { propertyId, category } = await resolvePropertyId(row.house);
    await upsertTransaction({
      source: "home_depot",
      issuer: "Home Depot",
      last4: row.cards[0] ?? null,
      txnDate: new Date(row.txn_date),
      postDate: null,
      description: row.job_name || "Home Depot purchase",
      amountCents: centsFromDecimalString(row.total_amount),
      paymentMethod: "home_depot_card",
      category,
      propertyId,
      needsReview: category === null,
      isSplit: false,
      sourceFile: row.source_file,
    });
    orphanCount++;
  }

  return {
    matched: matchedCount,
    unmatched: result.unmatched.length,
    orphans: orphanCount,
    skippedFiles: result.skipped_files,
  };
}

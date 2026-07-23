import { Client } from "@notionhq/client";
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "./constants";
import type { Category, PaymentMethod } from "@prisma/client";

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;

export const notionConfigured = Boolean(token && databaseId);

const client = token ? new Client({ auth: token }) : null;

export interface LedgerRow {
  /** Human label, e.g. a receipt description or a card-statement description. */
  title: string;
  date: Date;
  amountCents: number;
  property: string | null; // null => Company Overhead
  category: Category;
  paymentMethod: PaymentMethod;
  needsReview: boolean;
  fileUrl?: string;
}

/**
 * Push one row to the Notion ledger database. This is the human-facing
 * audit trail the team browses/filters directly in Notion; Postgres (via
 * Prisma) remains the source of truth the matching engine reasons over.
 *
 * No-ops (logging instead of throwing) when NOTION_TOKEN/NOTION_DATABASE_ID
 * aren't configured yet, so the rest of the app works before that credential
 * is provisioned — see SETUP.md.
 */
export async function upsertLedgerRow(
  row: LedgerRow,
  existingPageId?: string | null
): Promise<string | null> {
  if (!client || !databaseId) {
    console.log(
      `[notion] skipped sync for "${row.title}" — NOTION_TOKEN/NOTION_DATABASE_ID not configured`
    );
    return null;
  }

  const properties = {
    Name: { title: [{ text: { content: row.title } }] },
    Date: { date: { start: row.date.toISOString().slice(0, 10) } },
    Amount: { number: row.amountCents / 100 },
    Property: { select: { name: row.property ?? "Company Overhead" } },
    Category: { select: { name: CATEGORY_LABELS[row.category] } },
    "Payment Method": { select: { name: PAYMENT_METHOD_LABELS[row.paymentMethod] } },
    "Needs Review": { checkbox: row.needsReview },
    ...(row.fileUrl ? { File: { url: row.fileUrl } } : {}),
  };

  if (existingPageId) {
    await client.pages.update({ page_id: existingPageId, properties });
    return existingPageId;
  }

  const created = await client.pages.create({
    parent: { database_id: databaseId },
    properties,
  });
  return created.id;
}

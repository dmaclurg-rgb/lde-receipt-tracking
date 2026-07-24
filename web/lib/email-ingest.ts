import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { createReceipt } from "@/lib/receipts";
import { resolveReceiptSuggestion } from "@/lib/receipt-resolution";
import { extractAmountCents } from "@/lib/amount-extract";
import { searchVendorEmails, type EmailMatch } from "@/lib/gmail";

const DEFAULT_LOOKBACK_DAYS = 14;

function pickAttachment(match: EmailMatch): { filename: string; mimeType: string; buffer: Buffer } | null {
  const pdf = match.attachments.find((a) => a.mimeType === "application/pdf");
  if (pdf) return { filename: pdf.filename, mimeType: pdf.mimeType, buffer: pdf.data };

  const image = match.attachments.find((a) => a.mimeType === "image/jpeg" || a.mimeType === "image/png");
  if (image) return { filename: image.filename, mimeType: image.mimeType, buffer: image.data };

  return null;
}

/** Renders the email's key details into a simple PDF, for messages with no usable attachment (e.g. an HTML-only order confirmation). */
async function renderFallbackPdf(match: EmailMatch): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(14).text(match.subject);
  doc.fontSize(9).fillColor("#555").text(`From: ${match.from}`);
  doc.text(`Date: ${match.date.toISOString()}`);
  doc.fillColor("#000");
  doc.moveDown(1);
  doc.fontSize(10).text(match.bodyText.slice(0, 5000) || "(no message body)");
  doc.end();
  return done;
}

export interface SyncResult {
  email: string;
  created: number;
  error?: string;
}

/** Syncs one connected inbox: finds new vendor emails since its last sync (or a 14-day lookback if never synced), and creates a needs-review Receipt for each. */
export async function syncEmailAccount(accountId: string): Promise<SyncResult> {
  const account = await prisma.emailAccount.findUniqueOrThrow({ where: { id: accountId } });

  try {
    const since = account.lastSyncedAt ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const existing = await prisma.receipt.findMany({
      where: { emailMessageId: { not: null } },
      select: { emailMessageId: true },
    });
    const seen = new Set(existing.map((r) => r.emailMessageId!));

    const matches = await searchVendorEmails(account.refreshToken, since, seen);

    let created = 0;
    for (const match of matches) {
      const picked = pickAttachment(match);
      const buffer = picked?.buffer ?? (await renderFallbackPdf(match));
      const filename = picked?.filename ?? `${match.subject.slice(0, 60).replace(/[/\\]/g, "-")}.pdf`;
      const mimeType = picked?.mimeType ?? "application/pdf";

      // Email subject/body is machine-generated vendor copy, not a human
      // describing the purchase (unlike a Slack caption) — so unlike
      // Slack, a resolution hit here is only ever passed through as a
      // suggestion, never auto-confirmed. See resolveReceiptSuggestion.
      const propertySuggestion = await resolveReceiptSuggestion(match.subject).catch(() => null);
      // Vendor emails usually state the charged amount somewhere in the
      // subject/body — if we can confidently pick out one dollar figure,
      // createReceipt() tries to auto-link this to the matching card
      // charge instead of leaving it as a standalone needs-review item.
      const amountHintCents = extractAmountCents(`${match.subject}\n${match.bodyText}`) ?? undefined;

      await createReceipt({
        buffer,
        filename,
        mimeType,
        property: null, // needs an admin's category/property assignment — see the Review page
        description: match.subject,
        paymentMethod: null,
        source: "email_auto",
        uploadedBy: account.email,
        capturedAt: match.date,
        emailMessageId: match.messageId,
        propertySuggestion,
        amountHintCents,
      });
      created++;
    }

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
    return { email: account.email, created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { lastSyncError: message },
    });
    return { email: account.email, created: 0, error: message };
  }
}

export async function syncAllEmailAccounts(): Promise<SyncResult[]> {
  const accounts = await prisma.emailAccount.findMany();
  const results: SyncResult[] = [];
  // Sequential, not parallel — Gmail per-user rate limits are generous but
  // this runs unattended on a cron; there's no reason to race them.
  for (const account of accounts) {
    results.push(await syncEmailAccount(account.id));
  }
  return results;
}

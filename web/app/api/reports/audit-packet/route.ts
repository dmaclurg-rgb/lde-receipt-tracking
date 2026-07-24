import PDFDocument from "pdfkit";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { PAYMENT_METHOD_LABELS, CATEGORY_LABELS } from "@/lib/constants";

function monthBounds(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function money(cents: number): string {
  const dollars = cents / 100;
  return dollars < 0 ? `-$${Math.abs(dollars).toFixed(2)}` : `$${dollars.toFixed(2)}`;
}

// pdfkit can only embed JPEG/PNG directly; anything else (PDF invoices,
// HEIC, etc.) gets listed as a linked attachment instead of inlined.
function isEmbeddableImage(mimeType: string | null): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png";
}

export async function GET(request: Request) {
  if (!(await currentAdmin())) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const monthStr = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const { start, end } = monthBounds(monthStr);

  const [transactions, receipts] = await Promise.all([
    prisma.transaction.findMany({
      where: { txnDate: { gte: start, lt: end } },
      include: { property: true },
      orderBy: { txnDate: "asc" },
    }),
    prisma.receipt.findMany({
      where: { capturedAt: { gte: start, lt: end } },
      include: { property: true },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const monthLabel = new Date(start).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // --- Cover / summary page ---
  doc.addPage();
  doc.fontSize(20).text("Luxury Desert Escapes", { align: "center" });
  doc.fontSize(14).text("Expense Audit Packet", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#555").text(monthLabel, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(2);
  doc.fontSize(10).text(
    `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} and ` +
      `${receipts.length} receipt${receipts.length === 1 ? "" : "s"} on file for this period. ` +
      `Generated ${new Date().toISOString().slice(0, 10)}.`
  );

  // --- Section 1: Transactions ---
  doc.addPage();
  doc.fontSize(16).text("Transactions", { underline: true });
  doc.moveDown(0.5);

  for (const t of transactions) {
    if (doc.y > doc.page.height - 150) doc.addPage();
    doc.fontSize(10).fillColor("#000");
    doc.text(`${t.txnDate.toISOString().slice(0, 10)}   ${money(t.amountCents)}   ${PAYMENT_METHOD_LABELS[t.paymentMethod]}`, {
      continued: false,
    });
    doc.fontSize(10).fillColor("#333").text(t.description);
    const propertyLabel = t.property?.name ?? (t.category ? CATEGORY_LABELS[t.category] : "Unassigned");
    doc.fontSize(9).fillColor("#555").text(
      `${propertyLabel}${t.needsReview ? "  •  NEEDS REVIEW" : ""}`
    );
    if (t.notes) {
      doc.fontSize(9).fillColor("#777").text(`Note: ${t.notes}`);
    }
    doc.fillColor("#000");
    doc.moveDown(0.75);
  }
  if (transactions.length === 0) {
    doc.fontSize(10).fillColor("#777").text("No transactions recorded for this period.");
    doc.fillColor("#000");
  }

  // --- Section 2: Receipts on file, with photos ---
  doc.addPage();
  doc.fontSize(16).text("Receipts on File", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#777").text(
    "Every receipt captured this period, with its photo where available. Not yet " +
      "matched line-by-line to a specific transaction above — cross-reference by date/amount."
  );
  doc.fillColor("#000");
  doc.moveDown(1);

  for (const r of receipts) {
    if (doc.y > doc.page.height - 220) doc.addPage();

    const propertyLabel = r.property?.name ?? CATEGORY_LABELS[r.category];
    doc.fontSize(10).fillColor("#000").text(
      `${r.capturedAt.toISOString().slice(0, 10)}   ${propertyLabel}` +
        (r.paymentMethod ? `   ${PAYMENT_METHOD_LABELS[r.paymentMethod]}` : "")
    );
    doc.fontSize(10).fillColor("#333").text(r.description);
    doc.fontSize(8).fillColor("#999").text(`Uploaded by ${r.uploadedBy}`);
    doc.fillColor("#000");
    doc.moveDown(0.3);

    if (isEmbeddableImage(r.mimeType)) {
      try {
        const buffer = await storage.read({ fileId: r.fileId, storagePath: r.storagePath });
        if (doc.y > doc.page.height - 260) doc.addPage();
        doc.image(buffer, { fit: [220, 220] });
      } catch {
        doc.fontSize(9).fillColor("#c00").text("(Could not load receipt image)");
        doc.fillColor("#000");
      }
    } else if (r.fileUrl) {
      doc.fontSize(9).fillColor("#0066cc").text(`Attachment: ${r.filename ?? "file"}`, {
        link: r.fileUrl,
        underline: true,
      });
      doc.fillColor("#000");
    }
    doc.moveDown(1);
  }
  if (receipts.length === 0) {
    doc.fontSize(10).fillColor("#777").text("No receipts on file for this period.");
    doc.fillColor("#000");
  }

  doc.end();
  const pdfBuffer = await done;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="LDE-audit-packet-${monthStr}.pdf"`,
    },
  });
}

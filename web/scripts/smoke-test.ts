/**
 * Exercises the storage + database + Notion-sync wiring directly (bypassing
 * HTTP/auth), for a quick "did I break the pipes" check during development.
 *
 * Run with: npx tsx scripts/smoke-test.ts
 */
import { prisma } from "../lib/prisma";
import { storage, storageBackend } from "../lib/storage";
import { upsertLedgerRow, notionConfigured } from "../lib/notion";

async function main() {
  console.log(`Storage backend: ${storageBackend}`);
  console.log(`Notion sync configured: ${notionConfigured}`);

  const property = await prisma.property.findFirst({ orderBy: { name: "asc" } });
  if (!property) throw new Error("No properties seeded — run: npx tsx prisma/seed.ts");
  console.log(`Using property: ${property.name}`);

  const stored = await storage.save({
    buffer: Buffer.from("smoke-test receipt contents"),
    filename: "smoke-test.txt",
    mimeType: "text/plain",
    year: 2026,
    month: 7,
    folderLabel: property.name,
  });
  console.log("Stored file:", stored);

  const receipt = await prisma.receipt.create({
    data: {
      fileId: stored.fileId,
      fileUrl: stored.fileUrl,
      storagePath: stored.storagePath,
      uploadedBy: "smoke-test@local",
      category: "property",
      propertyId: property.id,
      description: "Smoke test receipt — safe to delete",
      paymentMethod: "bank_transfer",
      source: "app_upload",
    },
  });
  console.log("Created receipt:", receipt.id);

  const notionPageId = await upsertLedgerRow({
    title: receipt.description,
    date: new Date(),
    amountCents: 0,
    property: property.name,
    category: "property",
    paymentMethod: "bank_transfer",
    needsReview: true,
    fileUrl: stored.fileUrl,
  });
  console.log("Notion page id (null expected until NOTION_TOKEN is set):", notionPageId);

  await prisma.receipt.delete({ where: { id: receipt.id } });
  console.log("Cleaned up smoke-test receipt row. All checks passed.");
}

main()
  .catch((err) => {
    console.error("Smoke test FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

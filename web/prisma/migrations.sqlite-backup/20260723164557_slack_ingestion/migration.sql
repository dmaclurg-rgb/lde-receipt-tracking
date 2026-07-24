-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT,
    "fileUrl" TEXT,
    "storagePath" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "propertyId" TEXT,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notionPageId" TEXT,
    "slackChannel" TEXT,
    "slackTs" TEXT,
    CONSTRAINT "Receipt_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("capturedAt", "category", "createdAt", "description", "fileId", "fileUrl", "id", "notionPageId", "paymentMethod", "propertyId", "source", "storagePath", "uploadedBy") SELECT "capturedAt", "category", "createdAt", "description", "fileId", "fileUrl", "id", "notionPageId", "paymentMethod", "propertyId", "source", "storagePath", "uploadedBy" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE INDEX "Receipt_capturedAt_idx" ON "Receipt"("capturedAt");
CREATE INDEX "Receipt_propertyId_idx" ON "Receipt"("propertyId");
CREATE INDEX "Receipt_slackChannel_slackTs_idx" ON "Receipt"("slackChannel", "slackTs");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

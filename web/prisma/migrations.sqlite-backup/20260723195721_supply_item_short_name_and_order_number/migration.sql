/*
  Warnings:

  - Added the required column `orderNumber` to the `SupplyOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SupplyItem" ADD COLUMN "shortName" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupplyOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "requestedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "orderedByEmail" TEXT,
    "orderedAt" DATETIME,
    "orderConfirmation" TEXT,
    "expectedDelivery" DATETIME,
    "deliveredAt" DATETIME,
    "deliveryNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplyOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Backfill orderNumber for pre-existing rows (dev/test data only) by
-- assigning sequential numbers in createdAt order.
INSERT INTO "new_SupplyOrder" ("createdAt", "deliveredAt", "deliveryNotes", "expectedDelivery", "id", "notes", "orderConfirmation", "orderedAt", "orderedByEmail", "orderNumber", "propertyId", "requestedByEmail", "requestedByName", "status", "updatedAt")
SELECT "createdAt", "deliveredAt", "deliveryNotes", "expectedDelivery", "id", "notes", "orderConfirmation", "orderedAt", "orderedByEmail", ROW_NUMBER() OVER (ORDER BY "createdAt"), "propertyId", "requestedByEmail", "requestedByName", "status", "updatedAt" FROM "SupplyOrder";
DROP TABLE "SupplyOrder";
ALTER TABLE "new_SupplyOrder" RENAME TO "SupplyOrder";
CREATE UNIQUE INDEX "SupplyOrder_orderNumber_key" ON "SupplyOrder"("orderNumber");
CREATE INDEX "SupplyOrder_propertyId_idx" ON "SupplyOrder"("propertyId");
CREATE INDEX "SupplyOrder_status_idx" ON "SupplyOrder"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT,
    "fileUrl" TEXT,
    "storagePath" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "propertyId" TEXT,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notionPageId" TEXT,
    CONSTRAINT "Receipt_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "issuer" TEXT,
    "last4" TEXT,
    "txnDate" DATETIME NOT NULL,
    "postDate" DATETIME,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "category" TEXT,
    "propertyId" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "isSplit" BOOLEAN NOT NULL DEFAULT false,
    "sourceFile" TEXT,
    "notionPageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransactionReceipt" (
    "transactionId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,

    PRIMARY KEY ("transactionId", "receiptId"),
    CONSTRAINT "TransactionReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransactionReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_name_key" ON "Property"("name");

-- CreateIndex
CREATE INDEX "Receipt_capturedAt_idx" ON "Receipt"("capturedAt");

-- CreateIndex
CREATE INDEX "Receipt_propertyId_idx" ON "Receipt"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_txnDate_idx" ON "Transaction"("txnDate");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_needsReview_idx" ON "Transaction"("needsReview");

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "filename" TEXT,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "notes" TEXT;

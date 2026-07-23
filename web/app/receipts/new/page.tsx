import { prisma } from "@/lib/prisma";
import NewReceiptForm from "./NewReceiptForm";

export default async function NewReceiptPage() {
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-2xl font-semibold">Add Receipt</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Works the same on your phone or desktop — take a photo on the go, or
        upload a file for anything Slack/email didn&apos;t catch.
      </p>
      <NewReceiptForm properties={properties} />
    </main>
  );
}

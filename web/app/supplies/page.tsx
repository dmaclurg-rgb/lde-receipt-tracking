import { prisma } from "@/lib/prisma";
import SuppliesNav from "./SuppliesNav";
import OrderForm from "./OrderForm";

export default async function SuppliesOrderingPage() {
  const [properties, items] = await Promise.all([
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplyItem.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const catalog = items.map((item) => ({
    id: item.id,
    name: item.name,
    vendor: item.vendor,
    url: item.url,
    imageUrl: item.imageUrl,
    alternativeNote: item.alternativeNote,
    notes: item.notes,
    isCommon: item.isCommon,
    sizeOptions: (item.sizeOptions as string[] | null) ?? null,
  }));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Order Supplies</h1>
      <SuppliesNav />
      <p className="mb-6 text-sm text-neutral-500">
        Pick a property, add what you need, and submit — the office places the
        order from the order sheet this creates.
      </p>
      <OrderForm properties={properties} catalog={catalog} />
    </main>
  );
}

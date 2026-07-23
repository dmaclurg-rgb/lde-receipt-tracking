import { prisma } from "@/lib/prisma";
import SuppliesNav from "../SuppliesNav";
import CatalogItemRow from "./CatalogItemRow";
import NewItemForm from "./NewItemForm";

export default async function SupplyCatalogPage() {
  const items = await prisma.supplyItem.findMany({ orderBy: { name: "asc" } });

  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    vendor: item.vendor,
    url: item.url,
    imageUrl: item.imageUrl,
    alternativeNote: item.alternativeNote,
    isCommon: item.isCommon,
    sizeOptions: (item.sizeOptions as string[] | null) ?? null,
    active: item.active,
  }));

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Supply Catalog</h1>
      <SuppliesNav />
      <p className="mb-6 text-sm text-neutral-500">
        Edit item links, photos, and flags here — changes show up on the
        ordering page immediately.
      </p>

      <div className="mb-8">
        <NewItemForm />
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((item) => (
          <CatalogItemRow key={item.id} item={item} />
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No catalog items yet.</p>
        )}
      </div>
    </main>
  );
}

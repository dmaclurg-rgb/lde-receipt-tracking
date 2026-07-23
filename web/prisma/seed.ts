// Seeds the Property table from seed-properties.json, which is generated
// from receipt-recon/houses.py (the matcher's source of truth) via
// `python3 receipt-recon/export_houses.py`. Re-run that export, then this
// seed, whenever houses.py's HOUSES tuple changes.
//
// Also seeds the SupplyItem catalog from seed-supply-items.json, generated
// once from the team's supply spreadsheet (see that file's own comment for
// how to regenerate it).
import { PrismaClient, type SupplyVendor } from "@prisma/client";
import properties from "./seed-properties.json";
import supplyItems from "./seed-supply-items.json";

const prisma = new PrismaClient();

interface SeedSupplyItem {
  name: string;
  vendor: SupplyVendor;
  url: string | null;
  alternativeNote: string | null;
  notes: string | null;
  isCommon: boolean;
  sizeOptions: string[] | null;
}

async function main() {
  for (const name of properties as string[]) {
    await prisma.property.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${properties.length} properties.`);

  for (const item of supplyItems as SeedSupplyItem[]) {
    await prisma.supplyItem.upsert({
      where: { name: item.name },
      update: {},
      create: {
        name: item.name,
        vendor: item.vendor,
        url: item.url,
        alternativeNote: item.alternativeNote,
        notes: item.notes,
        isCommon: item.isCommon,
        sizeOptions: item.sizeOptions ?? undefined,
      },
    });
  }
  console.log(`Seeded ${supplyItems.length} supply items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

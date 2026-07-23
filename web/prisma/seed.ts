// Seeds the Property table from seed-properties.json, which is generated
// from receipt-recon/houses.py (the matcher's source of truth) via
// `python3 receipt-recon/export_houses.py`. Re-run that export, then this
// seed, whenever houses.py's HOUSES tuple changes.
import { PrismaClient } from "@prisma/client";
import properties from "./seed-properties.json";

const prisma = new PrismaClient();

async function main() {
  for (const name of properties as string[]) {
    await prisma.property.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${properties.length} properties.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

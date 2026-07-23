/**
 * Exercises the full statement pipeline — FastAPI matching service ->
 * persistence -> Notion sync — bypassing HTTP/auth, using the synthetic HD
 * CSV at receipt-recon/data/test_hd.csv (2 rows, no matching card charge so
 * both land as orphans/home_depot_card transactions needing review since
 * "Wanderlust" and "Stallion Ranch" resolve to real properties).
 *
 * Requires receipt-recon/service.py running on MATCHING_SERVICE_URL.
 * Run with: npx tsx scripts/smoke-test-statement.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { reconcileStatements } from "../lib/matching-service";
import { persistReconcileResult } from "../lib/persist-reconcile";

async function main() {
  const csvPath = path.join(
    process.cwd(),
    "..",
    "receipt-recon",
    "data",
    "test_hd.csv"
  );
  const buffer = await readFile(csvPath);
  const file = new File([buffer], "test_hd.csv", { type: "text/csv" });

  const result = await reconcileStatements([file]);
  console.log(
    `Matching service returned: ${result.matches.length} matches, ` +
      `${result.unmatched.length} unmatched, ${result.orphans.length} orphans`
  );

  const summary = await persistReconcileResult(result);
  console.log("Persisted summary:", summary);

  const created = await prisma.transaction.findMany({
    where: { sourceFile: { contains: "test_hd.csv" } },
    include: { property: true },
  });
  for (const t of created) {
    console.log(
      `  ${t.txnDate.toISOString().slice(0, 10)} ${t.description} ` +
        `-> ${t.property?.name ?? "unassigned"} (needsReview=${t.needsReview})`
    );
  }

  await prisma.transaction.deleteMany({ where: { sourceFile: { contains: "test_hd.csv" } } });
  console.log("Cleaned up test transactions.");
}

main()
  .catch((err) => {
    console.error("Smoke test FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

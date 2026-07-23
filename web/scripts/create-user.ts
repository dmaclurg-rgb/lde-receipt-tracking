/**
 * Creates or updates a team member's login. There's no self-service
 * signup — the admin (CEO) runs this to hand out credentials directly.
 *
 * Usage: npx tsx scripts/create-user.ts <email> <password> [display name]
 *
 * Run this against whichever DATABASE_URL is active — locally against
 * dev.db, or with production's DATABASE_URL set in the environment to
 * create/update a real team login.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const [, , emailArg, password, ...nameParts] = process.argv;
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ") || undefined;

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [display name]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });
  console.log(`Login ready for ${user.email}${name ? ` (${name})` : ""}.`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

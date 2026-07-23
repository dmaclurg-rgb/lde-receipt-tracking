/**
 * Creates or updates a team member's login. Also used to bootstrap the
 * first admin — after that, admins can create/update logins from the
 * /team page in the app instead of running this script.
 *
 * Usage: npx tsx scripts/create-user.ts <email> <password> [display name] [--admin]
 *
 * Run this against whichever DATABASE_URL is active — locally against
 * dev.db, or with production's DATABASE_URL set in the environment to
 * create/update a real team login.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const isAdmin = args.includes("--admin");
  const [emailArg, password, ...nameParts] = args.filter((a) => a !== "--admin");
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ") || undefined;

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts <email> <password> [display name] [--admin]"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, isAdmin },
    create: { email, passwordHash, name, isAdmin },
  });
  console.log(
    `Login ready for ${user.email}${name ? ` (${name})` : ""}${user.isAdmin ? " — admin" : ""}.`
  );
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

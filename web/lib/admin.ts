import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Returns the signed-in User row if they're an admin, otherwise null. */
export async function currentAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user?.isAdmin ? user : null;
}

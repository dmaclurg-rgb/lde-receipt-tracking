import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { password, name, isAdmin } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, isAdmin: isAdmin ?? false },
    create: { email, passwordHash, name, isAdmin: isAdmin ?? false },
    select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}

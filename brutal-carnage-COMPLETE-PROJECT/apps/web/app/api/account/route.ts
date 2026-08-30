// app/api/account/route.ts
// Self-service: any logged-in member can change their own username
// and/or password, provided they confirm their current password.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAccountSchema } from "@/lib/validators/members";
import { hashPassword } from "@/lib/credentials";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { currentPassword, newUsername, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const validCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  if (newUsername && newUsername !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username: newUsername } });
    if (taken) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
  }

  const data: { username?: string; passwordHash?: string; mustChangePassword?: boolean } = {};
  if (newUsername) data.username = newUsername;
  if (newPassword) {
    data.passwordHash = await hashPassword(newPassword);
    data.mustChangePassword = false;
  }

  await prisma.user.update({ where: { id: user.id }, data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ACCOUNT_SELF_UPDATED",
      metadata: { changedUsername: Boolean(newUsername), changedPassword: Boolean(newPassword) },
    },
  });

  return NextResponse.json({ success: true, username: data.username ?? user.username });
}

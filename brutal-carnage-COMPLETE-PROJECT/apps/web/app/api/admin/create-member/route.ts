// app/api/admin/create-member/route.ts
// Manual ID/password creation, for Deputy+. Sits alongside the Discord
// bot's automatic provisioning (bot/src/events/guildMemberAdd.ts) — this
// route never touches Discord at all, it just directly creates a User
// row with a generated username-safe login and a one-time temp password
// that's returned ONLY in this response (never stored in plaintext,
// never logged) for the admin to hand to the member themselves.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createMemberSchema } from "@/lib/validators/members";
import {
  generateTempPassword,
  generatePlaceholderDiscordId,
  hashPassword,
} from "@/lib/credentials";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canCreateMemberManually")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { username, rank, gameId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  if (gameId) {
    const existingGameId = await prisma.user.findUnique({ where: { gameId } });
    if (existingGameId) {
      return NextResponse.json({ error: "That game ID is already linked to another account" }, { status: 409 });
    }
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      username,
      rank,
      gameId: gameId || null,
      discordId: generatePlaceholderDiscordId(),
      passwordHash,
      mustChangePassword: true,
      createdManually: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MEMBER_CREATED_MANUALLY",
      metadata: { createdUserId: user.id, username: user.username, rank: user.rank },
    },
  });

  // Plaintext password is returned exactly once, here, and nowhere else.
  return NextResponse.json(
    {
      user: { id: user.id, username: user.username, rank: user.rank },
      tempPassword,
    },
    { status: 201 }
  );
}

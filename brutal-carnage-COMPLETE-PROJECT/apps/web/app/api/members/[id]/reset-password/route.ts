// app/api/members/[id]/reset-password/route.ts
// Deputy+ can reset an existing member's login password (e.g. they lost
// it, or it needs rotating). This never reads the old password — bcrypt
// hashes are one-way, so an existing plaintext password can never be
// recovered, only replaced. The new temp password is generated here,
// hashed for storage, and returned in this response ONLY — same
// one-time-reveal pattern as create-member. mustChangePassword is set
// so the member is forced to pick their own password on next login.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { generateTempPassword, hashPassword } from "@/lib/credentials";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canResetMemberPassword")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.user.findUnique({ where: { id: params.id } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: member.id },
    data: { passwordHash, mustChangePassword: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MEMBER_PASSWORD_RESET",
      metadata: { targetUserId: member.id, username: member.username },
    },
  });

  // Plaintext password is returned exactly once, here, and nowhere else.
  return NextResponse.json({ username: member.username, tempPassword });
}

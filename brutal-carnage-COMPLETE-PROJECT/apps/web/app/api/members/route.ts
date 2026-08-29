// app/api/members/route.ts
// Powers the /members directory: search by username, filter by rank
// and blacklist status. Kept as one flexible GET rather than separate
// endpoints per filter, since the page needs to combine them freely.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Rank } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const rank = searchParams.get("rank") as Rank | null;
  const blacklistedParam = searchParams.get("blacklisted");

  const members = await prisma.user.findMany({
    where: {
      username: q ? { contains: q, mode: "insensitive" } : undefined,
      rank: rank ?? undefined,
      isBlacklisted:
        blacklistedParam === "true" ? true : blacklistedParam === "false" ? false : undefined,
    },
    select: {
      id: true,
      username: true,
      discordAvatar: true,
      rank: true,
      isBlacklisted: true,
      blacklistReason: true,
      lastActiveAt: true,
      joinedFamilyAt: true,
    },
    orderBy: { username: "asc" },
    take: 200,
  });

  return NextResponse.json({ members });
}

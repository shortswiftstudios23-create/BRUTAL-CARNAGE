// app/api/admin/seed-warehouse/route.ts
//
// Same import as prisma/seed-warehouse.ts, but runnable as a one-time
// HTTP request on Vercel instead of a local terminal command. Vercel's
// serverless functions already have the production DATABASE_URL wired
// in — nothing to copy/paste. Deploy this once, hit the URL once, then
// remove it (see SEED_ONE_TIME_SECRET below).
//
// SETUP (one time):
//   1. In Vercel: your project -> Settings -> Environment Variables ->
//      add a new variable SEED_ONE_TIME_SECRET, value = any random
//      string you make up (mash your keyboard). Save, then redeploy
//      (Vercel prompts you to on save, or push any commit).
//   2. Once deployed, visit in your browser:
//        https://brutalcarnage.vercel.app/api/admin/seed-warehouse?secret=YOUR_SECRET_HERE
//   3. Read the JSON it returns — it includes Deadly Khan's one-time
//      temp password under credentials. Copy it immediately and hand
//      it to him privately; it is never shown again after this request.
//   4. Safe to visit more than once (it upserts/skips existing data),
//      but there's no reason to — once it's run, delete this file (or
//      the whole api/admin/seed-warehouse folder) and redeploy, so the
//      endpoint doesn't sit there permanently.
//
// PERFORMANCE NOTE: the item catalog and item-action import are done
// with a handful of batched queries (findMany + createMany) instead of
// one query per row. The original version issued a separate DB
// round-trip for every item and every log entry (1000+ total for a
// few hundred rows), which is what was timing out. Batching keeps this
// to well under twenty queries regardless of dataset size. maxDuration
// below is just a safety margin, not a fix on its own.

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Rank, ItemActionType, ApprovalStatus } from "@prisma/client";
import { generateTempPassword, generatePlaceholderDiscordId, hashPassword } from "@/lib/credentials";
import warehouseData from "@/prisma/seed-data/warehouse-import.json";

// Node function timeout override for this route only. 60 is the max on
// Vercel Hobby; Pro/Enterprise can go higher. The batched queries below
// should finish in a few seconds, but this gives headroom.
export const maxDuration = 60;

const prisma = new PrismaClient();

const EXISTING_ACCOUNT_USERNAMES: Record<string, { username: string; rank: Rank }> = {
  "256642": { username: "mesbahhasin233813", rank: "BOSS" }, // Deadly Mesbah
  "255904": { username: "stargamermj6063", rank: "BOSS" }, // Deadly Ocean
};

const NEW_ACCOUNTS: Record<string, { username: string; rank: Rank }> = {
  "95900": { username: "Deadly Khan", rank: "BIG_BOSS" }, // Deadly Khan
};

type LogEntry = { gameId: string; playerName: string; item: string; quantity: number; date: string | null };

export async function GET(req: NextRequest) {
  const secret = process.env.SEED_ONE_TIME_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized — set SEED_ONE_TIME_SECRET in Vercel env vars and pass ?secret=" }, { status: 401 });
  }

  const log: string[] = [];
  const credentials: { username: string; gameId: string; rank: string; tempPassword: string }[] = [];

  // --- Link existing accounts (small, fixed list — left as simple awaits) ---
  for (const [gameId, { username, rank }] of Object.entries(EXISTING_ACCOUNT_USERNAMES)) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) {
      log.push(`! Couldn't find existing account "${username}" for gameId ${gameId} — skipped.`);
      continue;
    }
    if (existing.gameId && existing.gameId !== gameId) {
      log.push(`! "${username}" already has a different gameId linked — left as-is.`);
      continue;
    }
    await prisma.user.update({ where: { id: existing.id }, data: { gameId, rank } });
    log.push(`Linked gameId ${gameId} to existing account "${username}", rank set to ${rank}.`);
  }

  // --- Create new accounts (small, fixed list — left as simple awaits) ---
  for (const [gameId, { username, rank }] of Object.entries(NEW_ACCOUNTS)) {
    const existingByGameId = await prisma.user.findUnique({ where: { gameId } });
    if (existingByGameId) {
      log.push(`${username} (gameId ${gameId}) already exists — skipped creation.`);
      if (existingByGameId.rank !== rank) {
        await prisma.user.update({ where: { id: existingByGameId.id }, data: { rank } });
        log.push(`  -> rank updated to ${rank}`);
      }
      continue;
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    const finalUsername = usernameTaken ? `${username} (${gameId})` : username;

    await prisma.user.create({
      data: {
        username: finalUsername,
        gameId,
        rank,
        discordId: generatePlaceholderDiscordId(),
        passwordHash,
        mustChangePassword: true,
        createdManually: true,
      },
    });
    credentials.push({ username: finalUsername, gameId, rank, tempPassword });
    log.push(`Created new account "${finalUsername}" (${rank}).`);
  }

  // --- Item catalog: batched instead of one upsert per item ---
  const itemEntries = Object.entries(warehouseData.items) as [string, { suggestedPrice: number; currentStock: number }][];
  const itemNames = itemEntries.map(([name]) => name);

  const existingItems = await prisma.item.findMany({ where: { name: { in: itemNames } } });
  const existingItemNames = new Set(existingItems.map((i) => i.name));

  const itemsToCreate = itemEntries.filter(([name]) => !existingItemNames.has(name));
  const itemsToUpdate = itemEntries.filter(([name]) => existingItemNames.has(name));

  if (itemsToCreate.length) {
    await prisma.item.createMany({
      data: itemsToCreate.map(([name, info]) => ({ name, suggestedPrice: info.suggestedPrice, currentStock: info.currentStock })),
      skipDuplicates: true,
    });
  }
  if (itemsToUpdate.length) {
    // Grouped in one transaction (single connection, no per-statement
    // reconnect) rather than one upsert per item.
    await prisma.$transaction(
      itemsToUpdate.map(([name, info]) =>
        prisma.item.update({ where: { name }, data: { suggestedPrice: info.suggestedPrice, currentStock: info.currentStock } })
      )
    );
  }

  const allItems = await prisma.item.findMany({ where: { name: { in: itemNames } } });
  const itemByName = new Map(allItems.map((i) => [i.name, i.id]));
  log.push(`${itemByName.size} catalog items upserted.`);

  // --- Resolve every player referenced anywhere in the logs, batched ---
  const putLog = warehouseData.putLog as LogEntry[];
  const tookLog = warehouseData.tookLog as LogEntry[];

  const playerNameByGameId = new Map<string, string>();
  for (const entry of [...putLog, ...tookLog]) {
    if (!playerNameByGameId.has(entry.gameId)) playerNameByGameId.set(entry.gameId, entry.playerName);
  }
  const allGameIds = [...playerNameByGameId.keys()];

  const existingUsers = allGameIds.length
    ? await prisma.user.findMany({ where: { gameId: { in: allGameIds } } })
    : [];
  const userIdByGameId = new Map(existingUsers.map((u) => [u.gameId as string, u.id]));
  const missingGameIds = allGameIds.filter((id) => !userIdByGameId.has(id));

  if (missingGameIds.length) {
    const desiredUsernames = missingGameIds.map((id) => playerNameByGameId.get(id)!);
    const usernameClashes = await prisma.user.findMany({
      where: { username: { in: desiredUsernames } },
      select: { username: true },
    });
    const takenUsernames = new Set(usernameClashes.map((u) => u.username));

    const newUsersData = await Promise.all(
      missingGameIds.map(async (gameId) => {
        const playerName = playerNameByGameId.get(gameId)!;
        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        const username = takenUsernames.has(playerName) ? `${playerName} (${gameId})` : playerName;
        credentials.push({ username, gameId, rank: "unranked", tempPassword });
        return {
          username,
          gameId,
          discordId: generatePlaceholderDiscordId(),
          passwordHash,
          mustChangePassword: true,
          createdManually: true,
        };
      })
    );

    await prisma.user.createMany({ data: newUsersData, skipDuplicates: true });

    const created = await prisma.user.findMany({ where: { gameId: { in: missingGameIds } } });
    for (const u of created) userIdByGameId.set(u.gameId as string, u.id);
  }
  log.push(`${missingGameIds.length} new player account(s) created from logs, ${existingUsers.length} already existed.`);

  // --- Item actions: batched dedupe + batched insert instead of a
  //     findFirst + create per log line ---
  async function importAll(entries: LogEntry[], type: ItemActionType) {
    const rows = entries
      .map((entry) => {
        const itemId = itemByName.get(entry.item);
        const userId = userIdByGameId.get(entry.gameId);
        if (!itemId || !userId) return null;
        const occurredAt = entry.date ? new Date(entry.date) : new Date();
        return {
          userId,
          itemId,
          type,
          quantity: entry.quantity,
          status: "APPROVED" as ApprovalStatus,
          note: "Imported from warehouse spreadsheet",
          occurredAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (!rows.length) return 0;

    const existing = await prisma.itemAction.findMany({
      where: {
        type,
        userId: { in: [...new Set(rows.map((r) => r.userId))] },
        itemId: { in: [...new Set(rows.map((r) => r.itemId))] },
      },
      select: { userId: true, itemId: true, quantity: true, occurredAt: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.userId}|${e.itemId}|${e.quantity}|${e.occurredAt?.toISOString()}`));

    const seenThisBatch = new Set<string>();
    const toInsert = rows.filter((r) => {
      const key = `${r.userId}|${r.itemId}|${r.quantity}|${r.occurredAt.toISOString()}`;
      if (existingKeys.has(key) || seenThisBatch.has(key)) return false;
      seenThisBatch.add(key);
      return true;
    });

    if (toInsert.length) await prisma.itemAction.createMany({ data: toInsert });
    return toInsert.length;
  }

  const putCount = await importAll(putLog, ItemActionType.DONATE);
  const tookCount = await importAll(tookLog, ItemActionType.TAKE);
  log.push(`${putCount} donation entries imported, ${tookCount} take entries imported.`);

  return NextResponse.json({
    success: true,
    log,
    credentials, // temp passwords for any brand-new accounts — shown once, copy now
    reminder: "Delete this route (app/api/admin/seed-warehouse) and redeploy once you've copied the credentials above.",
  });
}

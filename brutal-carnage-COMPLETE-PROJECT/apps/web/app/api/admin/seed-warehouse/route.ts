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

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Rank, ItemActionType } from "@prisma/client";
import { generateTempPassword, generatePlaceholderDiscordId, hashPassword } from "@/lib/credentials";
import warehouseData from "@/prisma/seed-data/warehouse-import.json";

const prisma = new PrismaClient();

const EXISTING_ACCOUNT_USERNAMES: Record<string, { username: string; rank: Rank }> = {
  "256642": { username: "mesbahhasin233813", rank: "BOSS" }, // Deadly Mesbah
  "255904": { username: "stargamermj6063", rank: "BOSS" }, // Deadly Ocean
};

const NEW_ACCOUNTS: Record<string, { username: string; rank: Rank }> = {
  "95900": { username: "Deadly Khan", rank: "BIG_BOSS" }, // Deadly Khan
};

export async function GET(req: NextRequest) {
  const secret = process.env.SEED_ONE_TIME_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized — set SEED_ONE_TIME_SECRET in Vercel env vars and pass ?secret=" }, { status: 401 });
  }

  const log: string[] = [];
  const credentials: { username: string; gameId: string; rank: string; tempPassword: string }[] = [];

  // --- Link existing accounts ---
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

  // --- Create new accounts ---
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

  // --- Item catalog ---
  const itemByName = new Map<string, string>();
  for (const [name, info] of Object.entries(warehouseData.items) as [string, { suggestedPrice: number; currentStock: number }][]) {
    const item = await prisma.item.upsert({
      where: { name },
      update: { suggestedPrice: info.suggestedPrice, currentStock: info.currentStock },
      create: { name, suggestedPrice: info.suggestedPrice, currentStock: info.currentStock },
    });
    itemByName.set(name, item.id);
  }
  log.push(`${itemByName.size} catalog items upserted.`);

  async function ensureUserByGameId(gameId: string, playerName: string): Promise<string> {
    const existing = await prisma.user.findUnique({ where: { gameId } });
    if (existing) return existing.id;
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const usernameTaken = await prisma.user.findUnique({ where: { username: playerName } });
    const username = usernameTaken ? `${playerName} (${gameId})` : playerName;
    const user = await prisma.user.create({
      data: {
        username,
        gameId,
        discordId: generatePlaceholderDiscordId(),
        passwordHash,
        mustChangePassword: true,
        createdManually: true,
      },
    });
    credentials.push({ username, gameId, rank: "unranked", tempPassword });
    return user.id;
  }

  async function importLog(
    entries: { gameId: string; playerName: string; item: string; quantity: number; date: string | null }[],
    type: ItemActionType
  ) {
    let imported = 0;
    for (const entry of entries) {
      const itemId = itemByName.get(entry.item);
      if (!itemId) continue;
      const userId = await ensureUserByGameId(entry.gameId, entry.playerName);
      const occurredAt = entry.date ? new Date(entry.date) : new Date();
      const dup = await prisma.itemAction.findFirst({ where: { userId, itemId, type, quantity: entry.quantity, occurredAt } });
      if (dup) continue;
      await prisma.itemAction.create({
        data: { userId, itemId, type, quantity: entry.quantity, status: "APPROVED", note: "Imported from warehouse spreadsheet", occurredAt },
      });
      imported++;
    }
    return imported;
  }

  const putCount = await importLog(warehouseData.putLog as any, "DONATE");
  const tookCount = await importLog(warehouseData.tookLog as any, "TAKE");
  log.push(`${putCount} donation entries imported, ${tookCount} take entries imported.`);

  return NextResponse.json({
    success: true,
    log,
    credentials, // temp passwords for any brand-new accounts — shown once, copy now
    reminder: "Delete this route (app/api/admin/seed-warehouse) and redeploy once you've copied the credentials above.",
  });
}

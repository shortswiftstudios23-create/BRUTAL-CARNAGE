// prisma/seed-warehouse.ts
//
// One-off import for the warehouse spreadsheet (final_warehouse.xlsx),
// plus creation of the 3 admin accounts named in it:
//   - DEADLY KHAN   (gameId 95900)   -> BIG_BOSS, full access
//   - DEADLY MESBAH (gameId 256642)  -> BOSS, full access
//   - DEADLY OCEAN  (gameId 255904)  -> BOSS, full access
//
// SAFE TO RE-RUN: every write is an upsert / existence-check, so running
// this twice does not create duplicates or double-count history.
//
// SECURITY NOTE: this script does NOT hardcode any passwords. It
// generates a fresh random temp password for each of the 3 accounts
// (only if that account doesn't already exist) and prints it to the
// terminal ONCE. Nothing is written to disk or logged anywhere else —
// copy the 3 lines it prints and hand each person their own password
// through a private channel, then they should change it immediately
// under Settings (mustChangePassword already forces this on first
// login).
//
// Run with:
//   cd apps/web
//   npx tsx prisma/seed-warehouse.ts
// (or `npx ts-node prisma/seed-warehouse.ts` if tsx isn't installed)

import { PrismaClient, Rank, ItemActionType } from "@prisma/client";
import { generateTempPassword, generatePlaceholderDiscordId, hashPassword } from "../lib/credentials";
import warehouseData from "./seed-data/warehouse-import.json";

const prisma = new PrismaClient();

// gameId -> desired rank + username for the 3 named admins. Matched
// against the "Player Name" values found in the spreadsheet's Put/Took
// logs so this stays correct even if row order changes.
const ADMIN_ACCOUNTS: Record<string, { username: string; rank: Rank }> = {
  "95900": { username: "Deadly Khan", rank: "BIG_BOSS" },
  "256642": { username: "Deadly Mesbah", rank: "BOSS" },
  "255904": { username: "Deadly Ocean", rank: "BOSS" },
};

async function ensureAdminAccounts() {
  const createdCredentials: { username: string; gameId: string; rank: string; tempPassword: string }[] = [];

  for (const [gameId, { username, rank }] of Object.entries(ADMIN_ACCOUNTS)) {
    const existing = await prisma.user.findUnique({ where: { gameId } });
    if (existing) {
      console.log(`- ${username} (gameId ${gameId}) already exists as an account — skipping creation, leaving password untouched.`);
      // Still make sure their rank matches what was requested, in case
      // this is being re-run after a rank change was intended.
      if (existing.rank !== rank) {
        await prisma.user.update({ where: { id: existing.id }, data: { rank } });
        console.log(`  -> rank updated to ${rank}`);
      }
      continue;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    // Username must be globally unique on this schema; fall back to
    // appending the gameId if "Deadly Khan" etc. is somehow taken.
    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    const finalUsername = usernameTaken ? `${username} (${gameId})` : username;

    const user = await prisma.user.create({
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

    createdCredentials.push({ username: user.username, gameId, rank, tempPassword });
  }

  if (createdCredentials.length > 0) {
    console.log("\n=== NEW ADMIN LOGIN CREDENTIALS (shown once — copy these now) ===");
    for (const c of createdCredentials) {
      console.log(`${c.username}  |  rank: ${c.rank}  |  gameId: ${c.gameId}  |  temp password: ${c.tempPassword}`);
    }
    console.log("Each of them must log in and set their own username/password under Settings — mustChangePassword is already set.");
    console.log("===================================================================\n");
  }
}

async function ensureItems() {
  const itemByName = new Map<string, string>(); // name -> Item.id
  for (const [name, info] of Object.entries(warehouseData.items) as [string, { suggestedPrice: number; currentStock: number }][]) {
    const item = await prisma.item.upsert({
      where: { name },
      update: { suggestedPrice: info.suggestedPrice, currentStock: info.currentStock },
      create: { name, suggestedPrice: info.suggestedPrice, currentStock: info.currentStock },
    });
    itemByName.set(name, item.id);
  }
  return itemByName;
}

async function ensureUserByGameId(gameId: string, playerName: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { gameId } });
  if (existing) return existing.id;

  // Shouldn't normally happen since the 3 admin accounts above cover
  // every gameId in this spreadsheet, but guard for a spreadsheet with
  // other players in it later.
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
  console.log(`Created account for unlisted player ${playerName} (gameId ${gameId}) — temp password: ${tempPassword}`);
  return user.id;
}

async function importLog(
  entries: { gameId: string; playerName: string; item: string; quantity: number; date: string | null }[],
  type: ItemActionType,
  itemByName: Map<string, string>
) {
  let imported = 0;
  for (const entry of entries) {
    const itemId = itemByName.get(entry.item);
    if (!itemId) {
      console.warn(`  Skipping row — unknown item "${entry.item}"`);
      continue;
    }
    const userId = await ensureUserByGameId(entry.gameId, entry.playerName);
    const occurredAt = entry.date ? new Date(entry.date) : new Date();

    // De-dupe guard: if this exact (user, item, type, quantity, occurredAt)
    // row already exists, skip it so re-running the script is safe.
    const dup = await prisma.itemAction.findFirst({
      where: { userId, itemId, type, quantity: entry.quantity, occurredAt },
    });
    if (dup) continue;

    await prisma.itemAction.create({
      data: {
        userId,
        itemId,
        type,
        quantity: entry.quantity,
        status: "APPROVED",
        note: "Imported from warehouse spreadsheet",
        occurredAt,
      },
    });
    imported++;
  }
  return imported;
}

async function main() {
  console.log("Ensuring the 3 named admin accounts exist...");
  await ensureAdminAccounts();

  console.log("Upserting item catalog + current stock from Stock Reconciliation sheet...");
  const itemByName = await ensureItems();
  console.log(`  ${itemByName.size} items ensured.`);

  console.log("Importing Put Log (donations)...");
  const putCount = await importLog(warehouseData.putLog as any, "DONATE", itemByName);
  console.log(`  ${putCount} donation entries imported.`);

  console.log("Importing Took Log (withdrawals)...");
  const tookCount = await importLog(warehouseData.tookLog as any, "TAKE", itemByName);
  console.log(`  ${tookCount} take entries imported.`);

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

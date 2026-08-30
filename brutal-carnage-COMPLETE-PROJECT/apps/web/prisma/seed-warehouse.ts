// prisma/seed-warehouse.ts
//
// One-off import for the warehouse spreadsheet (final_warehouse.xlsx).
//
// Deadly Mesbah and Deadly Ocean already have real accounts, provisioned
// by the Discord bot when they joined the server — this script attaches
// their gameId + rank + import history to THOSE existing accounts. It
// never touches their existing username or password.
//   - mesbahhasin233813  -> gameId 256642 (Deadly Mesbah) -> rank BOSS
//   - stargamermj6063    -> gameId 255904 (Deadly Ocean)  -> rank BOSS
//
// Deadly Khan has no account yet, so this creates one fresh:
//   - gameId 95900 -> rank BIG_BOSS
//
// If any of the usernames below have changed since this was written
// (e.g. someone re-ran /settings and picked a new username), update the
// EXISTING_ACCOUNT_USERNAMES map below before re-running.
//
// SAFE TO RE-RUN: every write is an upsert / existence-check, so running
// this twice does not create duplicates or double-count history.
//
// SECURITY NOTE: this script does NOT hardcode any passwords. Only
// Khan's brand-new account gets a generated temp password, printed to
// the terminal ONCE. Nothing is written to disk or logged anywhere
// else — copy it the moment it prints and hand it to Khan privately.
// mustChangePassword forces them to set their own on first login.
//
// Run with (against whichever database DATABASE_URL in apps/web/.env
// points at — for your real data this needs to be the PRODUCTION
// database, i.e. the same DATABASE_URL Vercel uses, not a local dev DB):
//   cd apps/web
//   npx tsx prisma/seed-warehouse.ts
// (or `npx ts-node prisma/seed-warehouse.ts` if tsx isn't installed)

import { PrismaClient, Rank, ItemActionType } from "@prisma/client";
import { generateTempPassword, generatePlaceholderDiscordId, hashPassword } from "../lib/credentials";
import warehouseData from "./seed-data/warehouse-import.json";

const prisma = new PrismaClient();

// Existing bot-provisioned accounts to attach gameId + rank to, keyed by
// their CURRENT username on the site. Update these if a username has
// changed since.
const EXISTING_ACCOUNT_USERNAMES: Record<string, { username: string; rank: Rank }> = {
  "256642": { username: "mesbahhasin233813", rank: "BOSS" }, // Deadly Mesbah
  "255904": { username: "stargamermj6063", rank: "BOSS" }, // Deadly Ocean
};

// Accounts that don't exist yet and need to be created from scratch.
const NEW_ACCOUNTS: Record<string, { username: string; rank: Rank }> = {
  "95900": { username: "Deadly Khan", rank: "BIG_BOSS" }, // Deadly Khan
};

async function ensureAdminAccounts() {
  const createdCredentials: { username: string; gameId: string; rank: string; tempPassword: string }[] = [];

  // Attach to existing accounts — never touch their username/password.
  for (const [gameId, { username, rank }] of Object.entries(EXISTING_ACCOUNT_USERNAMES)) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) {
      console.warn(
        `! Couldn't find an existing account named "${username}" for gameId ${gameId}. ` +
          `If their username has changed, update EXISTING_ACCOUNT_USERNAMES in this script and re-run.`
      );
      continue;
    }
    if (existing.gameId && existing.gameId !== gameId) {
      console.warn(`! "${username}" already has a different gameId (${existing.gameId}) linked — leaving it as-is, not overwriting.`);
      continue;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { gameId, rank },
    });
    console.log(`- Linked gameId ${gameId} to existing account "${username}", rank set to ${rank}.`);
  }

  // Create brand-new accounts for anyone with no existing login yet.
  for (const [gameId, { username, rank }] of Object.entries(NEW_ACCOUNTS)) {
    const existingByGameId = await prisma.user.findUnique({ where: { gameId } });
    if (existingByGameId) {
      console.log(`- ${username} (gameId ${gameId}) already exists — skipping creation, leaving password untouched.`);
      if (existingByGameId.rank !== rank) {
        await prisma.user.update({ where: { id: existingByGameId.id }, data: { rank } });
        console.log(`  -> rank updated to ${rank}`);
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

    createdCredentials.push({ username: finalUsername, gameId, rank, tempPassword });
  }

  if (createdCredentials.length > 0) {
    console.log("\n=== NEW ADMIN LOGIN CREDENTIALS (shown once — copy these now) ===");
    for (const c of createdCredentials) {
      console.log(`${c.username}  |  rank: ${c.rank}  |  gameId: ${c.gameId}  |  temp password: ${c.tempPassword}`);
    }
    console.log("They must log in and set their own username/password under Settings — mustChangePassword is already set.");
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

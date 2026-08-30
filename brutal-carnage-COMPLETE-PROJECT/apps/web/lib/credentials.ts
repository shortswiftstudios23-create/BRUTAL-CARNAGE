// lib/credentials.ts
// Web-app-side mirror of bot/src/lib/credentials.ts, for the admin
// "manually create a member" flow (see canCreateMemberManually). Kept
// as a separate copy rather than a shared package because the bot and
// web app are deployed independently and don't currently share code —
// duplicating this ~15-line file is cheaper than introducing a shared
// workspace package for one utility.
//
// Uses Node's built-in crypto instead of nanoid so we don't add a new
// dependency to apps/web just for this.

import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

// Excludes 0/O, 1/I/l and other visually ambiguous characters — an admin
// will be reading this off a screen and typing/pasting it into a DM or
// message to hand to the member.
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function randomFromAlphabet(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}

export function generateTempPassword(): string {
  return randomFromAlphabet(SAFE_ALPHABET, 12);
}

export function generateUsername(seed: string): string {
  const base = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  const suffix = randomFromAlphabet("0123456789", 4);
  return `${base || "member"}${suffix}`;
}

// Generates a unique-enough placeholder discordId for accounts created
// manually (not via the bot). Prefixed so it's obviously not a real
// Discord snowflake if anyone inspects the DB later.
export function generatePlaceholderDiscordId(): string {
  return `manual_${randomFromAlphabet("0123456789abcdef", 20)}`;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

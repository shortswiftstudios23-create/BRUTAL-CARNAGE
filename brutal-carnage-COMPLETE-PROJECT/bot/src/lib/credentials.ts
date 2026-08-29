// bot/src/lib/credentials.ts
// Generates human-typeable temporary passwords (no ambiguous chars) and
// hashes them for storage. The plaintext is only ever used once, in the
// DM sent to the member, and is never logged or stored anywhere.

import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

// Excludes 0/O, 1/I/l and other visually ambiguous characters since this
// will be hand-typed by someone reading a Discord DM on their phone.
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const generate = customAlphabet(SAFE_ALPHABET, 12);

export function generateTempPassword(): string {
  return generate();
}

export function generateUsername(discordUsername: string): string {
  // slugify + short random suffix to avoid collisions
  const base = discordUsername.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  const suffix = customAlphabet("0123456789", 4)();
  return `${base || "member"}${suffix}`;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

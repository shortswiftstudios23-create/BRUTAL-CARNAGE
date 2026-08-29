// bot/src/lib/prisma.ts
// The bot is a separate long-running process from the Next.js app, so it
// gets its own PrismaClient instance (sharing the same DATABASE_URL /
// schema via the shared `prisma/schema.prisma` in the monorepo root).
// No Next.js dev-reload singleton trick needed here — the bot process
// only starts once.

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

-- Adds support for manually-created (non-bot) accounts and warehouse
-- Player ID linkage.
--
-- IMPORTANT — read before running:
-- "username" is being made UNIQUE. If two existing users somehow share a
-- username today, this migration will fail. Run this first to check:
--   SELECT username, COUNT(*) FROM "User" GROUP BY username HAVING COUNT(*) > 1;
-- Rename any duplicates before applying.

ALTER TABLE "User" ADD COLUMN "gameId" TEXT;
ALTER TABLE "User" ADD COLUMN "createdManually" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_gameId_key" ON "User"("gameId");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

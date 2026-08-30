-- Adds the in-game display name (as typed in the role-request channel,
-- e.g. "Denver Jiii") separate from the generated website login
-- `username`. Used to build the "Rank | Name | ID" server nickname on
-- promotion and on initial role grant.
ALTER TABLE "User" ADD COLUMN "gameName" TEXT;

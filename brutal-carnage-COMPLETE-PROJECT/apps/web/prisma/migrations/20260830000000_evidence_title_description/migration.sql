-- Adds optional title/description to EvidenceFile so members can attach
-- context (what a Google Drive link contains, etc.) when filing evidence
-- that isn't tied to a formal report. Both columns are nullable, so this
-- is a safe, non-destructive change against existing data.
ALTER TABLE "EvidenceFile" ADD COLUMN "title" TEXT;
ALTER TABLE "EvidenceFile" ADD COLUMN "description" TEXT;

-- Adds Discord-message linkage + a free-text reason to promotion requests,
-- so a request can be created from either the website or a correctly
-- formatted Discord message and both sides stay in sync.
ALTER TABLE "PromotionRequest" ADD COLUMN "reason" TEXT;
ALTER TABLE "PromotionRequest" ADD COLUMN "discordMessageId" TEXT;
CREATE UNIQUE INDEX "PromotionRequest_discordMessageId_key" ON "PromotionRequest"("discordMessageId");

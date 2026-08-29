-- Reselling / marketplace feature: members list personal items for sale
-- (buyers contact them on Discord to negotiate); leadership can also list
-- family inventory items for sale.

CREATE TYPE "ResaleListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

CREATE TABLE "ResaleListing" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "askingPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "ResaleListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFamilyStock" BOOLEAN NOT NULL DEFAULT false,
    "linkedItemId" TEXT,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "ResaleListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResaleListing_status_idx" ON "ResaleListing"("status");
CREATE INDEX "ResaleListing_isFamilyStock_idx" ON "ResaleListing"("isFamilyStock");

ALTER TABLE "ResaleListing" ADD CONSTRAINT "ResaleListing_linkedItemId_fkey" FOREIGN KEY ("linkedItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResaleListing" ADD CONSTRAINT "ResaleListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

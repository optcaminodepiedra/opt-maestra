-- DropIndex
DROP INDEX "MenuItem_cashpointId_idx";

-- CreateIndex
CREATE INDEX "MenuItem_businessId_cashpointId_idx" ON "MenuItem"("businessId", "cashpointId");

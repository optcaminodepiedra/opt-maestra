-- AlterTable
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "pinUpdatedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RestaurantTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "area" TEXT,
    "posX" INTEGER,
    "posY" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RestaurantTable" ("businessId", "capacity", "createdAt", "id", "isActive", "name", "updatedAt") SELECT "businessId", "capacity", "createdAt", "id", "isActive", "name", "updatedAt" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "new_RestaurantTable" RENAME TO "RestaurantTable";
CREATE INDEX "RestaurantTable_businessId_isActive_idx" ON "RestaurantTable"("businessId", "isActive");
CREATE INDEX "RestaurantTable_businessId_area_idx" ON "RestaurantTable"("businessId", "area");
CREATE UNIQUE INDEX "RestaurantTable_businessId_name_key" ON "RestaurantTable"("businessId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

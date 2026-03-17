-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cashpointId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_cashpointId_fkey" FOREIGN KEY ("cashpointId") REFERENCES "Cashpoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("businessId", "category", "createdAt", "id", "isActive", "name", "priceCents", "updatedAt") SELECT "businessId", "category", "createdAt", "id", "isActive", "name", "priceCents", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_businessId_isActive_idx" ON "MenuItem"("businessId", "isActive");
CREATE INDEX "MenuItem_businessId_category_idx" ON "MenuItem"("businessId", "category");
CREATE INDEX "MenuItem_cashpointId_idx" ON "MenuItem"("cashpointId");
CREATE TABLE "new_RestaurantTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cashpointId" TEXT,
    "area" TEXT,
    "posX" INTEGER,
    "posY" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RestaurantTable_cashpointId_fkey" FOREIGN KEY ("cashpointId") REFERENCES "Cashpoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RestaurantTable" ("area", "businessId", "capacity", "createdAt", "id", "isActive", "name", "posX", "posY", "sortOrder", "updatedAt") SELECT "area", "businessId", "capacity", "createdAt", "id", "isActive", "name", "posX", "posY", "sortOrder", "updatedAt" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "new_RestaurantTable" RENAME TO "RestaurantTable";
CREATE INDEX "RestaurantTable_businessId_isActive_idx" ON "RestaurantTable"("businessId", "isActive");
CREATE INDEX "RestaurantTable_businessId_area_idx" ON "RestaurantTable"("businessId", "area");
CREATE INDEX "RestaurantTable_cashpointId_idx" ON "RestaurantTable"("cashpointId");
CREATE UNIQUE INDEX "RestaurantTable_businessId_name_key" ON "RestaurantTable"("businessId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

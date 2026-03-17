/*
  Warnings:

  - You are about to drop the column `checkIn` on the `HotelReservation` table. All the data in the column will be lost.
  - You are about to drop the column `checkOut` on the `HotelReservation` table. All the data in the column will be lost.
  - You are about to drop the column `depositCents` on the `HotelReservation` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `HotelReservation` table. All the data in the column will be lost.
  - You are about to drop the column `totalCents` on the `HotelReservation` table. All the data in the column will be lost.
  - Added the required column `businessId` to the `HotelCharge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checkIn` to the `HotelReservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checkOut` to the `HotelReservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "HotelFolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "totalChargesCents" INTEGER NOT NULL DEFAULT 0,
    "totalPaymentsCents" INTEGER NOT NULL DEFAULT 0,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelFolio_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelFolio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HotelReservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelFolio_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotelPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "HotelFolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HotelCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "concept" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelCharge_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HotelReservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HotelCharge" ("amountCents", "concept", "createdAt", "id", "reservationId") SELECT "amountCents", "concept", "createdAt", "id", "reservationId" FROM "HotelCharge";
DROP TABLE "HotelCharge";
ALTER TABLE "new_HotelCharge" RENAME TO "HotelCharge";
CREATE INDEX "HotelCharge_reservationId_createdAt_idx" ON "HotelCharge"("reservationId", "createdAt");
CREATE INDEX "HotelCharge_businessId_createdAt_idx" ON "HotelCharge"("businessId", "createdAt");
CREATE TABLE "new_HotelReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelReservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "HotelGuest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HotelReservation" ("adults", "businessId", "children", "createdAt", "guestId", "id", "roomId", "status", "updatedAt", "userId") SELECT "adults", "businessId", "children", "createdAt", "guestId", "id", "roomId", "status", "updatedAt", "userId" FROM "HotelReservation";
DROP TABLE "HotelReservation";
ALTER TABLE "new_HotelReservation" RENAME TO "HotelReservation";
CREATE INDEX "HotelReservation_roomId_status_idx" ON "HotelReservation"("roomId", "status");
CREATE INDEX "HotelReservation_guestId_idx" ON "HotelReservation"("guestId");
CREATE INDEX "HotelReservation_businessId_status_idx" ON "HotelReservation"("businessId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "HotelFolio_reservationId_key" ON "HotelFolio"("reservationId");

-- CreateIndex
CREATE INDEX "HotelFolio_businessId_createdAt_idx" ON "HotelFolio"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelPayment_folioId_createdAt_idx" ON "HotelPayment"("folioId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelPayment_businessId_createdAt_idx" ON "HotelPayment"("businessId", "createdAt");

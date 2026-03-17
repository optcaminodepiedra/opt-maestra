-- CreateTable
CREATE TABLE "HotelRoomType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePriceCents" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelRoomType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "area" TEXT,
    "posX" INTEGER,
    "posY" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelRoom_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelRoom_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "HotelRoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotelGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HotelReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelReservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "HotelGuest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotelCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HotelReservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HotelRoomType_businessId_idx" ON "HotelRoomType"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomType_businessId_name_key" ON "HotelRoomType"("businessId", "name");

-- CreateIndex
CREATE INDEX "HotelRoom_businessId_status_idx" ON "HotelRoom"("businessId", "status");

-- CreateIndex
CREATE INDEX "HotelRoom_businessId_isActive_idx" ON "HotelRoom"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "HotelRoom_roomTypeId_idx" ON "HotelRoom"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_businessId_name_key" ON "HotelRoom"("businessId", "name");

-- CreateIndex
CREATE INDEX "HotelGuest_fullName_idx" ON "HotelGuest"("fullName");

-- CreateIndex
CREATE INDEX "HotelGuest_phone_idx" ON "HotelGuest"("phone");

-- CreateIndex
CREATE INDEX "HotelGuest_email_idx" ON "HotelGuest"("email");

-- CreateIndex
CREATE INDEX "HotelReservation_businessId_status_idx" ON "HotelReservation"("businessId", "status");

-- CreateIndex
CREATE INDEX "HotelReservation_checkIn_checkOut_idx" ON "HotelReservation"("checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "HotelReservation_roomId_status_idx" ON "HotelReservation"("roomId", "status");

-- CreateIndex
CREATE INDEX "HotelReservation_guestId_idx" ON "HotelReservation"("guestId");

-- CreateIndex
CREATE INDEX "HotelCharge_reservationId_createdAt_idx" ON "HotelCharge"("reservationId", "createdAt");

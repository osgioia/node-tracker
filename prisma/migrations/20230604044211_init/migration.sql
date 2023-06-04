-- CreateTable
CREATE TABLE "Torrent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "infoHash" TEXT NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Peer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "torrentId" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "uploaded" INTEGER NOT NULL,
    "downloaded" INTEGER NOT NULL,
    "left" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Peer_torrentId_fkey" FOREIGN KEY ("torrentId") REFERENCES "Torrent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Torrent_infoHash_key" ON "Torrent"("infoHash");

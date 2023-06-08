-- CreateTable
CREATE TABLE "Torrent" (
    "id" SERIAL NOT NULL,
    "infoHash" TEXT NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Torrent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peer" (
    "id" SERIAL NOT NULL,
    "torrentId" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "uploaded" INTEGER NOT NULL,
    "downloaded" INTEGER NOT NULL,
    "left" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Peer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Torrent_infoHash_key" ON "Torrent"("infoHash");

-- AddForeignKey
ALTER TABLE "Peer" ADD CONSTRAINT "Peer_torrentId_fkey" FOREIGN KEY ("torrentId") REFERENCES "Torrent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

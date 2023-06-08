/*
  Warnings:

  - Added the required column `name` to the `Torrent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Torrent" ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTorrent" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TagToTorrent_AB_unique" ON "_TagToTorrent"("A", "B");

-- CreateIndex
CREATE INDEX "_TagToTorrent_B_index" ON "_TagToTorrent"("B");

-- AddForeignKey
ALTER TABLE "Torrent" ADD CONSTRAINT "Torrent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTorrent" ADD CONSTRAINT "_TagToTorrent_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTorrent" ADD CONSTRAINT "_TagToTorrent_B_fkey" FOREIGN KEY ("B") REFERENCES "Torrent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

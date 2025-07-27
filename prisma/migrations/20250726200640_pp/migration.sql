-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- CreateTable
CREATE TABLE "Torrent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(255),
    "infoHash" TEXT NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" INTEGER NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "freeleech" BOOLEAN NOT NULL DEFAULT false,
    "size" INTEGER NOT NULL DEFAULT 0,
    "categoryId" INTEGER,

    CONSTRAINT "Torrent_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Bookmark" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "banned" BOOLEAN NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "invitedById" INTEGER,
    "remainingInvites" INTEGER NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "inviteId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "infoHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "uploaded" BIGINT NOT NULL,
    "download" BIGINT NOT NULL,
    "left" BIGINT NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("infoHash","userId")
);

-- CreateTable
CREATE TABLE "GeoIP" (
    "startIP" BIGINT NOT NULL,
    "endIP" BIGINT NOT NULL,
    "code" VARCHAR(2) NOT NULL,

    CONSTRAINT "GeoIP_pkey" PRIMARY KEY ("startIP","endIP")
);

-- CreateTable
CREATE TABLE "InviteTreeNode" (
    "userID" INTEGER NOT NULL,
    "inviterId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "inviteKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPBan" (
    "id" SERIAL NOT NULL,
    "fromIP" BIGINT NOT NULL,
    "toIP" BIGINT NOT NULL,
    "reason" VARCHAR(255),

    CONSTRAINT "IPBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTorrent" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TagToTorrent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Torrent_infoHash_key" ON "Torrent"("infoHash");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_id_key" ON "Bookmark"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_invitedById_key" ON "User"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "InviteTreeNode_userID_key" ON "InviteTreeNode"("userID");

-- CreateIndex
CREATE INDEX "InviterIdIndex" ON "InviteTreeNode"("inviterId");

-- CreateIndex
CREATE INDEX "UserIDIndex" ON "InviteTreeNode"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_inviterId_key" ON "Invite"("inviterId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_inviteKey_key" ON "Invite"("inviteKey");

-- CreateIndex
CREATE INDEX "ExpiresIndex" ON "Invite"("expires");

-- CreateIndex
CREATE INDEX "InviterIdInviteIndex" ON "Invite"("inviterId");

-- CreateIndex
CREATE INDEX "ToIPIndex" ON "IPBan"("toIP");

-- CreateIndex
CREATE UNIQUE INDEX "IPBan_fromIP_toIP_key" ON "IPBan"("fromIP", "toIP");

-- CreateIndex
CREATE INDEX "_TagToTorrent_B_index" ON "_TagToTorrent"("B");

-- AddForeignKey
ALTER TABLE "Torrent" ADD CONSTRAINT "Torrent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Torrent" ADD CONSTRAINT "Torrent_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteTreeNode" ADD CONSTRAINT "InviteTreeNode_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTorrent" ADD CONSTRAINT "_TagToTorrent_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTorrent" ADD CONSTRAINT "_TagToTorrent_B_fkey" FOREIGN KEY ("B") REFERENCES "Torrent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

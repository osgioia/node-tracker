/*
  Warnings:

  - You are about to drop the column `inviteId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Invite_inviterId_key";

-- DropIndex
DROP INDEX "User_invitedById_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "inviteId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "downloaded" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "seedtime" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "uploaded" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserBan" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBanUserIdIndex" ON "UserBan"("userId");

-- CreateIndex
CREATE INDEX "UserBanExpiresIndex" ON "UserBan"("expiresAt");

-- CreateIndex
CREATE INDEX "UserBanActiveIndex" ON "UserBan"("active");

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

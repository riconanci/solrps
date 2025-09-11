-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'LOCKED', 'AWAITING_REVEAL', 'RESOLVED', 'FORFEITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OverallOutcome" AS ENUM ('CREATOR', 'CHALLENGER', 'DRAW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "displayName" TEXT,
    "walletPubkey" TEXT,
    "mockBalance" INTEGER NOT NULL DEFAULT 100000,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "rounds" INTEGER NOT NULL,
    "stakePerRound" INTEGER NOT NULL,
    "totalStake" INTEGER NOT NULL,
    "commitHash" TEXT NOT NULL,
    "saltHint" TEXT,
    "creatorId" TEXT NOT NULL,
    "challengerId" TEXT,
    "creatorRevealed" BOOLEAN NOT NULL DEFAULT false,
    "revealDeadline" TIMESTAMP(3) NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "privateCode" TEXT,
    "creatorMoves" JSONB,
    "challengerMoves" JSONB,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roundsOutcome" JSONB NOT NULL,
    "creatorWins" INTEGER NOT NULL,
    "challengerWins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "overall" "OverallOutcome" NOT NULL,
    "pot" INTEGER NOT NULL,
    "feesTreasury" INTEGER NOT NULL,
    "feesBurn" INTEGER NOT NULL,
    "payoutWinner" INTEGER NOT NULL,
    "winnerUserId" TEXT,
    "replaySeed" TEXT,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_privateCode_key" ON "sessions"("privateCode");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_sessionId_key" ON "match_results"("sessionId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

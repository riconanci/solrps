-- Phase 2 Database Migration - Add wallet address support
-- File: prisma/migrations/add_wallet_address.sql

-- Add wallet address column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletAddress" VARCHAR(255);

-- Add index for efficient lookups by wallet address  
CREATE INDEX IF NOT EXISTS "idx_user_wallet_address" ON "User"("walletAddress");

-- Add unique constraint to prevent duplicate wallet addresses
-- (commented out initially to allow null values during migration)
-- ALTER TABLE "User" ADD CONSTRAINT "unique_wallet_address" UNIQUE ("walletAddress");

-- Update existing seed users with placeholder wallet addresses for testing
-- These will be replaced with real addresses during development
UPDATE "User" 
SET "walletAddress" = 'ALICE_MOCK_WALLET_' || "id" 
WHERE "id" = 'seed_alice' AND "walletAddress" IS NULL;

UPDATE "User" 
SET "walletAddress" = 'BOB_MOCK_WALLET_' || "id" 
WHERE "id" = 'seed_bob' AND "walletAddress" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "User"."walletAddress" IS 'Solana wallet public key address for Phase 2';
COMMENT ON INDEX "idx_user_wallet_address" IS 'Index for efficient wallet address lookups';

-- View current migration status
SELECT 
  "id",
  "displayName", 
  "mockBalance",
  "walletAddress",
  "createdAt"
FROM "User" 
WHERE "id" IN ('seed_alice', 'seed_bob');

-- NOTE: This migration is backward compatible
-- - Phase 1: Uses id-based lookup (existing behavior)
-- - Phase 2: Uses walletAddress when available, falls back to id
-- - Both systems can operate simultaneously during migration period
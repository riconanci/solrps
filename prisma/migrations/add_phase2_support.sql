-- Phase 2 Database Migration - Work with existing schema structure
-- File: prisma/migrations/add_phase2_support.sql

-- First, let's check what columns exist in the users table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';

-- The column name should be "walletPubkey" based on your migration
-- Add index for efficient lookups by wallet pubkey (using correct column name)
CREATE INDEX IF NOT EXISTS "idx_user_wallet_pubkey" ON "users"("walletPubkey");

-- If the above fails, try with case-sensitive quotes:
-- CREATE INDEX IF NOT EXISTS "idx_user_wallet_pubkey" ON "users"("walletPubkey");

-- Add comments for documentation
COMMENT ON COLUMN "users"."walletPubkey" IS 'Solana wallet public key address for Phase 2';

-- Update existing seed users with placeholder wallet addresses for testing
-- These will be replaced with real addresses during development
UPDATE "users" 
SET "walletPubkey" = 'ALICE_MOCK_WALLET_' || "id" 
WHERE "id" = 'seed_alice' AND ("walletPubkey" IS NULL OR "walletPubkey" = '');

UPDATE "users" 
SET "walletPubkey" = 'BOB_MOCK_WALLET_' || "id" 
WHERE "id" = 'seed_bob' AND ("walletPubkey" IS NULL OR "walletPubkey" = '');

-- View current migration status
SELECT 
  "id",
  "displayName", 
  "mockBalance",
  "walletPubkey",
  "createdAt"
FROM "users" 
WHERE "id" IN ('seed_alice', 'seed_bob');

-- ALTERNATIVE: If you're getting column not found errors, run these commands instead:

-- Check if the table structure matches expectations:
-- \d users

-- If the column doesn't exist somehow, add it:
-- ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "walletPubkey" TEXT;

-- NOTE: Your migration file shows the column should exist as "walletPubkey"
-- If you're still getting errors, the issue might be:
-- 1. Migration hasn't been applied yet (run: npm run db:push)
-- 2. Connected to wrong database
-- 3. Case sensitivity in column names
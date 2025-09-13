// src/config/constants.ts
export const APP_CONFIG = {
  // Feature flags
  USE_BLOCKCHAIN: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true',
  ENABLE_PHASE2: process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true',
  
  // Solana configuration
  SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
  TOKEN_MINT_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS,
  TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
  BURN_ADDRESS: process.env.NEXT_PUBLIC_BURN_ADDRESS,
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
  
  // Game configuration (unchanged)
  REVEAL_DEADLINE_SECONDS: parseInt(process.env.REVEAL_DEADLINE_SECONDS || '600'),
  
  // Fee structure
  TREASURY_FEE_PERCENT: 2.5,
  BURN_FEE_PERCENT: 2.5,
  TOTAL_FEE_PERCENT: 5,
};
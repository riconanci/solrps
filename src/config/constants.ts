// src/config/constants.ts - Phase 2 Configuration
export const APP_CONFIG = {
  // Phase 2 Feature Flags
  USE_BLOCKCHAIN: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true',
  ENABLE_PHASE2: process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true',
  
  // Solana Configuration
  SOLANA_CLUSTER: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as 'devnet' | 'testnet' | 'mainnet-beta') || 'devnet',
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  
  // Token Configuration (for future SPL token)
  TOKEN_MINT_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS,
  TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || 'TREASURY_MOCK',
  BURN_ADDRESS: process.env.NEXT_PUBLIC_BURN_ADDRESS || 'BURN_MOCK',
  
  // Smart Contract (for future Anchor program)
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
  
  // Game Configuration (unchanged from Phase 1)
  REVEAL_DEADLINE_SECONDS: parseInt(process.env.REVEAL_DEADLINE_SECONDS || '600'),
  
  // Fee Structure (unchanged from Phase 1)
  TREASURY_FEE_PERCENT: 2,
  BURN_FEE_PERCENT: 2,
  DEV_FEE_PERCENT: 1,
  TOTAL_FEE_PERCENT: 5,
  WEEKLY_REWARDS_PERCENT: 2,
  
  // Conversion Rates (Phase 2)
  SOL_TO_GAME_TOKENS: 1000000, // 1 SOL = 1M game tokens
  MIN_SOL_BALANCE: 0.01, // Minimum SOL balance to play (for transaction fees)
  
  // UI Configuration
  WALLET_CONNECT_TIMEOUT: 30000, // 30 seconds
  BALANCE_REFRESH_INTERVAL: 10000, // 10 seconds
} as const;

// Environment validation for Phase 2
export const validatePhase2Config = (): string[] => {
  const errors: string[] = [];
  
  if (APP_CONFIG.USE_BLOCKCHAIN) {
    if (!APP_CONFIG.SOLANA_RPC_URL) {
      errors.push('NEXT_PUBLIC_SOLANA_RPC_URL is required when USE_BLOCKCHAIN is enabled');
    }
    
    // Future validations for SPL tokens
    if (APP_CONFIG.TOKEN_MINT_ADDRESS && !/^[A-Za-z0-9]{32,44}$/.test(APP_CONFIG.TOKEN_MINT_ADDRESS)) {
      errors.push('TOKEN_MINT_ADDRESS must be a valid Solana address');
    }
  }
  
  return errors;
};

// Helper functions
export const isPhase2Enabled = (): boolean => {
  return APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
};

export const getWalletDisplayMode = (): 'mock' | 'solana' => {
  return isPhase2Enabled() ? 'solana' : 'mock';
};

export const getSolanaClusterUrl = (): string => {
  if (APP_CONFIG.SOLANA_RPC_URL) {
    return APP_CONFIG.SOLANA_RPC_URL;
  }
  
  switch (APP_CONFIG.SOLANA_CLUSTER) {
    case 'devnet':
      return 'https://api.devnet.solana.com';
    case 'testnet':
      return 'https://api.testnet.solana.com';
    case 'mainnet-beta':
      return 'https://api.mainnet-beta.solana.com';
    default:
      return 'https://api.devnet.solana.com';
  }
};
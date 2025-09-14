// src/hooks/useGameWallet.ts - ENHANCED FOR PHASE 2
import { useWallet as useMockWallet } from '../state/wallet';
import { useSolanaWallet } from './useSolanaWallet';
import { APP_CONFIG } from '../config/constants';

export interface GameWallet {
  connected: boolean;
  connecting: boolean;
  balance: number;
  userId: string | null;
  displayName: string | null;
  walletType: 'mock' | 'solana';
  
  // Connection methods
  disconnect: () => void | Promise<void>;
  refreshBalance: () => void | Promise<void>;
  
  // Solana-specific (when applicable)
  publicKey?: string | null;
  solBalance?: number;
  walletName?: string;
}

export const useGameWallet = (): GameWallet => {
  const solanaWallet = useSolanaWallet();
  const mockWallet = useMockWallet();

  // Phase 2: Check if we should use Solana wallets
  const shouldUseSolanaWallet = APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;

  // Return Solana wallet interface if enabled and connected
  if (shouldUseSolanaWallet && solanaWallet.connected && solanaWallet.publicKey) {
    return {
      connected: true,
      connecting: solanaWallet.connecting,
      balance: Math.floor(solanaWallet.solBalance * 1000000), // Convert SOL to game tokens (1 SOL = 1M tokens)
      userId: solanaWallet.publicKey.toString(),
      displayName: formatWalletAddress(solanaWallet.publicKey.toString()),
      walletType: 'solana',
      
      disconnect: solanaWallet.disconnect,
      refreshBalance: solanaWallet.refreshBalances,
      
      // Solana-specific fields
      publicKey: solanaWallet.publicKey.toString(),
      solBalance: solanaWallet.solBalance,
      walletName: 'Phantom', // TODO: Get actual wallet name from adapter
    };
  }

  // Return mock wallet interface (Phase 1 compatibility or fallback)
  return {
    connected: mockWallet.isConnected,
    connecting: false,
    balance: mockWallet.balance || 0,
    userId: mockWallet.userId || null,
    displayName: mockWallet.displayName || null,
    walletType: 'mock',
    
    disconnect: () => {
      mockWallet.disconnect();
    },
    
    refreshBalance: async () => {
      if (mockWallet.userId) {
        try {
          const response = await fetch(`/api/user/${mockWallet.userId}`);
          if (response.ok) {
            const data = await response.json();
            mockWallet.setBalance(data.mockBalance || data.balance || 0);
          }
        } catch (error) {
          console.warn('Failed to refresh mock balance:', error);
        }
      }
    },
  };
};

// Helper function to format wallet addresses
function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Hook to check if we're in Phase 2 mode
export const useIsPhase2 = (): boolean => {
  return APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
};

// Hook to get wallet connection instructions based on mode
export const useWalletInstructions = () => {
  const isPhase2 = useIsPhase2();
  
  if (isPhase2) {
    return {
      title: "Connect Your Solana Wallet",
      description: "Connect Phantom, Solflare, or another supported Solana wallet to play",
      buttonText: "Select Wallet",
    };
  }
  
  return {
    title: "Demo Mode - Mock Wallets",
    description: "Switch between Alice and Bob for testing. Phase 2 will use real Solana wallets.",
    buttonText: "Switch User",
  };
};
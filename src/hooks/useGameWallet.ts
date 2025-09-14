// src/hooks/useGameWallet.ts - PHASE 2 STEP 2: Real Solana Wallet Integration (COMPLETE REWRITE - FIXED TYPES)
import { useWallet as useMockWallet } from '../state/wallet';
import { useSolanaWallet } from './useSolanaWallet';
import { APP_CONFIG } from '../config/constants';
import { useEffect, useState } from 'react';

// FIXED INTERFACE: Changed walletName from string|undefined to string|null for consistency
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
  
  // Solana-specific (when applicable) - FIXED: All use string|null consistently
  publicKey: string | null;
  solBalance: number;
  walletName: string | null; // FIXED: Changed from string|undefined to string|null
}

export const useGameWallet = (): GameWallet => {
  const solanaWallet = useSolanaWallet();
  const mockWallet = useMockWallet();
  const [gameBalance, setGameBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Phase 2: Check if we should use Solana wallets
  const shouldUseSolanaWallet = APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;

  // Fetch game balance from database for Solana wallet users
  const fetchGameBalance = async (walletAddress: string) => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/user/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        const balance = data.mockBalance || data.balance || 0;
        setGameBalance(balance);
        return balance;
      }
    } catch (error) {
      console.warn('Failed to fetch game balance for wallet:', error);
    } finally {
      setIsRefreshing(false);
    }
    return 0;
  };

  // Auto-fetch game balance when Solana wallet connects
  useEffect(() => {
    if (shouldUseSolanaWallet && solanaWallet.connected && solanaWallet.publicKey) {
      fetchGameBalance(solanaWallet.publicKey.toString());
    }
  }, [shouldUseSolanaWallet, solanaWallet.connected, solanaWallet.publicKey]);

  // Return Solana wallet interface if enabled and connected
  if (shouldUseSolanaWallet && solanaWallet.connected && solanaWallet.publicKey) {
    return {
      connected: true,
      connecting: solanaWallet.connecting,
      balance: gameBalance, // Game balance from database
      userId: solanaWallet.publicKey.toString(),
      displayName: formatWalletAddress(solanaWallet.publicKey.toString()),
      walletType: 'solana',
      
      disconnect: solanaWallet.disconnect,
      refreshBalance: async () => {
        await Promise.all([
          solanaWallet.refreshBalances(),
          fetchGameBalance(solanaWallet.publicKey!.toString())
        ]);
      },
      
      // Solana-specific fields - FIXED: All consistent with interface
      publicKey: solanaWallet.publicKey.toString(),
      solBalance: solanaWallet.solBalance,
      walletName: getWalletName(), // Returns string|null (FIXED)
    };
  }

  // Return Solana wallet interface if connecting (for loading states)
  if (shouldUseSolanaWallet && solanaWallet.connecting) {
    return {
      connected: false,
      connecting: true,
      balance: 0,
      userId: null,
      displayName: null,
      walletType: 'solana',
      
      disconnect: solanaWallet.disconnect,
      refreshBalance: async () => {},
      
      // FIXED: Use null instead of undefined for consistency
      publicKey: null,
      solBalance: 0,
      walletName: null, // FIXED: null instead of undefined
    };
  }

  // Return Solana wallet interface if disconnected but in blockchain mode
  if (shouldUseSolanaWallet && !solanaWallet.connected) {
    return {
      connected: false,
      connecting: solanaWallet.connecting,
      balance: 0,
      userId: null,
      displayName: null,
      walletType: 'solana',
      
      disconnect: solanaWallet.disconnect,
      refreshBalance: async () => {},
      
      // FIXED: Use null for consistency
      publicKey: null,
      solBalance: solanaWallet.solBalance,
      walletName: null, // FIXED: null instead of undefined
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
    
    // Mock wallet defaults for Solana-specific fields - FIXED: Use null consistently
    publicKey: null,
    solBalance: 0,
    walletName: null, // FIXED: null instead of undefined
  };
};

// Helper function to format wallet addresses (ORIGINAL FUNCTIONALITY PRESERVED)
function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Helper function to detect wallet name - FIXED: Returns string|null consistently
function getWalletName(): string | null {
  if (typeof window !== 'undefined') {
    if ((window as any).phantom?.solana?.isPhantom) {
      return 'Phantom';
    }
    if ((window as any).solflare?.isSolflare) {
      return 'Solflare';
    }
    if ((window as any).backpack?.isBackpack) {
      return 'Backpack';
    }
    if ((window as any).glow) {
      return 'Glow';
    }
    if ((window as any).solana?.isConnected) {
      return 'Unknown Wallet';
    }
  }
  return null; // FIXED: Return null instead of 'Wallet' for consistency
}

// Hook to check if we're in Phase 2 mode (ORIGINAL FUNCTIONALITY PRESERVED)
export const useIsPhase2 = (): boolean => {
  return APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
};

// Hook to get wallet connection instructions based on mode (ORIGINAL FUNCTIONALITY PRESERVED)
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

// Helper hook to auto-create wallet users in the database (NEW PHASE 2 FUNCTIONALITY)
export const useWalletUserCreation = () => {
  const gameWallet = useGameWallet();

  useEffect(() => {
    if (gameWallet.walletType === 'solana' && gameWallet.connected && gameWallet.userId) {
      // Auto-create user in database if they don't exist
      const createUserIfNeeded = async () => {
        try {
          const response = await fetch(`/api/user/${gameWallet.userId}`);
          if (!response.ok && response.status === 404) {
            // User doesn't exist, create them
            console.log(`🆕 Creating wallet user: ${gameWallet.displayName}`);
            
            await fetch('/api/user/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: gameWallet.userId,
                displayName: gameWallet.displayName,
              }),
            });
            
            console.log(`✅ Wallet user created: ${gameWallet.displayName}`);
          }
        } catch (error) {
          console.warn('Failed to create wallet user:', error);
        }
      };

      createUserIfNeeded();
    }
  }, [gameWallet.walletType, gameWallet.connected, gameWallet.userId, gameWallet.displayName]);
};

// Enhanced conversion utilities for Phase 2
export const convertSolToGameTokens = (solAmount: number): number => {
  return Math.floor(solAmount * APP_CONFIG.SOL_TO_GAME_TOKENS);
};

export const convertGameTokensToSol = (gameTokens: number): number => {
  return gameTokens / APP_CONFIG.SOL_TO_GAME_TOKENS;
};

// Wallet connection status checker
export const useWalletConnectionStatus = () => {
  const gameWallet = useGameWallet();
  
  return {
    isConnected: gameWallet.connected,
    isConnecting: gameWallet.connecting,
    walletType: gameWallet.walletType,
    hasBalance: gameWallet.balance > 0,
    canPlay: gameWallet.connected && gameWallet.balance >= 100, // Minimum game stake
    connectionMessage: gameWallet.connecting 
      ? 'Connecting to wallet...' 
      : gameWallet.connected 
        ? `Connected as ${gameWallet.displayName}` 
        : 'Connect wallet to play',
  };
};
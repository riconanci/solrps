// src/hooks/useGameWallet.ts - FIXED: Proper Solana Wallet Connection Logic
"use client";
import { useWallet as useMockWallet } from '../state/wallet';
import { useSolanaWallet } from './useSolanaWallet';
import { APP_CONFIG } from '../config/constants';
import { useEffect, useState, useCallback } from 'react';

export interface GameWallet {
  connected: boolean;
  connecting: boolean;
  balance: number;
  userId: string | null;
  displayName: string | null;
  walletType: 'mock' | 'solana';
  
  disconnect: () => void | Promise<void>;
  refreshBalance: () => void | Promise<void>;
  
  publicKey: string | null;
  solBalance: number;
  walletName: string | null;
}

export const useGameWallet = (): GameWallet => {
  const solanaWallet = useSolanaWallet();
  const mockWallet = useMockWallet();
  const [gameBalance, setGameBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Phase 2: Check if we should use Solana wallets
  const shouldUseSolanaWallet = APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;

  // FIXED: Add detailed logging to debug the connection issue
  console.log('🔍 useGameWallet Debug:', {
    shouldUseSolanaWallet,
    'solanaWallet.connected': solanaWallet.connected,
    'solanaWallet.connecting': solanaWallet.connecting,
    'solanaWallet.publicKey': solanaWallet.publicKey?.toString() || 'null',
    'APP_CONFIG.USE_BLOCKCHAIN': APP_CONFIG.USE_BLOCKCHAIN,
    'APP_CONFIG.ENABLE_PHASE2': APP_CONFIG.ENABLE_PHASE2,
    'gameBalance': gameBalance,
    'mockWallet.userId': mockWallet.userId
  });

  // Fetch game balance from database for Solana wallet users
  const fetchGameBalance = useCallback(async (walletAddress: string) => {
    try {
      setIsRefreshing(true);
      console.log('💰 Fetching game balance for:', walletAddress);
      
      const response = await fetch(`/api/user/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        const balance = data.mockBalance || data.balance || 0;
        console.log('✅ Game balance fetched:', balance);
        setGameBalance(balance);
        return balance;
      } else if (response.status === 404) {
        // User doesn't exist, create them
        console.log('👤 Creating new wallet user...');
        await createWalletUser(walletAddress);
        return 500000; // Default starting balance
      } else {
        console.error('❌ Failed to fetch game balance, status:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to fetch game balance for wallet:', error);
    } finally {
      setIsRefreshing(false);
    }
    return 0;
  }, []);

  // Create new wallet user
  const createWalletUser = useCallback(async (walletAddress: string) => {
    try {
      console.log('👤 Creating wallet user for:', walletAddress);
      const response = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          displayName: formatWalletAddress(walletAddress),
        }),
      });
      
      if (response.ok) {
        console.log('✅ Wallet user created successfully');
        setGameBalance(500000); // Default starting balance
      } else {
        console.error('❌ Failed to create wallet user, status:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to create wallet user:', error);
    }
  }, []);

  // Auto-fetch game balance when Solana wallet connects
  useEffect(() => {
    if (shouldUseSolanaWallet && solanaWallet.connected && solanaWallet.publicKey) {
      console.log('🔗 Wallet connected, fetching game balance...');
      fetchGameBalance(solanaWallet.publicKey.toString());
    }
  }, [shouldUseSolanaWallet, solanaWallet.connected, solanaWallet.publicKey, fetchGameBalance]);

  // FIXED: Restructured logic to prevent fallthrough to mock mode
  
  // 1. First check if we should use Solana wallets at all
  if (!shouldUseSolanaWallet) {
    console.log('📱 Using mock wallet mode (Phase 2 disabled)');
    
    const mockUserId = mockWallet.userId || null;
    const mockDisplayName = mockUserId === 'seed_alice' ? 'Alice' : 
                            mockUserId === 'seed_bob' ? 'Bob' : 
                            mockUserId;
    
    return {
      connected: true, // Mock wallet is always "connected"
      connecting: false,
      balance: mockWallet.balance || 0,
      userId: mockUserId,
      displayName: mockDisplayName,
      walletType: 'mock',
      
      disconnect: () => {
        console.log('Mock wallet disconnect (no-op)');
      },
      refreshBalance: () => {
        console.log('Mock wallet refresh balance (no-op)');
      },
      
      publicKey: null,
      solBalance: 0,
      walletName: null,
    };
  }

  // 2. We're in Phase 2 mode - handle Solana wallet states
  
  // Handle connecting state
  if (solanaWallet.connecting) {
    console.log('🔄 Using Solana wallet mode - connecting...');
    
    return {
      connected: false,
      connecting: true,
      balance: 0,
      userId: null,
      displayName: null,
      walletType: 'solana',
      
      disconnect: async () => {
        if (solanaWallet?.disconnect) {
          await solanaWallet.disconnect();
        }
      },
      refreshBalance: async () => {},
      
      publicKey: null,
      solBalance: 0,
      walletName: null,
    };
  }

  // Handle connected state
  if (solanaWallet.connected && solanaWallet.publicKey) {
    console.log('✅ Using Solana wallet mode - CONNECTED and returning Solana interface');
    
    return {
      connected: true,
      connecting: false,
      balance: gameBalance, // This should show the fetched game balance, not mock balance
      userId: solanaWallet.publicKey.toString(),
      displayName: formatWalletAddress(solanaWallet.publicKey.toString()),
      walletType: 'solana',
      
      disconnect: async () => {
        try {
          console.log('🔌 Disconnecting Solana wallet...');
          if (solanaWallet.disconnect) {
            await solanaWallet.disconnect();
          }
          setGameBalance(0);
          console.log('✅ Solana wallet disconnected');
        } catch (error) {
          console.error('❌ Error disconnecting Solana wallet:', error);
        }
      },
      
      refreshBalance: async () => {
        console.log('🔄 Refreshing balances...');
        if (solanaWallet.publicKey) {
          await Promise.all([
            solanaWallet.refreshBalances(),
            fetchGameBalance(solanaWallet.publicKey.toString())
          ]);
        }
      },
      
      publicKey: solanaWallet.publicKey.toString(),
      solBalance: solanaWallet.solBalance,
      walletName: getWalletName(),
    };
  }

  // 3. Phase 2 mode but wallet not connected - return disconnected Solana state
  console.log('⏳ Phase 2 mode - Solana wallet NOT connected, showing disconnected state');
  
  return {
    connected: false,
    connecting: false,
    balance: 0,
    userId: null,
    displayName: null,
    walletType: 'solana',
    
    disconnect: async () => {
      console.log('No wallet to disconnect');
    },
    refreshBalance: async () => {
      console.log('No wallet to refresh');
    },
    
    publicKey: null,
    solBalance: 0,
    walletName: null,
  };
};

// Helper function to format wallet addresses
function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Helper function to detect wallet name
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
  return null;
}

// Hook to check if we're in Phase 2 mode
export const useIsPhase2 = (): boolean => {
  return APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
};
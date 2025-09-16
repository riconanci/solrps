// src/hooks/useGameWallet.ts - FIXED: TypeScript Errors Resolved
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
  tokenBalance: number;
  tokenAccountExists: boolean;
  isTokenMode: boolean;
  balanceSource: 'mock' | 'database' | 'token';
}

export const useGameWallet = (): GameWallet => {
  const solanaWallet = useSolanaWallet();
  const mockWallet = useMockWallet();
  const [gameBalance, setGameBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Configuration flags
  const shouldUseSolanaWallet = APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
  const hasTokenMintAddress = !!APP_CONFIG.TOKEN_MINT_ADDRESS;
  const isTokenMode = shouldUseSolanaWallet && hasTokenMintAddress && solanaWallet.connected;
  
  // Comprehensive debug logging
  useEffect(() => {
    console.log('🎮 useGameWallet State:', {
      // Configuration
      shouldUseSolanaWallet,
      hasTokenMintAddress,
      isTokenMode,
      'APP_CONFIG.USE_BLOCKCHAIN': APP_CONFIG.USE_BLOCKCHAIN,
      'APP_CONFIG.ENABLE_PHASE2': APP_CONFIG.ENABLE_PHASE2,
      'APP_CONFIG.TOKEN_MINT_ADDRESS': APP_CONFIG.TOKEN_MINT_ADDRESS,
      
      // Solana Wallet State
      'solanaWallet.connected': solanaWallet.connected,
      'solanaWallet.connecting': solanaWallet.connecting,
      'solanaWallet.publicKey': solanaWallet.publicKey?.toString() || null,
      'solanaWallet.solBalance': solanaWallet.solBalance,
      'solanaWallet.tokenBalance': solanaWallet.tokenBalance,
      'solanaWallet.tokenAccountExists': solanaWallet.tokenAccountExists,
      'solanaWallet.loading': solanaWallet.loading,
      'solanaWallet.error': solanaWallet.error,
      
      // Mock Wallet State - FIXED: Use correct property names
      'mockWallet.userId': mockWallet.userId,
      'mockWallet.balance': mockWallet.balance,
      'mockWallet.isConnected': mockWallet.isConnected, // FIXED: Use isConnected instead of connected
      'mockWallet.displayName': mockWallet.displayName,
      
      // Game State
      gameBalance,
      isRefreshing,
    });
  }, [
    shouldUseSolanaWallet, hasTokenMintAddress, isTokenMode,
    solanaWallet.connected, solanaWallet.connecting, solanaWallet.publicKey, 
    solanaWallet.solBalance, solanaWallet.tokenBalance, solanaWallet.tokenAccountExists,
    solanaWallet.loading, solanaWallet.error,
    mockWallet.userId, mockWallet.balance, mockWallet.isConnected, mockWallet.displayName, // FIXED
    gameBalance, isRefreshing
  ]);

  // Helper functions
  const formatWalletAddress = (address: string): string => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getWalletName = (): string | null => {
    return solanaWallet.wallet?.adapter?.name || null;
  };

  // Determine balance and its source
  const getBalanceInfo = useCallback(() => {
    console.log('🎯 Determining balance source...');
    
    if (!shouldUseSolanaWallet) {
      console.log('📱 Using mock balance - Phase 2 disabled');
      return {
        balance: mockWallet.balance || 0,
        source: 'mock' as const
      };
    }
    
    if (!solanaWallet.connected) {
      console.log('🔌 Not connected - zero balance');
      return {
        balance: 0,
        source: 'database' as const
      };
    }
    
    if (isTokenMode) {
      console.log('🪙 Using token balance - token mode active');
      return {
        balance: solanaWallet.tokenBalance || 0,
        source: 'token' as const
      };
    }
    
    console.log('📊 Using database balance - no token mode');
    return {
      balance: gameBalance || 0,
      source: 'database' as const
    };
  }, [shouldUseSolanaWallet, solanaWallet.connected, isTokenMode, mockWallet.balance, solanaWallet.tokenBalance, gameBalance]);

  // Database balance fetching (fallback for non-token mode)
  const fetchGameBalance = useCallback(async (walletAddress: string) => {
    if (isTokenMode) {
      console.log('🪙 Skipping database fetch - in token mode');
      return;
    }
    
    try {
      setIsRefreshing(true);
      console.log('💾 Fetching database balance for:', walletAddress);
      
      const response = await fetch(`/api/user/${walletAddress}`);
      
      if (response.ok) {
        const data = await response.json();
        const balance = data.mockBalance || data.balance || 0;
        console.log('✅ Database balance fetched:', balance);
        setGameBalance(balance);
        return balance;
      } else if (response.status === 404) {
        console.log('👤 User not found, creating new wallet user...');
        await createWalletUser(walletAddress);
        return 500000;
      } else {
        console.error('❌ Database fetch failed, status:', response.status);
      }
    } catch (error) {
      console.error('❌ Database fetch error:', error);
    } finally {
      setIsRefreshing(false);
    }
    return 0;
  }, [isTokenMode]);

  // Create new wallet user in database
  const createWalletUser = useCallback(async (walletAddress: string) => {
    try {
      console.log('👤 Creating new user for wallet:', walletAddress);
      
      const response = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          displayName: formatWalletAddress(walletAddress),
        }),
      });
      
      if (response.ok) {
        console.log('✅ New wallet user created successfully');
        setGameBalance(500000);
      } else {
        console.error('❌ Failed to create wallet user, status:', response.status);
      }
    } catch (error) {
      console.error('❌ Wallet user creation error:', error);
    }
  }, []);

  // Auto-fetch database balance when wallet connects (only if not in token mode)
  useEffect(() => {
    if (shouldUseSolanaWallet && solanaWallet.connected && solanaWallet.publicKey && !isTokenMode) {
      console.log('🔗 Wallet connected - fetching database balance...');
      fetchGameBalance(solanaWallet.publicKey.toString());
    }
  }, [shouldUseSolanaWallet, solanaWallet.connected, solanaWallet.publicKey, isTokenMode, fetchGameBalance]);

  // Get current balance and source
  const { balance, source } = getBalanceInfo();
  
  console.log('🎯 Final balance decision:', {
    source,
    balance,
    isTokenMode,
    'solanaWallet.tokenBalance': solanaWallet.tokenBalance,
    'gameBalance': gameBalance,
    'mockWallet.balance': mockWallet.balance
  });

  // RETURN LOGIC: Handle all three modes
  
  // 1. Mock Mode (Phase 2 disabled)
  if (!shouldUseSolanaWallet) {
    console.log('📱 Returning mock wallet interface');
    
    const mockUserId = mockWallet.userId || null;
    const mockDisplayName = mockUserId === 'seed_alice' ? 'Alice' : 
                            mockUserId === 'seed_bob' ? 'Bob' : 
                            mockUserId;
    
    return {
      connected: mockWallet.isConnected, // FIXED: Use isConnected instead of connected
      connecting: false,
      balance: mockWallet.balance || 0,
      userId: mockUserId,
      displayName: mockDisplayName || mockWallet.displayName,
      walletType: 'mock',
      
      disconnect: () => {
        console.log('Mock wallet disconnect');
        mockWallet.disconnect();
      },
      refreshBalance: async () => {
        console.log('Mock wallet refresh balance');
        await mockWallet.refreshBalance();
      },
      
      publicKey: null,
      solBalance: 0,
      walletName: null,
      tokenBalance: 0,
      tokenAccountExists: false,
      isTokenMode: false,
      balanceSource: 'mock',
    };
  }

  // 2. Solana Mode - Connecting
  if (solanaWallet.connecting) {
    console.log('🔄 Returning connecting state');
    
    return {
      connected: false,
      connecting: true,
      balance: 0,
      userId: null,
      displayName: null,
      walletType: 'solana',
      
      disconnect: async () => {
        if (solanaWallet.disconnect) {
          await solanaWallet.disconnect();
        }
      },
      refreshBalance: async () => {},
      
      publicKey: null,
      solBalance: 0,
      walletName: null,
      tokenBalance: 0,
      tokenAccountExists: false,
      isTokenMode: false,
      balanceSource: 'database',
    };
  }

  // 3. Solana Mode - Connected
  if (solanaWallet.connected && solanaWallet.publicKey) {
    console.log('✅ Returning connected Solana wallet interface');
    
    return {
      connected: true,
      connecting: false,
      balance, // This is the key fix - uses the correct balance based on mode
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
          console.log('✅ Disconnect completed');
        } catch (error) {
          console.error('❌ Disconnect error:', error);
        }
      },
      
      refreshBalance: async () => {
        console.log('🔄 Refreshing all balances...');
        try {
          // Always refresh Solana wallet (SOL + token)
          await solanaWallet.refreshBalances();
          
          // Only refresh database if not in token mode
          if (!isTokenMode && solanaWallet.publicKey) {
            await fetchGameBalance(solanaWallet.publicKey.toString());
          }
          
          console.log('✅ Balance refresh completed');
        } catch (error) {
          console.error('❌ Balance refresh error:', error);
        }
      },
      
      publicKey: solanaWallet.publicKey.toString(),
      solBalance: solanaWallet.solBalance,
      walletName: getWalletName(),
      tokenBalance: solanaWallet.tokenBalance,
      tokenAccountExists: solanaWallet.tokenAccountExists,
      isTokenMode,
      balanceSource: source,
    };
  }

  // 4. Solana Mode - Not Connected
  console.log('🔌 Returning disconnected Solana wallet interface');
  
  return {
    connected: false,
    connecting: false,
    balance: 0,
    userId: null,
    displayName: null,
    walletType: 'solana',
    
    disconnect: async () => {},
    refreshBalance: async () => {},
    
    publicKey: null,
    solBalance: 0,
    walletName: null,
    tokenBalance: 0,
    tokenAccountExists: false,
    isTokenMode: false,
    balanceSource: 'database',
  };
};

export const useIsPhase2 = (): boolean => {
  return APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.ENABLE_PHASE2;
};
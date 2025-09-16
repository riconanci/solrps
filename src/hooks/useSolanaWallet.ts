// src/hooks/useSolanaWallet.ts - COMPLETE REWRITE: Working Balance Fetching
"use client";
import { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, getMint } from '@solana/spl-token';
import { APP_CONFIG } from '../config/constants';

export interface SolanaWalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: any | null;
  solBalance: number;
  tokenBalance: number;
  tokenAccountExists: boolean;
  tokenDecimals: number;
  loading: boolean;
  error: string | null;
  wallet: any | null;
  refreshBalances: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useSolanaWallet = (tokenMintAddress?: string): SolanaWalletState => {
  const { connection } = useConnection();
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnect,
    wallet
  } = useWallet();
  
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenAccountExists, setTokenAccountExists] = useState<boolean>(false);
  const [tokenDecimals, setTokenDecimals] = useState<number>(6);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use TOKEN_MINT_ADDRESS from config if not provided
  const mintAddress = tokenMintAddress || APP_CONFIG.TOKEN_MINT_ADDRESS;

  // Debug state logging
  useEffect(() => {
    console.log('🪙 useSolanaWallet State Update:', {
      connected,
      connecting,
      publicKey: publicKey?.toString() || null,
      solBalance,
      tokenBalance,
      tokenAccountExists,
      mintAddress,
      loading,
      error,
      walletName: wallet?.adapter?.name,
      rpcEndpoint: connection?.rpcEndpoint
    });
  }, [connected, connecting, publicKey, solBalance, tokenBalance, tokenAccountExists, mintAddress, loading, error, wallet, connection]);

  // Enhanced SOL balance fetching with retry logic
  const fetchSolBalance = useCallback(async (): Promise<void> => {
    if (!publicKey || !connection) {
      console.log('⚠️ Cannot fetch SOL balance - missing requirements:', {
        hasPublicKey: !!publicKey,
        hasConnection: !!connection
      });
      return;
    }
    
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`💰 Fetching SOL balance (attempt ${attempt + 1}/${maxRetries})...`);
        console.log('🔗 Using endpoint:', connection.rpcEndpoint);
        console.log('👛 For wallet:', publicKey.toString());
        
        const startTime = Date.now();
        const balance = await connection.getBalance(publicKey);
        const endTime = Date.now();
        
        const balanceInSol = balance / LAMPORTS_PER_SOL;
        
        setSolBalance(balanceInSol);
        console.log('✅ SOL balance fetch successful:', {
          lamports: balance,
          sol: balanceInSol,
          responseTime: `${endTime - startTime}ms`,
          formatted: `${balanceInSol.toFixed(6)} SOL`
        });
        
        // Clear any previous errors
        if (error && error.includes('SOL balance')) {
          setError(null);
        }
        
        return; // Success, exit retry loop
        
      } catch (err) {
        attempt++;
        console.error(`❌ SOL balance fetch attempt ${attempt} failed:`, err);
        
        if (attempt >= maxRetries) {
          const errorMessage = `Failed to fetch SOL balance after ${maxRetries} attempts: ${err instanceof Error ? err.message : 'Unknown error'}`;
          setError(errorMessage);
          setSolBalance(0);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }, [publicKey, connection, error]);

  // Enhanced SPL token balance fetching
  const fetchTokenBalance = useCallback(async (): Promise<void> => {
    if (!publicKey || !connection || !mintAddress) {
      console.log('⚠️ Cannot fetch token balance - missing requirements:', {
        hasPublicKey: !!publicKey,
        hasConnection: !!connection,
        hasMintAddress: !!mintAddress
      });
      return;
    }
    
    try {
      console.log('🪙 Fetching token balance for:', {
        wallet: publicKey.toString(),
        mint: mintAddress,
        endpoint: connection.rpcEndpoint
      });
      
      const tokenMintPublicKey = new PublicKey(mintAddress);
      
      // First, get mint info for decimals
      let decimals = 6; // Default
      try {
        const mintInfo = await getMint(connection, tokenMintPublicKey);
        decimals = mintInfo.decimals;
        setTokenDecimals(decimals);
        console.log('📊 Token mint info:', {
          decimals: mintInfo.decimals,
          supply: mintInfo.supply.toString(),
          mintAuthority: mintInfo.mintAuthority?.toString()
        });
      } catch (mintError) {
        console.warn('⚠️ Could not fetch mint info, using default decimals:', mintError);
        setTokenDecimals(6);
      }
      
      // Get associated token address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        publicKey
      );
      
      console.log('📍 Associated token address:', associatedTokenAddress.toString());
      
      // Check if token account exists
      const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAddress);
      
      if (tokenAccountInfo) {
        setTokenAccountExists(true);
        
        // Get token account data
        const tokenAccount = await getAccount(connection, associatedTokenAddress);
        const rawBalance = Number(tokenAccount.amount);
        
        // Apply decimals
        const formattedBalance = rawBalance / Math.pow(10, decimals);
        
        setTokenBalance(formattedBalance);
        console.log('✅ Token balance fetched successfully:', {
          raw: rawBalance,
          formatted: formattedBalance,
          decimals: decimals,
          display: `${formattedBalance.toLocaleString()} tokens`
        });
        
      } else {
        setTokenAccountExists(false);
        setTokenBalance(0);
        console.log('❌ Token account does not exist');
        console.log('💡 To create: spl-token create-account', mintAddress);
      }
      
    } catch (err) {
      console.error('❌ Token balance fetch failed:', err);
      setTokenAccountExists(false);
      setTokenBalance(0);
      
      // Only set error for non-account-missing errors
      if (err instanceof Error && 
          !err.message.includes('Invalid account') && 
          !err.message.includes('could not find account')) {
        setError(`Token balance error: ${err.message}`);
      }
    }
  }, [publicKey, connection, mintAddress]);

  // Main refresh function
  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!connected || !publicKey) {
      console.log('⚠️ Cannot refresh - wallet not connected');
      return;
    }
    
    console.log('🔄 Starting balance refresh...');
    setLoading(true);
    setError(null);
    
    try {
      // Always fetch SOL balance
      const solPromise = fetchSolBalance();
      
      // Only fetch token balance if mint address is configured
      const tokenPromise = mintAddress ? fetchTokenBalance() : Promise.resolve();
      
      await Promise.all([solPromise, tokenPromise]);
      
      console.log('✅ Balance refresh completed successfully');
      
    } catch (err) {
      console.error('❌ Balance refresh failed:', err);
      setError('Failed to refresh balances');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, fetchSolBalance, fetchTokenBalance, mintAddress]);

  // Auto-refresh on connection
  useEffect(() => {
    if (connected && publicKey) {
      console.log('🔗 Wallet connected - starting initial balance fetch...');
      refreshBalances();
    } else {
      console.log('🔌 Wallet disconnected - clearing balances...');
      setSolBalance(0);
      setTokenBalance(0);
      setTokenAccountExists(false);
      setError(null);
    }
  }, [connected, publicKey, refreshBalances]);

  // Periodic refresh when connected
  useEffect(() => {
    if (connected && publicKey && !loading) {
      console.log('⏱️ Setting up periodic balance refresh...');
      
      const interval = setInterval(() => {
        console.log('⏰ Periodic balance refresh triggered...');
        refreshBalances();
      }, APP_CONFIG.BALANCE_REFRESH_INTERVAL);
      
      return () => {
        console.log('⏱️ Clearing periodic refresh interval');
        clearInterval(interval);
      };
    }
  }, [connected, publicKey, loading, refreshBalances]);

  return {
    connected,
    connecting,
    publicKey,
    solBalance,
    tokenBalance,
    tokenAccountExists,
    tokenDecimals,
    loading,
    error,
    wallet,
    refreshBalances,
    disconnect,
  };
};
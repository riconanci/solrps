// src/hooks/useSolanaWallet.ts - Clean Solana Wallet Hook
"use client";
import { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface SolanaWalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: any | null;
  solBalance: number;
  tokenBalance: number;
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch SOL balance
  const fetchSolBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    
    try {
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
      console.log('💰 SOL Balance:', balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Error fetching SOL balance:', err);
      setError('Failed to fetch SOL balance');
    }
  }, [publicKey, connection]);

  // Refresh all balances
  const refreshBalances = useCallback(async () => {
    if (!connected || !publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await fetchSolBalance();
    } catch (err) {
      console.error('Error refreshing balances:', err);
      setError('Failed to refresh balances');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, fetchSolBalance]);

  // Auto-refresh balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalances();
    } else {
      setSolBalance(0);
      setTokenBalance(0);
      setError(null);
    }
  }, [connected, publicKey, refreshBalances]);

  return {
    connected,
    connecting,
    publicKey,
    solBalance,
    tokenBalance,
    loading,
    error,
    wallet,
    refreshBalances,
    disconnect,
  };
};
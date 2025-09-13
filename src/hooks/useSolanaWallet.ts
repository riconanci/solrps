// src/hooks/useSolanaWallet.ts - Enhanced wallet hook
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export interface SolanaWalletState {
  // Wallet connection
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  
  // Balances
  solBalance: number;
  tokenBalance: number;
  
  // Status
  loading: boolean;
  error: string | null;
  
  // Functions
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
    sendTransaction,
    wallet
  } = useWallet();
  
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch SOL balance
  const fetchSolBalance = async () => {
    if (!publicKey) return;
    
    try {
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Error fetching SOL balance:', err);
      setError('Failed to fetch SOL balance');
    }
  };

  // Fetch token balance (if using custom SPL token)
  const fetchTokenBalance = async () => {
    if (!publicKey || !tokenMintAddress) return;
    
    try {
      const tokenMint = new PublicKey(tokenMintAddress);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        tokenMint,
        publicKey
      );
      
      const tokenAccount = await getAccount(connection, tokenAccountAddress);
      setTokenBalance(Number(tokenAccount.amount));
    } catch (err) {
      // Token account might not exist - that's okay, balance is 0
      setTokenBalance(0);
    }
  };

  // Refresh all balances
  const refreshBalances = async () => {
    if (!connected || !publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSolBalance(),
        fetchTokenBalance(),
      ]);
    } catch (err) {
      console.error('Error refreshing balances:', err);
      setError('Failed to refresh balances');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalances();
    } else {
      setSolBalance(0);
      setTokenBalance(0);
      setError(null);
    }
  }, [connected, publicKey, tokenMintAddress]);

  return {
    connected,
    connecting,
    publicKey,
    solBalance,
    tokenBalance,
    loading,
    error,
    refreshBalances,
    disconnect,
  };
};
// src/components/SolanaWalletProvider.tsx
"use client";
import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
  GlowWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;

  // RPC endpoint - can be customized via environment variable
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    return clusterApiUrl(network);
  }, [network]);

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new GlowWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

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
}

export const useSolanaWallet = (tokenMintAddress?: string) => {
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

  // Periodic balance refresh (every 30 seconds)
  useEffect(() => {
    if (!connected) return;
    
    const interval = setInterval(refreshBalances, 30000);
    return () => clearInterval(interval);
  }, [connected]);

  const walletState: SolanaWalletState = {
    connected,
    connecting,
    publicKey,
    solBalance,
    tokenBalance,
    loading,
    error,
  };

  return {
    ...walletState,
    wallet,
    connection,
    sendTransaction,
    disconnect,
    refreshBalances,
  };
};

// src/components/WalletButton.tsx - Custom wallet connection button
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';

export const WalletButton = () => {
  const { solBalance, tokenBalance, connected, loading } = useSolanaWallet();

  return (
    <div className="flex items-center gap-3">
      {/* Balance Display */}
      {connected && (
        <div className="text-right">
          <div className="text-xs text-gray-400">
            {loading ? 'Loading...' : 'Balance'}
          </div>
          <div className="text-sm font-mono text-green-400">
            {solBalance.toFixed(2)} SOL
            {tokenBalance > 0 && (
              <div className="text-xs text-blue-400">
                {tokenBalance.toLocaleString()} RPS
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Wallet Connection Button */}
      <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600 !rounded-lg !px-4 !py-2 !text-sm" />
    </div>
  );
};

// src/components/WalletGuard.tsx - Component to ensure wallet is connected
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ReactNode } from 'react';

interface WalletGuardProps {
  children: ReactNode;
  message?: string;
}

export const WalletGuard = ({ 
  children, 
  message = "Connect your wallet to play SolRPS" 
}: WalletGuardProps) => {
  const { connected, connecting } = useWallet();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Wallet Required</h2>
          <p className="text-gray-400 mb-6">{message}</p>
        </div>
        
        <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600 !rounded-lg !px-6 !py-3" />
        
        {connecting && (
          <div className="text-sm text-gray-400">
            Connecting to wallet...
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
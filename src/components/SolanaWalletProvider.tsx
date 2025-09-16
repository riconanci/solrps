// src/components/SolanaWalletProvider.tsx - COMPLETE REWRITE: Working Wallet Provider
"use client";
import React, { FC, ReactNode, useMemo, useCallback, useEffect } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
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

interface WalletError {
  message: string;
  code?: string | number;
  name?: string;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  console.log('🔗 Initializing COMPLETE REWRITE SolanaWalletProvider...');

  // Network configuration with validation
  const network = useMemo(() => {
    const clusterEnv = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
    console.log('🌐 Raw cluster env:', clusterEnv);
    
    let networkValue: WalletAdapterNetwork;
    
    switch (clusterEnv?.toLowerCase()) {
      case 'mainnet-beta':
      case 'mainnet':
        networkValue = WalletAdapterNetwork.Mainnet;
        break;
      case 'testnet':
        networkValue = WalletAdapterNetwork.Testnet;
        break;
      case 'devnet':
      default:
        networkValue = WalletAdapterNetwork.Devnet;
        break;
    }
    
    console.log('🌐 Network resolved to:', networkValue);
    return networkValue;
  }, []);

  // RPC endpoint with fallback validation
  const endpoint = useMemo(() => {
    const customRPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    
    if (customRPC) {
      console.log('🌐 Using custom RPC:', customRPC);
      return customRPC;
    }
    
    const defaultRPC = clusterApiUrl(network);
    console.log('🌐 Using default RPC for', network, ':', defaultRPC);
    return defaultRPC;
  }, [network]);

  // Initialize wallet adapters with enhanced error handling
  const wallets = useMemo(() => {
    console.log('💰 Initializing wallet adapters...');
    
    const adapters = [];
    
    try {
      // Phantom Wallet
      console.log('🟣 Initializing Phantom wallet...');
      const phantom = new PhantomWalletAdapter();
      adapters.push(phantom);
      console.log('✅ Phantom wallet adapter ready');
    } catch (error) {
      console.warn('⚠️ Phantom adapter failed:', error);
    }
    
    try {
      // Solflare Wallet
      console.log('🟠 Initializing Solflare wallet...');
      const solflare = new SolflareWalletAdapter({ network });
      adapters.push(solflare);
      console.log('✅ Solflare wallet adapter ready');
    } catch (error) {
      console.warn('⚠️ Solflare adapter failed:', error);
    }
    
    console.log(`✅ Total wallet adapters: ${adapters.length}`);
    return adapters;
  }, [network]);

  // Enhanced error handler
  const handleWalletError = useCallback((error: WalletError) => {
    console.error('🚨 Wallet Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    
    // Don't show intrusive alerts for common errors
    switch (error.name) {
      case 'WalletNotConnectedError':
        console.log('ℹ️ Wallet not connected (normal state)');
        break;
      case 'WalletConnectionError':
        console.log('🔄 Connection failed - user might have rejected');
        break;
      case 'WalletDisconnectedError':
        console.log('ℹ️ Wallet disconnected');
        break;
      default:
        console.error('❌ Unexpected wallet error');
    }
  }, []);

  // Connection configuration
  const connectionConfig = useMemo(() => ({
    commitment: 'confirmed' as const,
    confirmTransactionInitialTimeout: 60000,
  }), []);

  // Wallet configuration
  const walletConfig = useMemo(() => ({
    wallets,
    autoConnect: false,
    onError: handleWalletError,
    localStorageKey: 'solrps-wallet',
  }), [wallets, handleWalletError]);

  // Debug wallet detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const windowAny = window as any;
      
      setTimeout(() => {
        console.log('🔍 Wallet Detection:', {
          phantom: !!windowAny.phantom?.solana?.isPhantom,
          solflare: !!windowAny.solflare?.isSolflare,
          solana: !!windowAny.solana,
        });
      }, 1000);
    }
  }, []);

  // Validate before rendering
  if (wallets.length === 0) {
    console.error('❌ No wallet adapters available');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-4 p-6 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-xl font-bold">Wallet Setup Required</h2>
          <p className="text-gray-400">
            Please install a Solana wallet extension to continue.
          </p>
          <div className="space-y-2">
            <a 
              href="https://phantom.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              📦 Install Phantom Wallet
            </a>
            <a 
              href="https://solflare.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              📦 Install Solflare Wallet
            </a>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    );
  }

  console.log('✅ Rendering wallet provider with config:', {
    endpoint,
    network,
    walletsCount: wallets.length,
  });

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={connectionConfig}
    >
      <WalletProvider {...walletConfig}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
// src/components/SolanaWalletProvider.tsx - Clean Solana Wallet Provider
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
  console.log('🔗 Initializing SolanaWalletProvider...');

  // Network configuration
  const network = useMemo(() => {
    const clusterEnv = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
    let networkValue: WalletAdapterNetwork;
    
    switch (clusterEnv) {
      case 'mainnet-beta':
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
    
    console.log('🌐 Network configuration:', {
      environment: clusterEnv,
      resolved: networkValue,
    });
    
    return networkValue;
  }, []);

  // RPC endpoint configuration
  const endpoint = useMemo(() => {
    const customRPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    const defaultRPC = clusterApiUrl(network);
    const finalEndpoint = customRPC || defaultRPC;
    
    console.log('🌐 RPC Configuration:', {
      customRPC,
      defaultRPC,
      finalEndpoint,
    });
    
    return finalEndpoint;
  }, [network]);

  // Initialize wallet adapters
  const wallets = useMemo(() => {
    console.log('💰 Initializing wallet adapters...');
    
    try {
      const adapters = [];
      
      // Initialize Phantom Wallet
      try {
        const phantom = new PhantomWalletAdapter();
        adapters.push(phantom);
        console.log('✅ Phantom wallet adapter initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Phantom adapter:', error);
      }
      
      // Initialize Solflare Wallet  
      try {
        const solflare = new SolflareWalletAdapter({ network });
        adapters.push(solflare);
        console.log('✅ Solflare wallet adapter initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Solflare adapter:', error);
      }
      
      console.log(`✅ Total wallet adapters initialized: ${adapters.length}`);
      
      if (adapters.length === 0) {
        console.error('❌ No wallet adapters could be initialized!');
        throw new Error('No wallet adapters available');
      }
      
      return adapters;
    } catch (error) {
      console.error('❌ Critical error initializing wallet adapters:', error);
      return [];
    }
  }, [network]);

  // Error handler for wallet operations
  const handleWalletError = useCallback((error: WalletError) => {
    console.error('🚨 Wallet operation error:', error);
    
    // Enhanced error categorization
    switch (error.name) {
      case 'WalletNotConnectedError':
        console.log('ℹ️ Wallet not connected - this is normal for initial state');
        break;
      case 'WalletConnectionError':
        console.log('🔄 Wallet connection failed - user may have rejected or wallet unavailable');
        console.log('💡 Make sure you have Phantom or Solflare extension installed');
        break;
      case 'WalletDisconnectedError':
        console.log('ℹ️ Wallet disconnected - user initiated or wallet closed');
        break;
      case 'WalletNotReadyError':
        console.log('⏳ Wallet not ready - extension may still be loading');
        break;
      case 'WalletNotInstalledError':
        console.log('📦 Wallet not installed - please install Phantom or Solflare extension');
        break;
      default:
        console.error('❌ Unexpected wallet error:', {
          name: error.name,
          message: error.message,
          code: error.code,
        });
        break;
    }
  }, []);

  // Connection provider configuration
  const connectionConfig = useMemo(() => ({
    commitment: 'confirmed' as const,
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
  }), []);

  // Wallet provider configuration
  const walletConfig = useMemo(() => ({
    wallets,
    autoConnect: false, // Manual connection for better UX
    onError: handleWalletError,
    localStorageKey: 'solrps-wallet-adapter',
  }), [wallets, handleWalletError]);

  // Debug wallet detection on mount
  useEffect(() => {
    console.log('🔍 Checking for installed wallets...');
    
    if (typeof window !== 'undefined') {
      const windowAny = window as any;
      
      if (windowAny.phantom?.solana?.isPhantom) {
        console.log('✅ Phantom wallet detected');
      } else {
        console.log('❌ Phantom wallet not detected');
      }
      
      if (windowAny.solflare?.isSolflare) {
        console.log('✅ Solflare wallet detected');
      } else {
        console.log('❌ Solflare wallet not detected');
      }
      
      if (!windowAny.phantom?.solana && !windowAny.solflare) {
        console.log('⚠️ No Solana wallets detected. Please install Phantom or Solflare.');
      }
    }
  }, []);

  // Log final configuration
  console.log('⚙️ Final wallet provider configuration:', {
    endpoint,
    network,
    walletsCount: wallets.length,
    autoConnect: walletConfig.autoConnect,
    commitment: connectionConfig.commitment,
  });

  // Validate configuration before rendering
  if (wallets.length === 0) {
    console.error('❌ Cannot render wallet provider: No wallets available');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center space-y-4 p-6">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-xl font-bold">Wallet System Error</h2>
          <p className="text-gray-400 max-w-md">
            No wallet adapters could be loaded. Please refresh the page or install a Solana wallet extension.
          </p>
          <div className="space-y-2">
            <a 
              href="https://phantom.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Install Phantom Wallet
            </a>
            <a 
              href="https://solflare.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              Install Solflare Wallet
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

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={connectionConfig}
    >
      <WalletProvider {...walletConfig}>
        <WalletModalProvider>
          <WalletConnectionMonitor>
            {children}
          </WalletConnectionMonitor>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

// Component to monitor wallet connection events
function WalletConnectionMonitor({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
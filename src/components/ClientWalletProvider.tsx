// src/components/ClientWalletProvider.tsx - COMPLETE REWRITE: Proper Client-Side Wallet Provider (ORIGINAL: 0 lines → NEW: ~200+ lines)
"use client";
import { ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
}

interface WalletConfig {
  useBlockchain: boolean;
  enablePhase2: boolean;
  solanaCluster: string;
  solanaRpcUrl?: string;
}

export function ClientWalletProvider({ children }: Props) {
  const [isClient, setIsClient] = useState(false);
  const [walletProvider, setWalletProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'configuring' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeProvider = async () => {
      try {
        setIsClient(true);
        setLoadingState('configuring');
        
        // Get configuration from environment variables
        const walletConfig: WalletConfig = {
          useBlockchain: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true',
          enablePhase2: process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true',
          solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
          solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
        };
        
        setConfig(walletConfig);
        
        console.log('🔧 Wallet Provider Configuration:', {
          useBlockchain: walletConfig.useBlockchain,
          enablePhase2: walletConfig.enablePhase2,
          cluster: walletConfig.solanaCluster,
          hasCustomRpc: !!walletConfig.solanaRpcUrl,
        });

        if (walletConfig.enablePhase2 && walletConfig.useBlockchain) {
          console.log('🔗 Loading SolanaWalletProvider for blockchain mode...');
          
          // Dynamic import for blockchain mode with detailed error handling
          try {
            const { SolanaWalletProvider } = await import('../components/SolanaWalletProvider');
            console.log('✅ SolanaWalletProvider loaded successfully');
            
            // Verify wallet adapters are available
            const { PhantomWalletAdapter, SolflareWalletAdapter } = await import('@solana/wallet-adapter-wallets');
            console.log('✅ Wallet adapters loaded successfully');
            
            setWalletProvider(() => SolanaWalletProvider);
            setLoadingState('ready');
            
          } catch (importError) {
            console.error('❌ Failed to load wallet components:', importError);
            setError('Failed to load wallet adapters. Please check your internet connection and try refreshing.');
            
            // Fallback to mock mode
            console.log('🔄 Falling back to mock mode due to import error');
            setWalletProvider(() => MockWalletProvider);
            setLoadingState('ready');
          }
          
        } else {
          // Mock mode - no wallet provider needed
          console.log('📱 Using mock wallet mode');
          setWalletProvider(() => MockWalletProvider);
          setLoadingState('ready');
        }
        
      } catch (configError) {
        console.error('❌ Failed to configure wallet provider:', configError);
        setError('Failed to initialize wallet provider. Please refresh the page.');
        setLoadingState('error');
      }
    };

    initializeProvider();
  }, []);

  // Loading state while initializing
  if (!isClient || loadingState === 'loading' || loadingState === 'configuring') {
    return <LoadingScreen state={loadingState} />;
  }

  // Error state
  if (loadingState === 'error' || !walletProvider) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  // Render with the appropriate wallet provider
  const WalletProvider = walletProvider;
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}

// Mock wallet provider (passthrough component)
function MockWalletProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Loading screen component
function LoadingScreen({ state }: { state: string }) {
  const messages = {
    loading: 'Initializing wallet system...',
    configuring: 'Configuring wallet provider...',
    ready: 'Almost ready...',
    error: 'Error occurred...',
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          {/* Animated Logo */}
          <div className="text-6xl animate-pulse">⚔️</div>
          
          {/* App Title */}
          <div>
            <h1 className="text-3xl font-bold mb-2">SolRPS</h1>
            <p className="text-gray-400 text-sm">Rock Paper Scissors on Solana</p>
          </div>
          
          {/* Loading Indicator */}
          <div className="space-y-3">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto"></div>
            </div>
            
            <p className="text-gray-300 text-sm">
              {messages[state as keyof typeof messages] || 'Loading...'}
            </p>
          </div>
          
          {/* Progress Dots */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all duration-500 ${
                  state === 'loading' && i === 0 ? 'bg-blue-500' :
                  state === 'configuring' && i === 1 ? 'bg-blue-500' :
                  state === 'ready' && i === 2 ? 'bg-green-500' :
                  'bg-gray-600'
                }`}
                style={{
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          
          {/* Environment Info (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-gray-400">
              <div className="space-y-1">
                <div>Phase 2: {process.env.NEXT_PUBLIC_ENABLE_PHASE2 || 'false'}</div>
                <div>Blockchain: {process.env.NEXT_PUBLIC_USE_BLOCKCHAIN || 'false'}</div>
                <div>Cluster: {process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Error screen component
function ErrorScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          {/* Error Icon */}
          <div className="text-6xl text-red-500">⚠️</div>
          
          {/* Error Message */}
          <div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Wallet Provider Error</h1>
            <p className="text-gray-300 text-sm mb-4">
              {error || 'Failed to initialize wallet provider'}
            </p>
          </div>
          
          {/* Retry Button */}
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            🔄 Retry
          </button>
          
          {/* Troubleshooting Tips */}
          <div className="mt-6 p-4 bg-gray-900/50 border border-gray-700 rounded-lg text-left text-sm text-gray-300">
            <h3 className="font-medium mb-2">Troubleshooting:</h3>
            <ul className="space-y-1 text-xs">
              <li>• Check your internet connection</li>
              <li>• Refresh the page (Ctrl/Cmd + R)</li>
              <li>• Clear browser cache and cookies</li>
              <li>• Try a different browser</li>
              <li>• Disable browser extensions temporarily</li>
            </ul>
          </div>
          
          {/* Development Info */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-left">
              <summary className="text-xs font-medium cursor-pointer">Debug Info</summary>
              <div className="mt-2 text-xs text-gray-400 space-y-1">
                <div>Error: {error}</div>
                <div>Environment: {process.env.NODE_ENV}</div>
                <div>User Agent: {navigator.userAgent}</div>
                <div>Timestamp: {new Date().toISOString()}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
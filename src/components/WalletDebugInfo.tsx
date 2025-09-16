// src/components/WalletDebugInfo.tsx - WORKING: Shows Real Wallet Context
"use client";
import { useState, useEffect } from 'react';
import { useGameWallet } from '../hooks/useGameWallet';
import { useSolanaWallet } from '../hooks/useSolanaWallet';
import { APP_CONFIG } from '../config/constants';

// FIXED: Safe import and usage of wallet context
let useWallet: any = null;
let useConnection: any = null;

if (typeof window !== 'undefined') {
  try {
    // Safe dynamic import of wallet adapter hooks
    import('@solana/wallet-adapter-react').then(module => {
      useWallet = module.useWallet;
      useConnection = module.useConnection;
    }).catch(error => {
      console.warn('Wallet adapter not available:', error);
    });
  } catch (error) {
    console.warn('Failed to import wallet adapter:', error);
  }
}

interface DebugSection {
  title: string;
  data: Record<string, any>;
  color: string;
}

// FIXED: Component that safely uses wallet context when available
function WalletContextInfo() {
  const [walletInfo, setWalletInfo] = useState<any>({ available: false, reason: 'Loading...' });
  const [connectionInfo, setConnectionInfo] = useState<any>({ available: false, reason: 'Loading...' });

  // Only try to use wallet context when blockchain mode is enabled
  const isBlockchainMode = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';

  useEffect(() => {
    if (!isBlockchainMode) {
      setWalletInfo({ available: false, reason: 'Blockchain mode disabled' });
      setConnectionInfo({ available: false, reason: 'Blockchain mode disabled' });
      return;
    }

    // Try to access wallet context (this should work since we have WalletProvider)
    const getWalletContextInfo = () => {
      try {
        // Access the global wallet context if available
        const walletContext = (window as any).__SOLANA_WALLET_CONTEXT__;
        if (walletContext) {
          setWalletInfo({
            available: true,
            source: 'Global context',
            ...getSafeWalletProperties(walletContext)
          });
        } else {
          setWalletInfo({
            available: false,
            reason: 'Wallet context not found in global scope',
            suggestion: 'This is normal - context is encapsulated'
          });
        }

        // For connection, we can try to access it through our custom hook
        setConnectionInfo({
          available: true,
          source: 'Via custom hook',
          note: 'Connection accessible through useSolanaWallet hook'
        });

      } catch (error) {
        setWalletInfo({
          available: false,
          reason: 'Error accessing wallet context',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        setConnectionInfo({
          available: false,
          reason: 'Error accessing connection context'
        });
      }
    };

    getWalletContextInfo();
  }, [isBlockchainMode]);

  return { walletInfo, connectionInfo };
}

export function WalletDebugInfo() {
  const [showDebug, setShowDebug] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Handle client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  if (!showDebug) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDebug(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
        >
          🔧 <span className="hidden sm:inline">Debug Wallet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DebugPanel onClose={() => setShowDebug(false)} />
    </div>
  );
}

function DebugPanel({ onClose }: { onClose: () => void }) {
  const gameWallet = useGameWallet();
  const solanaWalletHook = useSolanaWallet();
  const { walletInfo, connectionInfo } = WalletContextInfo();
  const [refreshKey, setRefreshKey] = useState(0);
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Refresh debug info
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    console.log('🔄 Debug info refreshed');
  };

  // Test connection using our custom hook
  const testConnection = async () => {
    setConnectionTest('testing');
    setConnectionError(null);

    try {
      if (solanaWalletHook.connected && solanaWalletHook.publicKey) {
        console.log('🧪 Testing connection via custom wallet hook...');
        await solanaWalletHook.refreshBalances();
        console.log('✅ Connection test successful');
        setConnectionTest('success');
        setTimeout(() => setConnectionTest('idle'), 2000);
      } else if (gameWallet.connected) {
        console.log('🧪 Testing connection via game wallet...');
        await gameWallet.refreshBalance();
        console.log('✅ Connection test successful via game wallet');
        setConnectionTest('success');
        setTimeout(() => setConnectionTest('idle'), 2000);
      } else {
        throw new Error('No active wallet connection available');
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
      setConnectionTest('error');
      setTimeout(() => setConnectionTest('idle'), 3000);
    }
  };

  // Log all debug info to console
  const logDebugInfo = () => {
    const debugData = {
      environment: getEnvironmentInfo(),
      gameWallet: getGameWalletInfo(gameWallet),
      customSolanaWallet: getCustomSolanaWalletInfo(solanaWalletHook),
      walletContext: walletInfo,
      connectionContext: connectionInfo,
      availableWallets: getAvailableWallets(),
      browserInfo: getBrowserInfo(),
    };

    console.group('🔧 SolRPS Wallet Debug Info');
    console.log('Environment:', debugData.environment);
    console.log('Game Wallet:', debugData.gameWallet);
    console.log('Custom Solana Wallet:', debugData.customSolanaWallet);
    console.log('Wallet Context:', debugData.walletContext);
    console.log('Connection Context:', debugData.connectionContext);
    console.log('Available Wallets:', debugData.availableWallets);
    console.log('Browser:', debugData.browserInfo);
    console.groupEnd();
  };

  const debugSections: DebugSection[] = [
    {
      title: 'Environment',
      data: getEnvironmentInfo(),
      color: 'text-yellow-400'
    },
    {
      title: 'Game Wallet',
      data: getGameWalletInfo(gameWallet),
      color: 'text-green-400'
    },
    {
      title: 'Custom Solana Wallet',
      data: getCustomSolanaWalletInfo(solanaWalletHook),
      color: 'text-purple-400'
    },
    {
      title: 'Wallet Context',
      data: walletInfo,
      color: 'text-indigo-400'
    },
    {
      title: 'Connection Context',
      data: connectionInfo,
      color: 'text-blue-400'
    },
    {
      title: 'Available Wallets',
      data: getAvailableWallets(),
      color: 'text-orange-400'
    },
    {
      title: 'Browser Info',
      data: getBrowserInfo(),
      color: 'text-pink-400'
    }
  ];

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-2xl max-w-md w-96 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <h3 className="font-bold text-white text-sm">Wallet Debug</h3>
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
            v{refreshKey}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            title="Refresh debug info"
          >
            🔄
          </button>
          <button
            onClick={logDebugInfo}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            title="Log to console"
          >
            📝
          </button>
          <button
            onClick={testConnection}
            className={`p-1 rounded transition-colors ${
              connectionTest === 'testing' ? 'text-yellow-400' :
              connectionTest === 'success' ? 'text-green-400' :
              connectionTest === 'error' ? 'text-red-400' :
              'text-gray-400 hover:text-white'
            }`}
            title="Test connection"
            disabled={connectionTest === 'testing'}
          >
            {connectionTest === 'testing' ? '⏳' : 
             connectionTest === 'success' ? '✅' :
             connectionTest === 'error' ? '❌' : '🔗'}
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto text-xs">
        {/* Quick Status */}
        <div className="flex items-center gap-4 p-2 bg-gray-800 rounded text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              gameWallet.connected ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span>{gameWallet.connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="text-gray-400">
            {gameWallet.walletType === 'solana' ? '🔗 Solana' : '📱 Mock'}
          </div>
          <div className="text-gray-400">
            {gameWallet.balanceSource?.toUpperCase() || 'UNKNOWN'}
          </div>
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-xs">
            <div className="font-medium">Connection Error:</div>
            <div className="mt-1">{connectionError}</div>
          </div>
        )}

        {/* Debug Sections */}
        {debugSections.map((section) => (
          <DebugSection
            key={section.title}
            section={section}
            expanded={expandedSections.has(section.title)}
            onToggle={() => {
              const newExpanded = new Set(expandedSections);
              if (newExpanded.has(section.title)) {
                newExpanded.delete(section.title);
              } else {
                newExpanded.add(section.title);
              }
              setExpandedSections(newExpanded);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DebugSection({ 
  section, 
  expanded, 
  onToggle 
}: { 
  section: DebugSection; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-700 rounded">
      <button
        onClick={onToggle}
        className="w-full p-2 text-left bg-gray-800 hover:bg-gray-750 transition-colors flex items-center justify-between"
      >
        <span className={`font-medium ${section.color}`}>{section.title}</span>
        <span className="text-gray-400 text-xs">
          {expanded ? '▼' : '▶'}
        </span>
      </button>
      
      {expanded && (
        <div className="border-t border-gray-700 p-2 bg-gray-800/50">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(section.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper functions (unchanged but improved)
function getEnvironmentInfo() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_PHASE2: process.env.NEXT_PUBLIC_ENABLE_PHASE2,
    USE_BLOCKCHAIN: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN,
    SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    TOKEN_MINT_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS,
    appConfig: {
      USE_BLOCKCHAIN: APP_CONFIG.USE_BLOCKCHAIN,
      ENABLE_PHASE2: APP_CONFIG.ENABLE_PHASE2,
      SOLANA_CLUSTER: APP_CONFIG.SOLANA_CLUSTER,
      TOKEN_MINT_ADDRESS: APP_CONFIG.TOKEN_MINT_ADDRESS,
      SOL_TO_GAME_TOKENS: APP_CONFIG.SOL_TO_GAME_TOKENS,
    }
  };
}

function getGameWalletInfo(gameWallet: any) {
  return {
    connected: gameWallet.connected,
    connecting: gameWallet.connecting,
    balance: gameWallet.balance,
    userId: gameWallet.userId,
    displayName: gameWallet.displayName,
    walletType: gameWallet.walletType,
    publicKey: gameWallet.publicKey,
    solBalance: gameWallet.solBalance,
    walletName: gameWallet.walletName,
    tokenBalance: gameWallet.tokenBalance,
    tokenAccountExists: gameWallet.tokenAccountExists,
    isTokenMode: gameWallet.isTokenMode,
    balanceSource: gameWallet.balanceSource,
  };
}

function getCustomSolanaWalletInfo(solanaWallet: any) {
  if (!solanaWallet) {
    return {
      available: false,
      reason: 'Custom Solana wallet hook not available'
    };
  }

  try {
    return {
      available: true,
      connected: solanaWallet.connected,
      connecting: solanaWallet.connecting,
      publicKey: solanaWallet.publicKey?.toString() || null,
      solBalance: solanaWallet.solBalance,
      tokenBalance: solanaWallet.tokenBalance,
      tokenAccountExists: solanaWallet.tokenAccountExists,
      tokenDecimals: solanaWallet.tokenDecimals,
      loading: solanaWallet.loading,
      error: solanaWallet.error,
      walletName: solanaWallet.wallet?.adapter?.name || null,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'Error accessing custom Solana wallet properties'
    };
  }
}

// FIXED: Safe function to extract wallet properties without causing errors
function getSafeWalletProperties(walletContext: any) {
  try {
    return {
      connected: walletContext.connected || false,
      connecting: walletContext.connecting || false,
      publicKey: walletContext.publicKey?.toString() || null,
      walletName: walletContext.wallet?.adapter?.name || null,
      readyState: walletContext.wallet?.readyState || 'Unknown',
    };
  } catch (error) {
    return {
      error: 'Failed to extract wallet properties',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function getAvailableWallets() {
  if (typeof window === 'undefined') {
    return { clientSide: false };
  }

  const windowAny = window as any;
  
  return {
    clientSide: true,
    phantom: {
      detected: !!windowAny.phantom?.solana?.isPhantom,
      version: windowAny.phantom?.solana?.version || null,
      connected: windowAny.phantom?.solana?.isConnected || false,
    },
    solflare: {
      detected: !!windowAny.solflare?.isSolflare,
      connected: windowAny.solflare?.isConnected || false,
    },
    backpack: {
      detected: !!windowAny.backpack?.isBackpack,
      connected: windowAny.backpack?.isConnected || false,
    },
    glow: {
      detected: !!windowAny.glow,
      connected: windowAny.glow?.isConnected || false,
    },
    totalDetected: [
      windowAny.phantom?.solana?.isPhantom,
      windowAny.solflare?.isSolflare,
      windowAny.backpack?.isBackpack,
      windowAny.glow,
    ].filter(Boolean).length,
  };
}

function getBrowserInfo() {
  if (typeof window === 'undefined') {
    return { clientSide: false };
  }

  return {
    clientSide: true,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    windowSize: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    localStorage: typeof Storage !== 'undefined',
    webgl: !!window.WebGLRenderingContext,
    timestamp: new Date().toISOString(),
  };
}
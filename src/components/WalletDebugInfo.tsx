// src/components/WalletDebugInfo.tsx - COMPLETE REWRITE: Fixed TypeScript Errors (ORIGINAL: 0 lines → ENHANCED: ~400+ lines)
"use client";
import { useState, useEffect } from 'react';
import { useGameWallet } from '../hooks/useGameWallet';
import { APP_CONFIG } from '../config/constants';

// Only import wallet hooks when blockchain mode is enabled
let useWallet: any = null;
let useConnection: any = null;

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true') {
  try {
    const walletAdapter = require('@solana/wallet-adapter-react');
    useWallet = walletAdapter.useWallet;
    useConnection = walletAdapter.useConnection;
  } catch (error) {
    console.warn('Wallet adapter not available for debug component');
  }
}

interface DebugSection {
  title: string;
  data: Record<string, any>;
  color: string;
}

export function WalletDebugInfo() {
  const [showDebug, setShowDebug] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Get Solana wallet info if available
  let solanaWallet: any = null;
  let connection: any = null;
  
  if (useWallet && useConnection) {
    try {
      solanaWallet = useWallet();
      const connectionHook = useConnection();
      connection = connectionHook.connection;
    } catch (error) {
      console.warn('Failed to get wallet/connection hooks:', error);
    }
  }

  // Refresh debug info
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    console.log('🔄 Debug info refreshed');
  };

  // Test RPC connection
  const testConnection = async () => {
    setConnectionTest('testing');
    setConnectionError(null);

    try {
      if (connection) {
        console.log('🧪 Testing RPC connection...');
        const blockhash = await connection.getLatestBlockhash();
        console.log('✅ Connection test successful:', blockhash);
        setConnectionTest('success');
        setTimeout(() => setConnectionTest('idle'), 2000);
      } else {
        throw new Error('No connection available');
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
      solanaWallet: getSolanaWalletInfo(solanaWallet),
      connection: getConnectionInfo(connection),
      availableWallets: getAvailableWallets(),
      browserInfo: getBrowserInfo(),
    };

    console.group('🔧 SolRPS Wallet Debug Info');
    console.log('Environment:', debugData.environment);
    console.log('Game Wallet:', debugData.gameWallet);
    console.log('Solana Wallet:', debugData.solanaWallet);
    console.log('Connection:', debugData.connection);
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
      title: 'Solana Wallet',
      data: getSolanaWalletInfo(solanaWallet),
      color: 'text-purple-400'
    },
    {
      title: 'Connection',
      data: getConnectionInfo(connection),
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
          <div className="text-gray-400">|</div>
          <div>{gameWallet.walletType.toUpperCase()}</div>
          {gameWallet.balance !== undefined && (
            <>
              <div className="text-gray-400">|</div>
              <div className="text-green-400">{gameWallet.balance.toLocaleString()} RPS</div>
            </>
          )}
        </div>

        {/* Debug Sections */}
        {debugSections.map((section) => (
          <DebugSectionComponent
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-700">
          <button
            onClick={logDebugInfo}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
          >
            📋 Log Info
          </button>
          
          <button
            onClick={testConnection}
            disabled={connectionTest === 'testing' || !connection}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${
              connectionTest === 'testing' 
                ? 'bg-yellow-600 text-white cursor-wait'
                : connectionTest === 'success'
                ? 'bg-green-600 text-white'
                : connectionTest === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {connectionTest === 'testing' ? '🔄 Testing...' : 
             connectionTest === 'success' ? '✅ Success' :
             connectionTest === 'error' ? '❌ Failed' : '🧪 Test RPC'}
          </button>
        </div>

        {/* Connection Error Display */}
        {connectionError && (
          <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-xs">
            <div className="font-medium">Connection Error:</div>
            <div className="mt-1 break-words">{connectionError}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Debug section component
function DebugSectionComponent({ 
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
        className="w-full flex items-center justify-between p-2 hover:bg-gray-800 transition-colors text-left"
      >
        <span className={`font-semibold ${section.color} text-xs`}>
          {section.title}
        </span>
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

// Helper functions to gather debug information
function getEnvironmentInfo() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_PHASE2: process.env.NEXT_PUBLIC_ENABLE_PHASE2,
    USE_BLOCKCHAIN: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN,
    SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    appConfig: {
      USE_BLOCKCHAIN: APP_CONFIG.USE_BLOCKCHAIN,
      ENABLE_PHASE2: APP_CONFIG.ENABLE_PHASE2,
      SOLANA_CLUSTER: APP_CONFIG.SOLANA_CLUSTER,
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
  };
}

function getSolanaWalletInfo(solanaWallet: any) {
  if (!solanaWallet) {
    return {
      available: false,
      reason: 'useWallet hook not available'
    };
  }

  try {
    return {
      available: true,
      name: solanaWallet.wallet?.adapter?.name || 'None',
      connected: solanaWallet.connected,
      connecting: solanaWallet.connecting,
      publicKey: solanaWallet.publicKey?.toString() || null,
      readyState: solanaWallet.wallet?.readyState || 'Unknown',
      autoConnect: solanaWallet.autoConnect,
      wallets: solanaWallet.wallets?.length || 0,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function getConnectionInfo(connection: any) {
  if (!connection) {
    return {
      available: false,
      reason: 'useConnection hook not available'
    };
  }

  try {
    return {
      available: true,
      rpcEndpoint: connection.rpcEndpoint || 'Unknown',
      commitment: connection.commitment || 'Unknown',
      connected: !!connection._rpcEndpoint,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
    solana: {
      detected: !!windowAny.solana,
      isPhantom: windowAny.solana?.isPhantom || false,
      connected: windowAny.solana?.isConnected || false,
    },
    coinbase: {
      detected: !!windowAny.coinbaseSolana,
      connected: windowAny.coinbaseSolana?.isConnected || false,
    },
    totalDetected: [
      windowAny.phantom?.solana?.isPhantom,
      windowAny.solflare?.isSolflare,
      windowAny.backpack?.isBackpack,
      windowAny.glow,
      windowAny.coinbaseSolana,
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
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
    localStorage: typeof Storage !== 'undefined',
    webgl: !!window.WebGLRenderingContext,
    timestamp: new Date().toISOString(),
  };
}
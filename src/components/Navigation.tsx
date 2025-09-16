// src/components/Navigation.tsx - FIXED: Hydration Error Resolved
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useWallet as useMockWallet, useMockWalletInitialization } from "../state/wallet";
import { useGameWallet, useIsPhase2 } from "../hooks/useGameWallet";
import { WalletDebugInfo } from "./WalletDebugInfo";
import { APP_CONFIG } from "../config/constants";

// Safe conditional import for wallet components
let WalletMultiButton: any = null;
let WalletDisconnectButton: any = null;

if (typeof window !== 'undefined') {
  try {
    if (process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true') {
      import('@solana/wallet-adapter-react-ui').then(walletUI => {
        WalletMultiButton = walletUI.WalletMultiButton;
        WalletDisconnectButton = walletUI.WalletDisconnectButton;
      }).catch(error => {
        console.warn('Wallet UI components not available:', error);
      });
    }
  } catch (error) {
    console.warn('Failed to import wallet components:', error);
  }
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  emoji: string;
  badge?: number;
  badgeColor?: string;
}

export function Navigation() {
  const pathname = usePathname();
  const mockWallet = useMockWallet();
  const gameWallet = useGameWallet();
  const isPhase2 = useIsPhase2();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [claimableCount, setClaimableCount] = useState(0);
  const [devRewardsAvailable, setDevRewardsAvailable] = useState(false);
  
  // FIXED: State for hydration-safe environment detection
  const [isClient, setIsClient] = useState(false);
  const [environmentFlags, setEnvironmentFlags] = useState({
    isBlockchain: false,
    isPhase2Enabled: false,
  });
  
  // Initialize mock wallet from URL
  useMockWalletInitialization();

  // FIXED: Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
    setEnvironmentFlags({
      isBlockchain: process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true',
      isPhase2Enabled: process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true',
    });
  }, []);

  // Balance formatting
  const formatBalance = (balance: number): string => {
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(1)}M`;
    } else if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)}K`;
    } else {
      return balance.toLocaleString();
    }
  };

  // Balance display info based on source
  const getBalanceDisplayInfo = () => {
    const source = gameWallet.balanceSource || 'unknown';
    
    switch (source) {
      case 'token':
        return {
          label: 'RPS',
          color: gameWallet.tokenAccountExists ? 'text-green-400' : 'text-yellow-400',
          mode: gameWallet.tokenAccountExists ? '✅ Token Account' : '⚠️ No Token Account',
          modeColor: gameWallet.tokenAccountExists ? 'text-green-400' : 'text-yellow-400'
        };
      case 'mock':
        return {
          label: 'RPS',
          color: 'text-green-400',
          mode: '🎮 Mock Mode',
          modeColor: 'text-green-400'
        };
      case 'database':
        return {
          label: 'RPS',
          color: 'text-blue-400',
          mode: '📊 Database Mode',
          modeColor: 'text-blue-400'
        };
      default:
        return {
          label: 'RPS',
          color: 'text-gray-400',
          mode: '❓ Unknown Mode',
          modeColor: 'text-gray-400'
        };
    }
  };

  // Navigation items
  const navItems: NavItem[] = [
    { 
      href: "/play", 
      label: "Play", 
      shortLabel: "Play", 
      emoji: "🎮" 
    },
    { 
      href: "/lobby", 
      label: "Lobby", 
      shortLabel: "Lobby", 
      emoji: "🏢" 
    },
    { 
      href: "/my", 
      label: "My Matches", 
      shortLabel: "Matches", 
      emoji: "📊" 
    },
    { 
      href: "/leaderboard", 
      label: "Leaderboard", 
      shortLabel: "Board",
      emoji: "🏆",
      badge: claimableCount > 0 ? claimableCount : undefined,
      badgeColor: "bg-green-500",
    },
  ];

  // Fetch notification counts
  const fetchNotificationCounts = useCallback(async () => {
    if (!gameWallet.connected || !gameWallet.userId) return;

    try {
      // Weekly rewards
      const weeklyResponse = await fetch('/api/weekly/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: gameWallet.userId,
          dryRun: true 
        }),
      });

      if (weeklyResponse.ok) {
        const data = await weeklyResponse.json();
        setClaimableCount(data.claimableRewards?.length || 0);
      }

      // Dev rewards
      if (gameWallet.publicKey) {
        const devResponse = await fetch('/api/dev/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            walletAddress: gameWallet.publicKey,
            dryRun: true 
          }),
        });

        if (devResponse.ok) {
          const devData = await devResponse.json();
          setDevRewardsAvailable(devData.availableRewards > 0);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [gameWallet.connected, gameWallet.userId, gameWallet.publicKey]);

  // Fetch notifications on mount and interval
  useEffect(() => {
    if (isClient) {
      fetchNotificationCounts();
      const interval = setInterval(fetchNotificationCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchNotificationCounts, isClient]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Manual refresh handler
  const handleRefreshBalance = useCallback(async () => {
    console.log('🔄 Manual balance refresh requested');
    try {
      if (gameWallet.refreshBalance) {
        await gameWallet.refreshBalance();
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  }, [gameWallet]);

  const balanceInfo = getBalanceDisplayInfo();

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🪨📄✂️</span>
              <span className="text-xl font-bold text-white">SolRPS</span>
              <span className="text-xs bg-blue-500 px-2 py-1 rounded text-white">v1</span>
              
              {/* FIXED: Only render badges after client hydration */}
              {isClient && environmentFlags.isPhase2Enabled && (
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                  PHASE2
                </span>
              )}
              {isClient && environmentFlags.isBlockchain && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                  BLOCKCHAIN
                </span>
              )}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-slate-700"
                }`}
              >
                <span>{item.emoji}</span>
                <span className="hidden sm:inline">{item.label}</span>
                
                {/* Notification Badge */}
                {item.badge && (
                  <span className={`absolute -top-1 -right-1 ${item.badgeColor} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse`}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            ))}

            {/* Dev Rewards Indicator */}
            {devRewardsAvailable && (
              <div className="ml-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                <span className="text-xs text-purple-400 font-medium">🔧 Dev</span>
              </div>
            )}
          </div>

          {/* Wallet Section */}
          <div className="flex items-center space-x-4">
            {gameWallet.connected ? (
              <div className="flex items-center space-x-4">
                {/* Balance Display */}
                <div className="hidden sm:block text-right">
                  <div className="text-sm text-gray-400">Balance</div>
                  <div className={`font-mono font-bold ${balanceInfo.color}`}>
                    {formatBalance(gameWallet.balance)} {balanceInfo.label}
                  </div>
                  <div className="text-xs" style={{ color: balanceInfo.modeColor }}>
                    {balanceInfo.mode}
                  </div>
                </div>

                {/* Wallet Info */}
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {gameWallet.displayName}
                  </div>
                  <div className="text-xs text-gray-400">
                    {gameWallet.walletType === 'mock' ? (
                      'Mock Wallet'
                    ) : (
                      <>
                        {gameWallet.walletName || 'Solana'} • {gameWallet.solBalance.toFixed(3)} SOL
                        {gameWallet.solBalance === 0 && (
                          <span className="text-yellow-400 ml-1" title="Low SOL balance - needed for transaction fees">⚠️</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={handleRefreshBalance}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded"
                  title="Refresh balances"
                >
                  🔄
                </button>

                {/* Disconnect Button - FIXED: Only render after client hydration */}
                {gameWallet.walletType === 'solana' && isClient && environmentFlags.isBlockchain && WalletMultiButton ? (
                  WalletDisconnectButton && (
                    <WalletDisconnectButton className="!bg-red-600 !text-white !rounded-lg !px-4 !py-2 !text-sm hover:!bg-red-700" />
                  )
                ) : (
                  <button
                    onClick={() => gameWallet.disconnect()}
                    className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-red-700"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                {/* FIXED: Only render wallet buttons after client hydration */}
                {isClient && environmentFlags.isBlockchain && WalletMultiButton ? (
                  <WalletMultiButton className="!bg-blue-600 !text-white !rounded-lg !px-4 !py-2 !text-sm hover:!bg-blue-700" />
                ) : (
                  <div className="text-sm text-gray-400">
                    {gameWallet.connecting ? 'Connecting...' : 'Not Connected'}
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-400 hover:text-white focus:outline-none focus:text-white"
              >
                <span className="sr-only">Open main menu</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                      isActive
                        ? "bg-slate-700 text-white"
                        : "text-gray-300 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.shortLabel}</span>
                    {item.badge && (
                      <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              
              {/* Mobile Balance Display */}
              {gameWallet.connected && (
                <div className="px-3 py-2 border-t border-slate-700 mt-4">
                  <div className="text-sm text-gray-400">Balance</div>
                  <div className={`font-mono font-bold ${balanceInfo.color}`}>
                    {formatBalance(gameWallet.balance)} {balanceInfo.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: balanceInfo.modeColor }}>
                    {balanceInfo.mode}
                  </div>
                  {gameWallet.walletType === 'solana' && (
                    <div className="text-xs text-gray-500 mt-1">
                      SOL: {gameWallet.solBalance.toFixed(3)}
                      {gameWallet.solBalance === 0 && (
                        <span className="text-yellow-400 ml-1">⚠️ Low balance</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Development Banner - FIXED: Only render after client hydration */}
      {isClient && process.env.NODE_ENV === 'development' && (
        <div className="bg-purple-900/50 border-b border-purple-700">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="text-center text-sm text-purple-200">
              🚧 <strong>Debug Info</strong> | 
              Phase 2: {environmentFlags.isPhase2Enabled ? '✅' : '❌'} | 
              Blockchain: {environmentFlags.isBlockchain ? '✅' : '❌'} | 
              Token Mode: {gameWallet.isTokenMode ? '✅' : '❌'} |
              Token Address: {APP_CONFIG.TOKEN_MINT_ADDRESS ? '✅' : '❌'} |
              Balance Source: <strong>{gameWallet.balanceSource?.toUpperCase() || 'UNKNOWN'}</strong>
              {gameWallet.isTokenMode && !gameWallet.tokenAccountExists && gameWallet.connected && (
                <span className="ml-2 text-yellow-300">⚠️ Run: spl-token create-account {APP_CONFIG.TOKEN_MINT_ADDRESS}</span>
              )}
              {gameWallet.walletType === 'solana' && gameWallet.solBalance === 0 && (
                <span className="ml-2 text-yellow-300">⚠️ Get SOL for transaction fees</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Component - FIXED: Only render after client hydration */}
      {isClient && process.env.NODE_ENV === 'development' && (
        <WalletDebugInfo />
      )}
    </nav>
  );
}
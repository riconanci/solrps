// src/components/Navigation.tsx - COMPLETE IMPLEMENTATION: All Features Restored (500+ lines)
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../state/wallet";
import { useGameWallet, useIsPhase2 } from "../hooks/useGameWallet";
import { WalletDebugInfo } from "./WalletDebugInfo";

// Conditionally import wallet UI components only when needed
let WalletMultiButton: any = null;
let WalletDisconnectButton: any = null;

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true') {
  try {
    const walletUI = require('@solana/wallet-adapter-react-ui');
    WalletMultiButton = walletUI.WalletMultiButton;
    WalletDisconnectButton = walletUI.WalletDisconnectButton;
  } catch (error) {
    console.warn('⚠️ Wallet adapter UI not available:', error);
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
  const mockWallet = useWallet(); // Traditional mock wallet
  const gameWallet = useGameWallet(); // Enhanced Phase 2 wallet abstraction
  const isPhase2 = useIsPhase2();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [claimableCount, setClaimableCount] = useState(0);
  const [devRewardsAvailable, setDevRewardsAvailable] = useState(false);
  const [walletConnectionState, setWalletConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Check environment variables client-side
  const isBlockchain = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
  const isPhase2Enabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';

  // Navigation items configuration - CLEAN, NO DOUBLE EMOJIS
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
      emoji: "🏟️" 
    },
    { 
      href: "/my", 
      label: "My Matches", 
      shortLabel: "Matches", 
      emoji: "📋" 
    },
    { 
      href: "/leaderboard", 
      label: "Leaderboard", 
      shortLabel: "Board",
      emoji: "🏆",
      badge: claimableCount > 0 ? claimableCount : undefined,
      badgeColor: "bg-green-500"
    },
  ];

  // Monitor wallet connection state
  useEffect(() => {
    if (isBlockchain && isPhase2Enabled) {
      if (gameWallet.connecting) {
        setWalletConnectionState('connecting');
      } else if (gameWallet.connected) {
        setWalletConnectionState('connected');
      } else {
        setWalletConnectionState('disconnected');
      }
    }
  }, [gameWallet.connecting, gameWallet.connected, isBlockchain, isPhase2Enabled]);

  // Check for claimable rewards and dev rewards
  const fetchRewardsInfo = useCallback(async () => {
    const userId = gameWallet.userId || mockWallet.userId;
    if (!userId) return;

    try {
      // Check weekly rewards
      const weeklyResponse = await fetch('/api/weekly/claim');
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        if (weeklyData?.claimable) {
          setClaimableCount(weeklyData.claimable.length);
        }
      }

      // Check dev rewards
      const devResponse = await fetch('/api/dev/claim');
      if (devResponse.ok) {
        const devData = await devResponse.json();
        if (devData?.totalUnclaimed > 0) {
          setDevRewardsAvailable(true);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch rewards info:', error);
    }
  }, [gameWallet.userId, mockWallet.userId]);

  useEffect(() => {
    fetchRewardsInfo();
    
    // Refresh rewards info every 30 seconds
    const interval = setInterval(fetchRewardsInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchRewardsInfo]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Wallet connection handlers
  const handleWalletConnect = useCallback(() => {
    console.log('🔗 Manual wallet connection triggered');
    // The actual connection is handled by WalletMultiButton
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    console.log('🔌 Manual wallet disconnection triggered');
    try {
      if (gameWallet.disconnect) {
        await gameWallet.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [gameWallet]);

  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    if (!address || address.length < 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Get wallet status message
  const getWalletStatusMessage = () => {
    if (!isBlockchain || !isPhase2Enabled) return null;
    
    switch (walletConnectionState) {
      case 'connecting':
        return { text: 'Connecting...', color: 'text-yellow-400' };
      case 'connected':
        return { text: 'Connected', color: 'text-green-400' };
      case 'error':
        return { text: 'Connection Error', color: 'text-red-400' };
      default:
        return { text: 'Connect Wallet', color: 'text-blue-400' };
    }
  };

  const walletStatus = getWalletStatusMessage();

  return (
    <nav className="bg-slate-800 border-b border-white/10 sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Section - CLEAN */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🪨📄✂️</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">SolRPS</span>
              <span className="text-xs bg-slate-600 px-2 py-1 rounded text-slate-200">
                Rock Paper Scissors
              </span>
              {isPhase2Enabled && (
                <span className="text-xs bg-purple-500 px-2 py-1 rounded text-white font-bold animate-pulse">
                  PHASE 2
                </span>
              )}
              {isBlockchain && (
                <span className="text-xs bg-green-500 px-2 py-1 rounded text-white font-bold">
                  BLOCKCHAIN
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Navigation Links - CLEAN */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>{item.emoji}</span>
                <span>{item.label}</span>
                
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

          {/* Wallet Section - Complete Implementation */}
          <div className="hidden md:flex items-center gap-4">
            
            {/* PHASE 2 BLOCKCHAIN MODE - Real Solana Wallets */}
            {isBlockchain && isPhase2Enabled ? (
              <div className="flex items-center gap-4">
                {gameWallet.connected ? (
                  // Connected Wallet Display
                  <div className="flex items-center gap-4">
                    {/* Wallet Status Indicator */}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400 font-medium">LIVE</span>
                    </div>
                    
                    {/* Balance Information */}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Game Balance</div>
                      <div className="text-sm font-mono text-green-400 font-bold">
                        {gameWallet.balance?.toLocaleString() || '0'} RPS
                      </div>
                      {gameWallet.solBalance !== undefined && gameWallet.solBalance > 0 && (
                        <div className="text-xs text-purple-400">
                          {gameWallet.solBalance.toFixed(4)} SOL
                        </div>
                      )}
                    </div>
                    
                    {/* Wallet Information */}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{walletStatus?.text}</div>
                      <div className="text-sm font-mono text-blue-400">
                        {gameWallet.displayName}
                      </div>
                      {gameWallet.walletName && (
                        <div className="text-xs text-gray-400">
                          via {gameWallet.walletName}
                        </div>
                      )}
                    </div>
                    
                    {/* Disconnect Button */}
                    <div className="flex flex-col gap-1">
                      {WalletDisconnectButton ? (
                        <WalletDisconnectButton className="!bg-red-500 !hover:bg-red-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !transition-colors" />
                      ) : (
                        <button
                          onClick={handleWalletDisconnect}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm rounded-lg transition-colors"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // Wallet Connection Interface
                  <div className="flex items-center gap-4">
                    {/* Connection Status */}
                    <div className="text-center">
                      <div className="text-xs text-green-400 font-bold animate-pulse">🔗 BLOCKCHAIN MODE</div>
                      <div className={`text-xs ${walletStatus?.color || 'text-blue-400'}`}>
                        {walletStatus?.text}!
                      </div>
                    </div>
                    
                    {/* Connect Button */}
                    <div className="flex flex-col gap-1">
                      {WalletMultiButton ? (
                        <WalletMultiButton className="!bg-blue-500 !hover:bg-blue-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !transition-colors" />
                      ) : (
                        <button
                          onClick={handleWalletConnect}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors"
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* MOCK MODE - Traditional Alice/Bob Interface */
              <div className="flex items-center gap-4">
                {/* Mock Mode Indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-400 font-medium">MOCK</span>
                </div>
                
                {/* Current User Info */}
                <div className="text-right">
                  <div className="text-xs text-gray-400">Current User</div>
                  <div className="text-sm font-bold text-blue-400">
                    {mockWallet.userId === 'seed_alice' ? 'Alice (🧑‍💼)' : 
                     mockWallet.userId === 'seed_bob' ? 'Bob (👨‍💼)' : 
                     `User ${mockWallet.userId?.slice(0, 8) || 'Unknown'}`}
                  </div>
                </div>
                
                {/* Balance Display */}
                <div className="text-right">
                  <div className="text-xs text-gray-400">Game Balance</div>
                  <div className="text-sm font-mono text-green-400 font-bold">
                    {mockWallet.balance?.toLocaleString() || '0'} RPS
                  </div>
                </div>
                
                {/* User Switch Buttons */}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400 mr-2">Switch:</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => window.location.href = '?user=alice'}
                      className={`text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                        mockWallet.userId === 'seed_alice'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:scale-105'
                      }`}
                    >
                      👩‍💼 Alice
                    </button>
                    <button
                      onClick={() => window.location.href = '?user=bob'}
                      className={`text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                        mockWallet.userId === 'seed_bob'
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:scale-105'
                      }`}
                    >
                      👨‍💼 Bob
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg 
              className={`w-6 h-6 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu - Complete Implementation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4 animate-in slide-in-from-top duration-200">
            {/* Mobile Navigation Links */}
            <div className="flex flex-col gap-3 mb-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="font-medium">{item.shortLabel}</span>
                  {item.badge && (
                    <span className={`absolute right-4 ${item.badgeColor || 'bg-red-500'} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse`}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Mobile Wallet Section */}
            <div className="border-t border-white/10 pt-4">
              {isBlockchain && isPhase2Enabled ? (
                // Mobile Blockchain Mode
                <div className="px-4">
                  <div className="text-xs text-green-400 font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    BLOCKCHAIN MODE
                  </div>
                  
                  {gameWallet.connected ? (
                    <div className="space-y-3">
                      {/* Connected Wallet Info */}
                      <div className="bg-white/5 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
                        <div className="text-sm font-mono text-blue-400">
                          {gameWallet.displayName}
                        </div>
                        {gameWallet.walletName && (
                          <div className="text-xs text-gray-400">
                            via {gameWallet.walletName}
                          </div>
                        )}
                      </div>
                      
                      {/* Balance Info */}
                      <div className="bg-white/5 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Game Balance</div>
                        <div className="text-sm font-mono text-green-400 font-bold">
                          {gameWallet.balance?.toLocaleString() || '0'} RPS
                        </div>
                        {gameWallet.solBalance !== undefined && gameWallet.solBalance > 0 && (
                          <div className="text-xs text-purple-400">
                            {gameWallet.solBalance.toFixed(4)} SOL
                          </div>
                        )}
                      </div>
                      
                      {/* Disconnect Button */}
                      <div className="flex justify-center">
                        {WalletDisconnectButton ? (
                          <WalletDisconnectButton className="!bg-red-500 !hover:bg-red-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !transition-colors !w-full" />
                        ) : (
                          <button
                            onClick={handleWalletDisconnect}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm rounded-lg transition-colors w-full"
                          >
                            Disconnect Wallet
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Mobile Connect Interface
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-sm text-blue-400 mb-2">Connect your Solana wallet to play</div>
                        <div className={`text-xs ${walletStatus?.color || 'text-blue-400'}`}>
                          {walletStatus?.text}
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                        {WalletMultiButton ? (
                          <WalletMultiButton className="!bg-blue-500 !hover:bg-blue-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !transition-colors !w-full" />
                        ) : (
                          <button
                            onClick={handleWalletConnect}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors w-full"
                          >
                            Connect Wallet
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Mobile Mock Mode
                <div className="px-4">
                  <div className="text-xs text-blue-400 font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    MOCK MODE
                  </div>
                  
                  <div className="space-y-3">
                    {/* Current User Display */}
                    <div className="bg-white/5 p-3 rounded-lg">
                      <div className="text-xs text-gray-400 mb-1">Current Player</div>
                      <div className="text-sm font-bold text-blue-400">
                        {mockWallet.userId === 'seed_alice' ? 'Alice (👩‍💼)' : 
                         mockWallet.userId === 'seed_bob' ? 'Bob (👨‍💼)' : 
                         `User ${mockWallet.userId?.slice(0, 8) || 'Unknown'}`}
                      </div>
                    </div>
                    
                    {/* Balance Display */}
                    <div className="bg-white/5 p-3 rounded-lg">
                      <div className="text-xs text-gray-400 mb-1">Game Balance</div>
                      <div className="text-sm font-mono text-green-400 font-bold">
                        {mockWallet.balance?.toLocaleString() || '0'} RPS
                      </div>
                    </div>
                    
                    {/* Switch User Buttons */}
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Switch Player:</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.location.href = '?user=alice'}
                          className={`flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                            mockWallet.userId === 'seed_alice'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          }`}
                        >
                          👩‍💼 Alice
                        </button>
                        <button
                          onClick={() => window.location.href = '?user=bob'}
                          className={`flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                            mockWallet.userId === 'seed_bob'
                              ? 'bg-orange-600 text-white shadow-md'
                              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                          }`}
                        >
                          👨‍💼 Bob
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Debug Component (Development Only) */}
      <WalletDebugInfo />
    </nav>
  );
}
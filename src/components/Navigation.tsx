// src/components/Navigation.tsx - Fixed with Proper Wallet Initialization
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useWallet, useMockWalletInitialization } from "../state/wallet";
import { useGameWallet, useIsPhase2 } from "../hooks/useGameWallet";
import { WalletDebugInfo } from "./WalletDebugInfo";

// Safe conditional import with proper error handling
let WalletMultiButton: any = null;
let WalletDisconnectButton: any = null;

if (typeof window !== 'undefined') {
  try {
    const isBlockchain = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
    if (isBlockchain) {
      import('@solana/wallet-adapter-react-ui').then(walletUI => {
        WalletMultiButton = walletUI.WalletMultiButton;
        WalletDisconnectButton = walletUI.WalletDisconnectButton;
      }).catch(error => {
        console.warn('Wallet adapter UI not available:', error);
      });
    }
  } catch (error) {
    console.warn('Failed to setup wallet imports:', error);
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
  const mockWallet = useWallet();
  const gameWallet = useGameWallet();
  const isPhase2 = useIsPhase2();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [claimableCount, setClaimableCount] = useState(0);
  const [devRewardsAvailable, setDevRewardsAvailable] = useState(false);
  
  // Initialize mock wallet from URL parameters
  useMockWalletInitialization();

  // Environment variables
  const isBlockchain = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
  const isPhase2Enabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';

  // Navigation items configuration
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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Check for claimable rewards
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const weeklyResponse = await fetch('/api/weekly/claim');
        if (weeklyResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          if (weeklyData?.claimable) {
            setClaimableCount(weeklyData.claimable.length);
          }
        }

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
    };

    fetchRewards();
    const interval = setInterval(fetchRewards, 30000);
    return () => clearInterval(interval);
  }, []);

  // Wallet connection handlers
  const handleWalletConnect = useCallback(() => {
    console.log('Manual wallet connection triggered');
    // Connection is handled by WalletMultiButton when available
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    console.log('Manual wallet disconnection triggered');
    try {
      if (gameWallet.disconnect) {
        await gameWallet.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [gameWallet]);

  return (
    <nav className="bg-slate-800 border-b border-white/10 sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Section */}
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

          {/* Desktop Navigation Links */}
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

          {/* Wallet Section */}
          <div className="hidden md:flex items-center gap-4">
            <WalletDisplay 
              isBlockchain={isBlockchain}
              isPhase2Enabled={isPhase2Enabled}
              mockWallet={mockWallet}
              gameWallet={gameWallet}
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4">
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
            <div className="border-t border-white/10 pt-4 px-4">
              <MobileWalletDisplay 
                isBlockchain={isBlockchain}
                isPhase2Enabled={isPhase2Enabled}
                mockWallet={mockWallet}
                gameWallet={gameWallet}
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Debug Component (Development Only) */}
      <WalletDebugInfo />
    </nav>
  );
}

// Wallet Display Component
function WalletDisplay({ 
  isBlockchain, 
  isPhase2Enabled, 
  mockWallet, 
  gameWallet, 
  onConnect, 
  onDisconnect 
}: any) {
  
  if (isBlockchain && isPhase2Enabled) {
    const isConnected = gameWallet?.connected;
    const publicKey = gameWallet?.publicKey;
    
    if (isConnected && publicKey) {
      return (
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400 font-medium">LIVE</span>
          </div>
          
          {/* Wallet Info */}
          <div className="text-right">
            <div className="text-xs text-gray-400">Connected</div>
            <div className="text-sm font-mono text-blue-400">
              {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
            </div>
          </div>
          
          {/* Balance */}
          <div className="bg-green-500/20 px-3 py-1 rounded-lg border border-green-500/30">
            <span className="text-green-400 font-mono font-bold">
              {gameWallet?.balance?.toLocaleString() || '0'}
            </span>
            <span className="text-green-400/70 ml-1 text-xs">RPS</span>
          </div>

          {/* Disconnect Button */}
          <div className="flex gap-2">
            {WalletDisconnectButton ? (
              <WalletDisconnectButton className="!bg-red-500 !hover:bg-red-600 !text-white !px-3 !py-1 !text-xs !rounded-lg" />
            ) : (
              <button
                onClick={onDisconnect}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs rounded-lg transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      );
    } else {
      // Not connected - show connect interface
      return (
        <div className="flex items-center gap-3">
          {/* Status */}
          <div className="text-right">
            <div className="text-xs text-green-400 font-bold animate-pulse">
              🔗 BLOCKCHAIN MODE
            </div>
            <div className="text-xs text-blue-400">
              Connect Wallet!
            </div>
          </div>
          
          {/* Connect Button */}
          {WalletMultiButton ? (
            <WalletMultiButton className="!bg-blue-500 !hover:bg-blue-600 !text-white !px-4 !py-2 !text-sm !rounded-lg" />
          ) : (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors"
              onClick={onConnect}
            >
              Connect Wallet
            </button>
          )}
        </div>
      );
    }
  }

  // Mock Mode
  const currentUser = mockWallet.userId === 'seed_alice' ? 'Alice' : 
                     mockWallet.userId === 'seed_bob' ? 'Bob' : 
                     `User ${mockWallet.userId?.slice(0, 8) || 'Unknown'}`;

  return (
    <div className="flex items-center gap-3">
      {/* Status */}
      <div className="text-right">
        <div className="text-xs text-blue-400 font-bold">
          🎮 MOCK MODE
        </div>
        <div className="text-xs text-gray-300">
          {currentUser}
        </div>
      </div>
      
      {/* Balance */}
      <div className="bg-green-500/20 px-3 py-1 rounded-lg border border-green-500/30">
        <span className="text-green-400 font-mono font-bold">
          {mockWallet.balance?.toLocaleString() || '0'}
        </span>
        <span className="text-green-400/70 ml-1 text-xs">RPS</span>
      </div>

      {/* Switch Buttons */}
      <div className="hidden sm:flex gap-1">
        <button
          onClick={() => window.location.href = '?user=alice'}
          className={`text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
            mockWallet.userId === 'seed_alice'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          }`}
        >
          👩‍💼 Alice
        </button>
        <button
          onClick={() => window.location.href = '?user=bob'}
          className={`text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
            mockWallet.userId === 'seed_bob'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
          }`}
        >
          👨‍💼 Bob
        </button>
      </div>
    </div>
  );
}

// Mobile Wallet Display Component
function MobileWalletDisplay({ 
  isBlockchain, 
  isPhase2Enabled, 
  mockWallet, 
  gameWallet, 
  onConnect, 
  onDisconnect 
}: any) {
  
  if (isBlockchain && isPhase2Enabled) {
    const isConnected = gameWallet?.connected;
    const publicKey = gameWallet?.publicKey;
    
    return (
      <div>
        <div className="text-xs text-green-400 font-bold mb-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          BLOCKCHAIN MODE
        </div>
        
        {isConnected && publicKey ? (
          <div className="space-y-3">
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
              <div className="text-sm font-mono text-blue-400">
                {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
              </div>
            </div>
            
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Game Balance</div>
              <div className="text-sm font-mono text-green-400 font-bold">
                {gameWallet?.balance?.toLocaleString() || '0'} RPS
              </div>
            </div>
            
            <button
              onClick={onDisconnect}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm rounded-lg transition-colors w-full"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-sm text-blue-400 mb-2">Connect your Solana wallet</div>
            </div>
            
            <button
              onClick={onConnect}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors w-full"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    );
  }

  // Mobile Mock Mode
  return (
    <div>
      <div className="text-xs text-blue-400 font-bold mb-2 flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        MOCK MODE
      </div>
      
      <div className="space-y-3">
        <div className="bg-white/5 p-3 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Current Player</div>
          <div className="text-sm font-bold text-blue-400">
            {mockWallet.userId === 'seed_alice' ? 'Alice (👩‍💼)' : 
             mockWallet.userId === 'seed_bob' ? 'Bob (👨‍💼)' : 
             `User ${mockWallet.userId?.slice(0, 8) || 'Unknown'}`}
          </div>
        </div>
        
        <div className="bg-white/5 p-3 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Game Balance</div>
          <div className="text-sm font-mono text-green-400 font-bold">
            {mockWallet.balance?.toLocaleString() || '0'} RPS
          </div>
        </div>
        
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
  );
}
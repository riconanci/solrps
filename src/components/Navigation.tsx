// src/components/Navigation.tsx - FIXED: TypeScript Errors + Better Wallet UX
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useWallet as useMockWallet, useMockWalletInitialization } from "../state/wallet";
import { useGameWallet, useIsPhase2 } from "../hooks/useGameWallet";
import { WalletDebugInfo } from "./WalletDebugInfo";

// Safe conditional import with proper error handling
let WalletMultiButton: any = null;
let WalletDisconnectButton: any = null;
let useSolanaWallet: any = null;

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
      
      // Import Solana wallet hook for improved UX
      import('@solana/wallet-adapter-react').then(walletAdapter => {
        useSolanaWallet = walletAdapter.useWallet;
      }).catch(error => {
        console.warn('Wallet adapter hooks not available:', error);
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
  const mockWallet = useMockWallet();
  const gameWallet = useGameWallet();
  const isPhase2 = useIsPhase2();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [claimableCount, setClaimableCount] = useState(0);
  const [devRewardsAvailable, setDevRewardsAvailable] = useState(false);
  
  // IMPROVED: Track wallet selection state for better UX
  const [walletSelectionOpen, setWalletSelectionOpen] = useState(false);
  const [showWalletInstructions, setShowWalletInstructions] = useState(false);
  
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

  // IMPROVED: Better wallet connection state management
  useEffect(() => {
    if (isBlockchain && isPhase2Enabled) {
      // Monitor for wallet selection state changes
      const checkWalletState = () => {
        const modalElement = document.querySelector('.wallet-adapter-modal');
        const isModalOpen = modalElement && !modalElement.classList.contains('wallet-adapter-modal-fade-out');
        
        if (isModalOpen && !walletSelectionOpen) {
          setWalletSelectionOpen(true);
          setShowWalletInstructions(true);
          console.log('🎯 Wallet selection modal opened');
        } else if (!isModalOpen && walletSelectionOpen) {
          setWalletSelectionOpen(false);
          
          // Show instructions for a few seconds after modal closes
          setTimeout(() => {
            setShowWalletInstructions(false);
          }, 3000);
          console.log('🎯 Wallet selection modal closed');
        }
      };
      
      const observer = new MutationObserver(checkWalletState);
      observer.observe(document.body, { childList: true, subtree: true });
      
      return () => observer.disconnect();
    }
  }, [isBlockchain, isPhase2Enabled, walletSelectionOpen]);

  // Enhanced wallet connection handlers
  const handleWalletConnect = useCallback(() => {
    console.log('🔗 Manual wallet connection triggered');
    setShowWalletInstructions(true);
    
    // Auto-hide instructions after 5 seconds
    setTimeout(() => {
      setShowWalletInstructions(false);
    }, 5000);
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    console.log('🔌 Manual wallet disconnection triggered');
    try {
      if (gameWallet.disconnect) {
        await gameWallet.disconnect();
      }
      setShowWalletInstructions(false);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [gameWallet]);

  return (
    <nav className="bg-slate-800 border-b border-white/10 sticky top-0 z-50 shadow-lg">
      {/* IMPROVED: Wallet instruction banner */}
      {showWalletInstructions && isBlockchain && isPhase2Enabled && !gameWallet.connected && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 px-4 py-2">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-blue-400">💡</span>
              <span className="text-blue-200">
                {walletSelectionOpen 
                  ? "Select your wallet type (Phantom recommended), then click Connect again to complete the connection."
                  : "Click 'Connect Wallet' to select your wallet type, then click again to connect."
                }
              </span>
              <button 
                onClick={() => setShowWalletInstructions(false)}
                className="text-blue-400 hover:text-blue-300 ml-auto"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      
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
            <ImprovedWalletDisplay 
              isBlockchain={isBlockchain}
              isPhase2Enabled={isPhase2Enabled}
              mockWallet={mockWallet}
              gameWallet={gameWallet}
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              showInstructions={showWalletInstructions}
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
              <ImprovedMobileWalletDisplay 
                isBlockchain={isBlockchain}
                isPhase2Enabled={isPhase2Enabled}
                mockWallet={mockWallet}
                gameWallet={gameWallet}
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
                showInstructions={showWalletInstructions}
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

// IMPROVED: Enhanced Wallet Display Component with Better UX
function ImprovedWalletDisplay({ 
  isBlockchain, 
  isPhase2Enabled, 
  mockWallet, 
  gameWallet, 
  onConnect, 
  onDisconnect,
  showInstructions
}: {
  isBlockchain: boolean;
  isPhase2Enabled: boolean;
  mockWallet: any;
  gameWallet: any;
  onConnect: () => void;
  onDisconnect: () => void;
  showInstructions: boolean;
}) {
  
  if (isBlockchain && isPhase2Enabled) {
    const isConnected = gameWallet?.connected;
    const publicKey = gameWallet?.publicKey;
    const isConnecting = gameWallet?.connecting;
    
    if (isConnected && publicKey) {
      return (
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400 font-medium">CONNECTED</span>
          </div>
          
          {/* Wallet Info */}
          <div className="text-right">
            <div className="text-xs text-gray-400">Wallet</div>
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
              <WalletDisconnectButton className="!bg-red-500 !hover:bg-red-600 !text-white !px-3 !py-1 !text-xs !rounded-lg !flex !items-center !gap-1 !justify-center !whitespace-nowrap" />
            ) : (
              <button
                onClick={onDisconnect}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      );
    } else {
      // Not connected - show enhanced connect interface
      return (
        <div className="flex items-center gap-3">
          {/* Status */}
          <div className="text-right">
            <div className="text-xs text-green-400 font-bold animate-pulse">
              🔗 BLOCKCHAIN MODE
            </div>
            <div className="text-xs text-blue-400">
              {isConnecting ? 'Connecting...' : 'Ready to Connect!'}
            </div>
          </div>
          
          {/* Enhanced Connect Button */}
          <div className="relative">
            {WalletMultiButton ? (
              <WalletMultiButton 
                className="!bg-blue-500 !hover:bg-blue-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !flex !items-center !gap-1 !justify-center !whitespace-nowrap !transition-all"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  minWidth: 'auto'
                }}
                onClick={onConnect}
              />
            ) : (
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1"
                onClick={onConnect}
              >
                Connect Wallet
              </button>
            )}
            
            {/* Instruction tooltip */}
            {showInstructions && (
              <div className="absolute top-full mt-2 left-0 w-64 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 z-50">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">💡</span>
                  <div>
                    <div className="font-medium text-blue-300 mb-1">Two-Step Process:</div>
                    <div>1. Click to select wallet type</div>
                    <div>2. Click again to connect</div>
                  </div>
                </div>
              </div>
            )}
          </div>
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

// IMPROVED: Enhanced Mobile Wallet Display Component
function ImprovedMobileWalletDisplay({ 
  isBlockchain, 
  isPhase2Enabled, 
  mockWallet, 
  gameWallet, 
  onConnect, 
  onDisconnect,
  showInstructions
}: {
  isBlockchain: boolean;
  isPhase2Enabled: boolean;
  mockWallet: any;
  gameWallet: any;
  onConnect: () => void;
  onDisconnect: () => void;
  showInstructions: boolean;
}) {
  
  if (isBlockchain && isPhase2Enabled) {
    const isConnected = gameWallet?.connected;
    const publicKey = gameWallet?.publicKey;
    const isConnecting = gameWallet?.connecting;
    
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
              <div className="text-sm text-blue-400 mb-2">
                {isConnecting ? 'Connecting to your wallet...' : 'Connect your Solana wallet'}
              </div>
            </div>
            
            {/* Enhanced instruction for mobile */}
            {showInstructions && (
              <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-200">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">💡</span>
                  <div>
                    <div className="font-medium text-blue-300 mb-1">Two-Step Process:</div>
                    <div>1. Tap to select wallet type</div>
                    <div>2. Tap again to connect</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Enhanced Mobile Connect Button */}
            {WalletMultiButton ? (
              <WalletMultiButton 
                className="!bg-blue-500 !hover:bg-blue-600 !text-white !px-4 !py-2 !text-sm !rounded-lg !w-full !flex !items-center !gap-1 !justify-center !whitespace-nowrap"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  width: '100%'
                }}
                onClick={onConnect}
              />
            ) : (
              <button
                onClick={onConnect}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-lg transition-colors w-full flex items-center gap-1 justify-center"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mobile Mock Mode (preserved exactly)
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
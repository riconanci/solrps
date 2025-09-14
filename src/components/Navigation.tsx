// src/components/Navigation.tsx - PHASE 2 STEP 2: Real Wallet Integration
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useWallet } from "../state/wallet";
import { useGameWallet, useIsPhase2 } from "../hooks/useGameWallet";
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';

export function Navigation() {
  const pathname = usePathname();
  const mockWallet = useWallet(); // Traditional mock wallet
  const gameWallet = useGameWallet(); // Enhanced Phase 2 wallet abstraction
  const isPhase2 = useIsPhase2();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [claimableCount, setClaimableCount] = useState(0);

  // Check environment variables client-side
  const isBlockchain = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
  const isPhase2Enabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';

  const navItems = [
    { href: "/play", label: "🎮 Play", shortLabel: "Play" },
    { href: "/lobby", label: "🏟️ Lobby", shortLabel: "Lobby" },
    { href: "/my", label: "📋 My Matches", shortLabel: "Matches" },
    { 
      href: "/leaderboard", 
      label: "🏆 Leaderboard", 
      shortLabel: "Board",
      badge: claimableCount > 0 ? claimableCount : undefined,
    },
  ];

  // Check for claimable rewards
  useEffect(() => {
    const userId = gameWallet.userId || mockWallet.userId;
    if (!userId) return;

    fetch('/api/weekly/claim')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.claimable) {
          setClaimableCount(data.claimable.length);
        }
      })
      .catch(() => {}); // Silent fail
  }, [gameWallet.userId, mockWallet.userId]);

  // Format wallet address for display
  const formatAddress = (address: string) => {
    if (!address || address.length < 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <nav className="bg-slate-800 border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">⚔️</span>
            <span className="text-lg md:text-xl font-bold text-white">SolRPS</span>
            
            {/* Phase badges */}
            <div className="hidden sm:flex gap-1">
              {!isBlockchain && (
                <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded font-medium">
                  MOCK
                </span>
              )}
              {isPhase2Enabled && (
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded font-medium">
                  PHASE 2
                </span>
              )}
              {isBlockchain && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium animate-pulse">
                  🔗 BLOCKCHAIN
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                {/* Notification Badge */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Wallet Section */}
          <div className="hidden md:flex items-center gap-3">
            
            {/* PHASE 2 BLOCKCHAIN MODE - Real Solana Wallets */}
            {isBlockchain && isPhase2Enabled ? (
              <div className="flex items-center gap-3">
                {gameWallet.connected ? (
                  // Connected Solana Wallet Display
                  <div className="flex items-center gap-3">
                    {/* Balance Display */}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Game Balance</div>
                      <div className="text-sm font-mono text-green-400">
                        {gameWallet.balance?.toLocaleString() || '0'} RPS
                      </div>
                      {gameWallet.solBalance && (
                        <div className="text-xs text-purple-400">
                          {gameWallet.solBalance.toFixed(4)} SOL
                        </div>
                      )}
                    </div>
                    
                    {/* Wallet Info */}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Connected</div>
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
                    <WalletDisconnectButton className="!bg-red-500 !hover:bg-red-600" />
                  </div>
                ) : (
                  // Wallet Connection Interface
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-xs text-green-400 font-bold animate-pulse">🔗 BLOCKCHAIN MODE</div>
                      <div className="text-xs text-blue-400">Connect your wallet!</div>
                    </div>
                    <WalletMultiButton className="!bg-gradient-to-r !from-blue-500 !to-purple-500 !hover:from-blue-600 !hover:to-purple-600" />
                  </div>
                )}
              </div>
            ) : (
              /* PHASE 1 MOCK MODE - Traditional Alice/Bob System */
              <>
                {/* Balance Display */}
                {mockWallet.isConnected && (
                  <div className="text-right">
                    <div className="text-xs text-gray-400 hidden sm:block">Mock Balance</div>
                    <div className="text-sm md:text-base font-mono text-green-400">
                      <span className="hidden sm:inline">{mockWallet.balance?.toLocaleString() || '...'} RPS</span>
                      <span className="sm:hidden">💰 {mockWallet.balance ? Math.floor(mockWallet.balance / 1000) + 'k' : '...'}</span>
                    </div>
                  </div>
                )}

                {/* User Display */}
                <div className="text-right">
                  <div className="text-xs text-gray-400 hidden sm:block">Mock User</div>
                  <div className="text-sm font-medium text-white">
                    {mockWallet.displayName || 'Guest'}
                  </div>
                </div>

                {/* User Switch Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => window.location.href = '?user=alice'}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      mockWallet.userId === 'seed_alice'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    }`}
                  >
                    Alice
                  </button>
                  <button
                    onClick={() => window.location.href = '?user=bob'}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      mockWallet.userId === 'seed_bob'
                        ? 'bg-orange-600 text-white'
                        : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                    }`}
                  >
                    Bob
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="font-medium">{item.shortLabel}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            
            {/* Mobile Wallet Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              {isBlockchain && isPhase2Enabled ? (
                // Mobile Blockchain Mode
                <div className="text-center">
                  {gameWallet.connected ? (
                    <div>
                      <div className="text-green-400 font-bold mb-2">🔗 Wallet Connected</div>
                      <div className="text-sm font-mono text-blue-400 mb-2">
                        {gameWallet.displayName}
                      </div>
                      <div className="text-sm font-mono text-green-400 mb-3">
                        {gameWallet.balance?.toLocaleString() || '0'} RPS
                      </div>
                      <WalletDisconnectButton className="!w-full !bg-red-500 !hover:bg-red-600" />
                    </div>
                  ) : (
                    <div>
                      <div className="text-green-400 font-bold mb-2">🔗 BLOCKCHAIN MODE</div>
                      <WalletMultiButton className="!w-full !bg-gradient-to-r !from-blue-500 !to-purple-500" />
                    </div>
                  )}
                </div>
              ) : (
                // Mobile Mock Mode
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-gray-400">Mock Balance</div>
                    <div className="font-mono text-green-400">
                      {mockWallet.balance?.toLocaleString() || '...'} RPS
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        window.location.href = '?user=alice';
                        setMobileMenuOpen(false);
                      }}
                      className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded"
                    >
                      Alice
                    </button>
                    <button
                      onClick={() => {
                        window.location.href = '?user=bob';
                        setMobileMenuOpen(false);
                      }}
                      className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded"
                    >
                      Bob
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
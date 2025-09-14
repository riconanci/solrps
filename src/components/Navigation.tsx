// src/components/Navigation.tsx - FIXED PHASE 2 NAVIGATION
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "../state/wallet";

export function Navigation() {
  const pathname = usePathname();
  const wallet = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check environment variables directly
  const isPhase2 = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';
  const isBlockchain = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';

  const navItems = [
    { href: "/play", label: "🎮 Play", shortLabel: "Play" },
    { href: "/lobby", label: "🏟️ Lobby", shortLabel: "Lobby" },
    { href: "/my", label: "📋 My Matches", shortLabel: "Matches" },
    { href: "/leaderboard", label: "🏆 Leaderboard", shortLabel: "Board" },
  ];

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
              <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded font-medium">
                MOCK
              </span>
              {isPhase2 && (
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded font-medium">
                  PHASE 2
                </span>
              )}
              {isBlockchain && (
                <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium animate-pulse">
                  BLOCKCHAIN
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Wallet Section */}
          <div className="hidden md:flex items-center gap-3">
            
            {/* Phase 2 Blockchain Mode */}
            {isBlockchain ? (
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-xs text-red-400 font-bold animate-pulse">🚀 BLOCKCHAIN MODE</div>
                  <div className="text-xs text-yellow-400">Wallet needed!</div>
                </div>
                <button 
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-colors"
                  onClick={() => alert('Phase 2: Install Phantom or Solflare wallet extension!')}
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              /* Phase 1 Mock Mode */
              <>
                {/* Balance Display */}
                {wallet.isConnected && (
                  <div className="text-right">
                    <div className="text-xs text-gray-400 hidden sm:block">Mock Balance</div>
                    <div className="text-sm md:text-base font-mono text-green-400">
                      <span className="hidden sm:inline">{wallet.balance?.toLocaleString() || '...'} RPS</span>
                      <span className="sm:hidden">💰 {wallet.balance ? (wallet.balance / 1000).toFixed(0) + 'k' : '...'}</span>
                    </div>
                  </div>
                )}

                {/* User Display */}
                {wallet.isConnected && (
                  <div className="text-sm text-gray-300 hidden md:block">
                    {wallet.displayName || wallet.userId}
                  </div>
                )}

                {/* Quick user switch buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => window.location.href = '?user=alice'}
                    className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-400 transition-colors"
                    title="Switch to Alice"
                  >
                    A
                  </button>
                  <button
                    onClick={() => window.location.href = '?user=bob'}
                    className="text-xs px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-orange-400 transition-colors"
                    title="Switch to Bob"
                  >
                    B
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile menu button */}
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
            <div className="flex flex-col gap-2 mb-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="font-medium">{item.shortLabel}</span>
                </Link>
              ))}
            </div>
            
            {/* Mobile Wallet Section */}
            <div className="border-t border-white/10 pt-4">
              {isBlockchain ? (
                <div className="text-center">
                  <div className="text-red-400 font-bold mb-2">🚀 BLOCKCHAIN MODE</div>
                  <button 
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium"
                    onClick={() => alert('Phase 2: Install Phantom or Solflare wallet extension!')}
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-gray-400">Mock Balance</div>
                    <div className="font-mono text-green-400">
                      {wallet.balance?.toLocaleString() || '...'} RPS
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => window.location.href = '?user=alice'}
                      className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded"
                    >
                      A
                    </button>
                    <button
                      onClick={() => window.location.href = '?user=bob'}
                      className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded"
                    >
                      B
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
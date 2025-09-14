// src/components/Navigation.tsx - Mobile-first responsive navigation
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "../state/wallet";

export function Navigation() {
  const pathname = usePathname();
  const { userId, balance, displayName } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/play", label: "🎮 Play", icon: "🎮", shortLabel: "Play" },
    { href: "/lobby", label: "🏟️ Lobby", icon: "🏟️", shortLabel: "Lobby" },
    { href: "/my", label: "📋 My Matches", icon: "📋", shortLabel: "Matches" },
    { href: "/leaderboard", label: "🏆 Leaderboard", icon: "🏆", shortLabel: "Board" },
  ];

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <nav className="bg-slate-800 border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        {/* Main navigation bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo - always visible */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">⚔️</span>
            <span className="text-lg md:text-xl font-bold text-white">SolRPS</span>
            <div className="hidden sm:flex gap-1">
              <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded">
                MOCK
              </span>
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                PHASE 2
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - hidden on mobile */}
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

          {/* Balance + Mobile menu button */}
          <div className="flex items-center gap-2">
            {/* Balance - responsive sizing */}
            <div className="text-right">
              <div className="text-xs text-gray-400 hidden sm:block">Mock Balance</div>
              <div className="text-sm md:text-base font-mono text-green-400">
                <span className="hidden sm:inline">{balance?.toLocaleString() || '...'} RPS</span>
                <span className="sm:hidden">💰 {balance ? (balance / 1000).toFixed(0) + 'k' : '...'}</span>
              </div>
            </div>

            {/* User Avatar */}
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {displayName?.[0]?.toUpperCase() || '?'}
              </span>
            </div>

            {/* Mobile menu button - only visible on mobile */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div className={`h-0.5 bg-white transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                <div className={`h-0.5 bg-white transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></div>
                <div className={`h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu - slides down when open */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileMenuOpen ? 'max-h-80 pb-4' : 'max-h-0'
        }`}>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.shortLabel}</span>
              </Link>
            ))}
          </div>
          
          {/* User info in mobile menu */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-center">
              <div className="text-sm text-gray-400">Signed in as</div>
              <div className="text-sm font-medium text-white">
                {displayName || `User ${userId?.slice(0, 8)}`}
              </div>
              <div className="text-lg font-mono text-green-400 mt-1">
                {balance?.toLocaleString() || '0'} RPS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom navigation - alternative approach */}
      {/* Uncomment this if you prefer bottom nav on mobile instead of hamburger */}
      {/*
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-white/10 z-50">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-medium">{item.shortLabel}</span>
            </Link>
          ))}
        </div>
      </div>
      */}
    </nav>
  );
}

// Layout wrapper component
export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navigation />
      <main>{children}</main>
    </div>
  );
}
// src/components/Navigation.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/play", label: "🎮 Play", description: "Create & join games" },
    { href: "/my", label: "📋 My Matches", description: "View your game history" },
    { href: "/leaderboard", label: "🏆 Leaderboard", description: "Top players" },
  ];

  return (
    <nav className="bg-slate-800 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/play" className="flex items-center gap-2">
            <span className="text-2xl">⚔️</span>
            <span className="text-xl font-bold text-white">SolRPS</span>
            <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded">BETA</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
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

          {/* Mock wallet info */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">Mock Balance</div>
              <div className="text-sm font-mono text-green-400">Loading...</div>
            </div>
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </div>
      </div>
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
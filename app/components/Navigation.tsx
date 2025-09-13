// app/components/Navigation.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const [claimableCount, setClaimableCount] = useState(0);
  const [devRewardsAvailable, setDevRewardsAvailable] = useState(false);

  useEffect(() => {
    // Check for claimable weekly rewards
    fetch('/api/weekly/claim')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.claimable) {
          setClaimableCount(data.claimable.length);
        }
      })
      .catch(() => {}); // Silently fail

    // Check for dev rewards (only if authorized)
    fetch('/api/dev/claim')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.totalUnclaimed > 0) {
          setDevRewardsAvailable(true);
        }
      })
      .catch(() => {}); // Silently fail if not authorized
  }, []);

  const navItems = [
    { href: "/play", label: "Play", emoji: "🎮" },
    { href: "/lobby", label: "Lobby", emoji: "🏢" },
    { href: "/my", label: "My Matches", emoji: "📊" },
    { 
      href: "/leaderboard", 
      label: "Leaderboard", 
      emoji: "🏆",
      badge: claimableCount > 0 ? claimableCount : undefined,
      badgeColor: "bg-green-500"
    }
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🪨📄✂️</span>
              <span className="text-xl font-bold text-white">SolRPS</span>
              <span className="text-xs bg-blue-500 px-2 py-1 rounded text-white">v1</span>
            </Link>
          </div>

          {/* Navigation Links */}
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

            {/* Dev Rewards Indicator (only show if available) */}
            {devRewardsAvailable && (
              <div className="ml-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                <span className="text-xs text-purple-400 font-medium">🔧 Dev Rewards</span>
              </div>
            )}
          </div>

          {/* User Wallet Indicator */}
          <div className="flex items-center space-x-4">
            <WalletDisplay />
          </div>
        </div>
      </div>
    </nav>
  );
}

function WalletDisplay() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current user info
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user') || 'alice';
    
    fetch(`/api/user/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching user:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user || !user.id) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="text-gray-400">Guest</div>
        {/* Quick user switch buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => window.location.href = '?user=alice'}
            className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-400"
          >
            Alice
          </button>
          <button
            onClick={() => window.location.href = '?user=bob'}
            className="text-xs px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-orange-400"
          >
            Bob
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className="text-gray-400">
        {user.displayName || `User ${user.id.slice(0, 8)}`}
      </div>
      <div className="bg-green-500/20 px-3 py-1 rounded-lg border border-green-500/30">
        <span className="text-green-400 font-mono font-bold">
          {user.mockBalance?.toLocaleString() || '0'} 
        </span>
        <span className="text-green-400/70 ml-1 text-xs">tokens</span>
      </div>
      
      {/* Quick user switch buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => window.location.href = '?user=alice'}
          className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-400"
        >
          Alice
        </button>
        <button
          onClick={() => window.location.href = '?user=bob'}
          className="text-xs px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-orange-400"
        >
          Bob
        </button>
      </div>
    </div>
  );
}
// app/page.tsx - Clean minimal landing page
import Link from "next/link";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-xl p-8 text-center max-w-md w-full">
        {/* Logo */}
        <div className="text-5xl mb-4">🪨📄✂️</div>
        
        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">SolRPS</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Rock Paper Scissors on Solana with weekly rewards
        </p>
        
        {/* Quick Stats */}
        <div className="flex justify-center gap-4 mb-6 text-xs">
          <div className="bg-blue-500/10 px-3 py-2 rounded border border-blue-500/20">
            <span className="text-blue-400">⚡ Instant</span>
          </div>
          <div className="bg-purple-500/10 px-3 py-2 rounded border border-purple-500/20">
            <span className="text-purple-400">🏆 Weekly</span>
          </div>
          <div className="bg-green-500/10 px-3 py-2 rounded border border-green-500/20">
            <span className="text-green-400">🛡️ Fair</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/play"
            className="block w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold transition-colors"
          >
            🎮 Play Now
          </Link>
          
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/lobby"
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm transition-colors"
            >
              🏢 Lobby
            </Link>
            <Link
              href="/leaderboard"
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm transition-colors"
            >
              🏆 Rankings
            </Link>
          </div>
        </div>
        
        {/* Version */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <span className="text-xs text-gray-500">Phase 2 Ready</span>
        </div>
      </div>
    </div>
  );
}
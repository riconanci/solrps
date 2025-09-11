"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  totalWins: number;
  totalEarnings: number;
  gamesWon: number;
  gamesLost: number;
  totalStaked: number;
  totalGames: number;
  winRate: number;
  netProfit: number;
};

type LeaderboardData = {
  period: string;
  leaderboard: LeaderboardEntry[];
  generatedAt: string;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "week" | "month">("all");

  async function loadLeaderboard() {
    try {
      setLoading(true);
      const res = await fetch(`/api/leaderboard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      
      const leaderboardData = await res.json();
      setData(leaderboardData);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  function getRankBadge(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  function getProfitColor(profit: number) {
    if (profit > 0) return "text-green-300";
    if (profit < 0) return "text-red-300";
    return "text-yellow-300";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <Link 
          href="/play" 
          className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
        >
          Back to Play
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(["all", "month", "week"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              period === p
                ? "bg-white/20 text-white"
                : "bg-white/10 text-neutral-300 hover:bg-white/15"
            }`}
          >
            {p === "all" ? "All Time" : p === "month" ? "Past Month" : "Past Week"}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-neutral-400">Loading leaderboard...</div>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && data && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="bg-white/5 px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {period === "all" ? "All Time" : period === "month" ? "Past Month" : "Past Week"} Rankings
              </div>
              <div className="text-sm text-neutral-400">
                {data.leaderboard.length} players
              </div>
            </div>
          </div>

          {data.leaderboard.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <div className="text-lg mb-2">No games played yet</div>
              <div className="text-sm">
                <Link href="/play" className="text-blue-400 hover:text-blue-300">
                  Be the first to play!
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr className="text-left text-sm text-neutral-300">
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Games</th>
                    <th className="px-4 py-3">Win Rate</th>
                    <th className="px-4 py-3">Total Earnings</th>
                    <th className="px-4 py-3">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((entry, index) => (
                    <tr 
                      key={entry.userId}
                      className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-lg">
                          {getRankBadge(index + 1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{entry.displayName}</div>
                        <div className="text-xs text-neutral-400">
                          {entry.userId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div>{entry.totalGames} total</div>
                          <div className="text-xs text-neutral-400">
                            {entry.gamesWon}W • {entry.gamesLost}L
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.winRate}%</span>
                          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-400 transition-all"
                              style={{ width: `${Math.min(entry.winRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-green-300 font-medium">
                          {entry.totalEarnings.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-400">
                          from {entry.totalWins} wins
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-bold ${getProfitColor(entry.netProfit)}`}>
                          {entry.netProfit > 0 ? "+" : ""}{entry.netProfit.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-400">
                          staked: {entry.totalStaked.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      {!loading && data && (
        <div className="text-center text-xs text-neutral-500">
          Last updated: {new Date(data.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
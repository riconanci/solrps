// app/leaderboard/page.tsx
"use client";
import { useEffect, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  avgWinning: number;
  winRate: string;
};

type LeaderboardData = {
  success: boolean;
  timeframe: string;
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  totalMatches: number;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>("all");

  useEffect(() => {
    fetchLeaderboard(timeframe);
  }, [timeframe]);

  async function fetchLeaderboard(tf: string) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leaderboard?timeframe=${tf}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      const leaderboardData = await res.json();
      setData(leaderboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg">Error: {error}</div>
          <button 
            onClick={() => fetchLeaderboard(timeframe)}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">🏆 Leaderboard</h1>
          
          {/* Timeframe selector */}
          <div className="flex gap-2">
            {[
              { value: "all", label: "All Time" },
              { value: "month", label: "This Month" },
              { value: "week", label: "This Week" }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeframe(option.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeframe === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats summary */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{data.totalPlayers}</div>
              <div className="text-gray-400">Total Players</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{data.totalMatches}</div>
              <div className="text-gray-400">Total Matches</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {data.leaderboard.reduce((sum, entry) => sum + entry.totalWinnings, 0).toLocaleString()}
              </div>
              <div className="text-gray-400">Total Winnings</div>
            </div>
          </div>
        )}

        {/* Leaderboard table */}
        {data && data.leaderboard.length > 0 ? (
          <div className="bg-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/10">
                    <th className="px-6 py-4 text-left">Rank</th>
                    <th className="px-6 py-4 text-left">Player</th>
                    <th className="px-6 py-4 text-right">Total Winnings</th>
                    <th className="px-6 py-4 text-right">Matches Won</th>
                    <th className="px-6 py-4 text-right">Matches Played</th>
                    <th className="px-6 py-4 text-right">Win Rate</th>
                    <th className="px-6 py-4 text-right">Avg Winning</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((entry, index) => (
                    <LeaderboardRow key={entry.userId} entry={entry} index={index} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12">
            <div className="text-lg">No leaderboard data available</div>
            <p className="mt-2">Play some games to see rankings!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ 
  entry, 
  index 
}: { 
  entry: LeaderboardEntry; 
  index: number;
}) {
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getRowBg = (rank: number) => {
    if (rank === 1) return "bg-yellow-500/10 border-yellow-500/20";
    if (rank === 2) return "bg-gray-400/10 border-gray-400/20";
    if (rank === 3) return "bg-orange-600/10 border-orange-600/20";
    return index % 2 === 0 ? "bg-white/5" : "bg-transparent";
  };

  return (
    <tr className={`border-b border-white/10 hover:bg-white/10 transition-colors ${getRowBg(entry.rank)}`}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{getRankDisplay(entry.rank)}</span>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="font-medium">{entry.displayName}</div>
        <div className="text-xs text-gray-400">{entry.userId.slice(0, 8)}...</div>
      </td>
      
      <td className="px-6 py-4 text-right">
        <div className="font-mono font-bold text-green-400">
          {entry.totalWinnings.toLocaleString()}
        </div>
      </td>
      
      <td className="px-6 py-4 text-right">
        <div className="font-mono">{entry.matchesWon}</div>
      </td>
      
      <td className="px-6 py-4 text-right">
        <div className="font-mono">{entry.matchesPlayed}</div>
      </td>
      
      <td className="px-6 py-4 text-right">
        <div className={`font-mono ${
          parseFloat(entry.winRate) >= 60 ? "text-green-400" :
          parseFloat(entry.winRate) >= 40 ? "text-yellow-400" : "text-red-400"
        }`}>
          {entry.winRate}%
        </div>
      </td>
      
      <td className="px-6 py-4 text-right">
        <div className="font-mono text-blue-400">
          {entry.avgWinning.toLocaleString()}
        </div>
      </td>
    </tr>
  );
}
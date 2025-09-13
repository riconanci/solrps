// app/leaderboard/page.tsx - COMPLETE REWRITE WITH WEEKLY REWARDS
"use client";
import { useEffect, useState } from "react";
import { useWallet } from "../../src/state/wallet";

type WeeklyReward = {
  id: string;
  rank: number;
  points: number;
  rewardAmount: number;
  weekDisplay: string;
};

type WeeklyRewardsData = {
  currentPeriod: {
    id: string;
    weekDisplay: string;
    totalRewardsPool: number;
    totalMatches: number;
    isDistributed: boolean;
  } | null;
  weeklyLeaderboard: {
    userId: string;
    displayName: string;
    points: number;
    totalWinnings: number;
    matchesWon: number;
  }[];
  claimableRewards: WeeklyReward[];
  recentlyClaimed: any[];
  totalClaimableAmount: number;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  avgWinning: number;
  winRate: string;
  netProfit: number;
};

type LeaderboardData = {
  success: boolean;
  timeframe: string;
  weeklyRewards: WeeklyRewardsData;
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  totalMatches: number;
};

export default function LeaderboardPage() {
  const wallet = useWallet();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>("all");
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.isConnected) {
      const initWallet = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user') || 'alice';
        const userId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
        await wallet.switchUser(userId);
      };
      initWallet();
    } else {
      fetchLeaderboard(timeframe);
    }
  }, [timeframe, wallet.isConnected]);

  async function fetchLeaderboard(tf: string) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leaderboard?timeframe=${tf}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      const leaderboardData = await res.json();
      console.log("Leaderboard data:", leaderboardData); // Debug log
      setData(leaderboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function claimWeeklyReward(rewardId: string) {
    if (claiming) return;
    
    setClaiming(rewardId);
    try {
      const res = await fetch('/api/weekly/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyRewardId: rewardId })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        // Update wallet balance
        wallet.setBalance(result.newBalance);
        // Refresh leaderboard data
        fetchLeaderboard(timeframe);
        alert(result.message);
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Failed to claim reward');
    } finally {
      setClaiming(null);
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

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* WEEKLY REWARDS SECTION */}
        {data.weeklyRewards && (
          <div className="space-y-6">
            {/* Current Week Info */}
            {data.weeklyRewards.currentPeriod && (
              <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-6 border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-purple-400">
                    🎯 Weekly Competition
                  </h2>
                  <div className="text-sm text-gray-400">
                    {data.weeklyRewards.currentPeriod.weekDisplay}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {data.weeklyRewards.currentPeriod.totalRewardsPool.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400">Reward Pool</div>
                  </div>
                  
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {data.weeklyRewards.currentPeriod.totalMatches}
                    </div>
                    <div className="text-sm text-gray-400">Matches Played</div>
                  </div>
                  
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                      {data.weeklyRewards.currentPeriod.isDistributed ? "Distributed" : "Active"}
                    </div>
                    <div className="text-sm text-gray-400">Status</div>
                  </div>
                </div>
              </div>
            )}

            {/* Claimable Rewards */}
            {data.weeklyRewards.claimableRewards && data.weeklyRewards.claimableRewards.length > 0 && (
              <div className="bg-green-500/20 rounded-xl p-6 border border-green-500/30">
                <h3 className="text-xl font-bold text-green-400 mb-4">
                  💰 Claimable Weekly Rewards
                </h3>
                
                <div className="space-y-3">
                  {data.weeklyRewards.claimableRewards.map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between bg-black/20 rounded-lg p-4">
                      <div>
                        <div className="font-bold">
                          #{reward.rank} Place - {reward.weekDisplay}
                        </div>
                        <div className="text-sm text-gray-400">
                          {reward.points} points earned
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-green-400">
                            {reward.rewardAmount.toLocaleString()} tokens
                          </div>
                        </div>
                        
                        <button
                          onClick={() => claimWeeklyReward(reward.id)}
                          disabled={claiming === reward.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                          {claiming === reward.id ? 'Claiming...' : 'Claim'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 text-center">
                  <div className="text-lg font-bold text-green-400">
                    Total Claimable: {data.weeklyRewards.totalClaimableAmount.toLocaleString()} tokens
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Leaderboard */}
            {data.weeklyRewards.weeklyLeaderboard && data.weeklyRewards.weeklyLeaderboard.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4">📊 This Week's Top Players</h3>
                
                <div className="space-y-2">
                  {data.weeklyRewards.weeklyLeaderboard.map((player, index) => (
                    <div key={player.userId} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </div>
                        <div>
                          <div className="font-medium">{player.displayName}</div>
                          <div className="text-sm text-gray-400">
                            {player.matchesWon} wins • {player.totalWinnings.toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-purple-400">
                          {player.points} points
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REGULAR LEADERBOARD */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">📈 Overall Rankings</h2>
            <div className="text-sm text-gray-400">
              {data.totalPlayers} players • {data.totalMatches} matches
            </div>
          </div>

          {data.leaderboard && data.leaderboard.length > 0 ? (
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
          parseFloat(entry.winRate) >= 60 ? 'text-green-400' : 
          parseFloat(entry.winRate) >= 40 ? 'text-yellow-400' : 'text-red-400'
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
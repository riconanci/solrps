// app/leaderboard/page.tsx - FINAL CLEAN VERSION WITHOUT ANTI-SYBIL STATS
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

type WeeklyPlayer = {
  userId: string;
  displayName: string;
  points: number;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
};

type WeeklyRewardsData = {
  currentPeriod: {
    id: string;
    weekDisplay: string;
    totalRewardsPool: number;
    totalMatches: number;
    isDistributed: boolean;
  } | null;
  weeklyLeaderboard: WeeklyPlayer[];
  claimableRewards: WeeklyReward[];
  recentlyClaimed: any[];
  totalClaimableAmount: number;
  stats: {
    totalPlayers: number;
    eligiblePlayers: number;
    ineligiblePlayers: number;
    blockRate: number;
  } | null;
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
    }
  }, [wallet]);

  const fetchData = async () => {
    if (!wallet.isConnected) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/leaderboard?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${wallet.userId}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeframe, wallet.isConnected, wallet.userId]);

  const handleClaim = async (rewardId: string) => {
    if (!wallet.isConnected) return;
    
    try {
      setClaiming(rewardId);
      const response = await fetch('/api/weekly/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wallet.userId}`
        },
        body: JSON.stringify({ rewardId })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to claim reward');
      }

      const result = await response.json();
      
      if (result.success) {
        wallet.updateBalance(result.claimedAmount);
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to claim reward');
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      alert(err instanceof Error ? err.message : 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  // Calculate weekly matches played from leaderboard data
  const calculateWeeklyMatchesPlayed = () => {
    if (!data?.weeklyRewards?.weeklyLeaderboard) return 0;
    const totalParticipations = data.weeklyRewards.weeklyLeaderboard.reduce((total, player) => total + player.matchesPlayed, 0);
    return Math.floor(totalParticipations / 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-4">Loading Leaderboard...</div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400 mb-4">Error Loading Leaderboard</div>
            <div className="text-gray-300 mb-4">{error}</div>
            <button
              onClick={fetchData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-6xl mx-auto pt-8">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          🏆 Leaderboard
        </h1>

        {/* Filter Buttons */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {(["all", "month", "week"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timeframe === period
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {period === "all" && "All Time"}
                {period === "month" && "This Month"}
                {period === "week" && "Weekly Competition"}
                {period === "week" && data?.weeklyRewards?.currentPeriod && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                    {data.weeklyRewards.totalClaimableAmount > 0 ? "CLAIMABLE" : "ACTIVE"}
                  </span>
                )}
              </button>
            ))}
            
            {data?.weeklyRewards?.currentPeriod && timeframe === "week" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg border border-gray-600">
                <div className="flex items-center gap-1 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-gray-300">Live</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary */}
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

        {/* WEEKLY COMPETITION INFO PANEL */}
        {timeframe === "week" && data?.weeklyRewards?.currentPeriod && (
          <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-green-500/10 rounded-xl p-6 border border-purple-500/20 mb-8">
            
            {/* Weekly Competition Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-purple-400">🎯 Weekly Competition</h2>
              <div className="text-sm text-gray-400">
                {data.weeklyRewards.currentPeriod.weekDisplay}
              </div>
            </div>

            {/* 3-COLUMN STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              
              {/* COLUMN 1: PRIZE POOL */}
              <div className="bg-black/20 rounded-lg p-6 text-center border border-green-500/20">
                <div className="text-4xl font-bold text-green-400 mb-2">
                  💰 {data.weeklyRewards.currentPeriod.totalRewardsPool.toLocaleString()}
                </div>
                <div className="text-lg font-semibold text-gray-300 mb-1">Prize Pool</div>
                <div className="text-xs text-gray-500">2% of all weekly winnings</div>
                <div className="text-xs text-green-400 mt-1 font-medium">
                  {data.weeklyRewards.currentPeriod.totalRewardsPool > 0 ? "Growing!" : "Waiting for games..."}
                </div>
              </div>

              {/* COLUMN 2: MATCHES PLAYED */}
              <div className="bg-black/20 rounded-lg p-6 text-center border border-blue-500/20">
                <div className="text-4xl font-bold text-blue-400 mb-2">
                  🎮 {calculateWeeklyMatchesPlayed()}
                </div>
                <div className="text-lg font-semibold text-gray-300 mb-1">Matches Played</div>
                <div className="text-xs text-gray-500">This week's activity</div>
                <div className="text-xs text-blue-400 mt-1 font-medium">
                  {calculateWeeklyMatchesPlayed() > 0 ? "Competition Active!" : "Be the first to play!"}
                </div>
              </div>

              {/* COLUMN 3: COMPETITORS */}
              <div className="bg-black/20 rounded-lg p-6 text-center border border-purple-500/20">
                <div className="text-4xl font-bold text-purple-400 mb-2">
                  👥 {data.weeklyRewards.weeklyLeaderboard?.length || 0}
                </div>
                <div className="text-lg font-semibold text-gray-300 mb-1">Competitors</div>
                <div className="text-xs text-gray-500">Active players this week</div>
                <div className="text-xs text-purple-400 mt-1 font-medium">
                  {(data.weeklyRewards.weeklyLeaderboard?.length || 0) > 0 ? "Join the competition!" : "Be the first competitor!"}
                </div>
              </div>

            </div>

            {/* Competition Status */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className={`px-6 py-3 rounded-full font-bold text-lg ${
                data.weeklyRewards.currentPeriod.isDistributed 
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}>
                {data.weeklyRewards.currentPeriod.isDistributed ? "📊 Distributed" : "⚡ Active Competition"}
              </span>
            </div>

            {/* Prize Distribution Preview */}
            {!data.weeklyRewards.currentPeriod.isDistributed && data.weeklyRewards.currentPeriod.totalRewardsPool > 0 && (
              <div className="bg-black/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-center mb-4 text-gray-200">🏆 Prize Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
                    <div className="text-2xl mb-1">🥇</div>
                    <div className="font-bold text-yellow-400">
                      {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.5).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">1st Place (50%)</div>
                  </div>
                  <div className="bg-gray-500/10 rounded-lg p-3 border border-gray-500/30">
                    <div className="text-2xl mb-1">🥈</div>
                    <div className="font-bold text-gray-300">
                      {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.2).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">2nd Place (20%)</div>
                  </div>
                  <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                    <div className="text-2xl mb-1">🥉</div>
                    <div className="font-bold text-orange-400">
                      {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.1).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">3rd Place (10%)</div>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/30">
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="font-bold text-purple-400">
                      {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.2).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">4th-10th (20%)</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Current Week Info Preview (when not on week tab) */}
        {data.weeklyRewards && data.weeklyRewards.currentPeriod && timeframe !== "week" && (
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-6 border border-purple-500/30 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-400">🎯 Weekly Competition Preview</h2>
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
                  {calculateWeeklyMatchesPlayed()}
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
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setTimeframe("week")}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                View Full Weekly Competition →
              </button>
            </div>
          </div>
        )}

        {/* Claimable Rewards Section */}
        {data.weeklyRewards && data.weeklyRewards.claimableRewards && data.weeklyRewards.claimableRewards.length > 0 && (
          <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-500/30 mb-8">
            <h2 className="text-2xl font-bold text-green-400 mb-4">💰 Claimable Rewards</h2>
            <div className="grid gap-4">
              {data.weeklyRewards.claimableRewards.map((reward) => (
                <div key={reward.id} className="flex items-center justify-between bg-black/20 rounded-lg p-4">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      🏆 Rank #{reward.rank} - Week {reward.weekDisplay}
                    </div>
                    <div className="text-sm text-gray-400">
                      {reward.points} points earned
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xl font-bold text-green-400">
                      {reward.rewardAmount.toLocaleString()} tokens
                    </div>
                    <button
                      onClick={() => handleClaim(reward.id)}
                      disabled={claiming === reward.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {claiming === reward.id ? "Claiming..." : "Claim"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <div className="text-sm text-gray-400">
                Total Claimable: <span className="text-green-400 font-bold">{data.weeklyRewards.totalClaimableAmount.toLocaleString()} tokens</span>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/10">
                <tr>
                  <th className="text-left p-4 text-gray-400">Rank</th>
                  <th className="text-left p-4 text-gray-400">Player</th>
                  <th className="text-right p-4 text-gray-400">Matches</th>
                  <th className="text-right p-4 text-gray-400">Wins</th>
                  <th className="text-right p-4 text-gray-400">Win Rate</th>
                  <th className="text-right p-4 text-gray-400">
                    {timeframe === "week" ? "Points" : "Net Profit"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(timeframe === "week" ? data.weeklyRewards.weeklyLeaderboard : data.leaderboard)
                  .slice(0, 50)
                  .map((entry, index) => {
                    const isWeekly = timeframe === "week";
                    const isCurrentUser = entry.userId === wallet.userId;
                    const displayValue = isWeekly ? (entry as WeeklyPlayer).points : (entry as LeaderboardEntry).netProfit;
                    const winRate = isWeekly ? 
                      (entry.matchesPlayed > 0 ? ((entry.matchesWon / entry.matchesPlayed) * 100).toFixed(1) : "0.0") :
                      (entry as LeaderboardEntry).winRate;
                    
                    return (
                      <tr 
                        key={entry.userId}
                        className={`border-t border-white/10 hover:bg-white/5 transition-colors ${
                          isCurrentUser ? 'bg-blue-500/10 border-blue-500/30' : ''
                        }`}
                      >
                        <td className="p-4">
                          <span className={`font-bold ${
                            index === 0 ? 'text-yellow-400' : 
                            index === 1 ? 'text-gray-300' : 
                            index === 2 ? 'text-orange-400' : 'text-gray-400'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                            {entry.displayName}
                            {isCurrentUser && <span className="ml-2 text-xs text-blue-400">(You)</span>}
                          </span>
                        </td>
                        <td className="p-4 text-right text-gray-300">{entry.matchesPlayed}</td>
                        <td className="p-4 text-right text-green-400">{entry.matchesWon}</td>
                        <td className="p-4 text-right text-purple-400">{winRate}%</td>
                        <td className="p-4 text-right">
                          <span className={`font-bold ${
                            displayValue > 0 ? 'text-green-400' : 
                            displayValue < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {isWeekly ? displayValue : (displayValue > 0 ? '+' : '')}{displayValue.toLocaleString()}
                            {isWeekly ? ' pts' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {data.leaderboard.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No players found for this timeframe</div>
            <div className="text-gray-500 text-sm mt-2">Play some games to appear on the leaderboard!</div>
          </div>
        )}
      </div>
    </div>
  );
}
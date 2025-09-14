// app/leaderboard/page.tsx - COMPLETE FINAL REWRITE - FIXED WEEKLY MATCHES COUNT
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
      console.log("Leaderboard data:", leaderboardData);
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
        wallet.setBalance(result.newBalance);
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

  // Calculate total weekly matches played from leaderboard data
  const calculateWeeklyMatchesPlayed = () => {
    if (!data?.weeklyRewards?.weeklyLeaderboard) return 0;
    
    // Sum all matches played and divide by 2 (since each match involves 2 players)
    const totalParticipations = data.weeklyRewards.weeklyLeaderboard.reduce((sum, player) => {
      return sum + (player.matchesPlayed || 0);
    }, 0);
    
    return Math.floor(totalParticipations / 2);
  };

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
        
        {/* Header with Timeframe Selector */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">🏆 Leaderboard</h1>
          
          <div className="flex gap-2 flex-wrap">
            {[
              { 
                value: "all", 
                label: "All Time",
                icon: "🏆",
                description: "Complete leaderboard history"
              },
              { 
                value: "month", 
                label: "This Month",
                icon: "📅", 
                description: "Last 30 days performance"
              },
              { 
                value: "week", 
                label: "This Week",
                icon: "💰",
                description: "Weekly rewards competition",
                isSpecial: true,
                badge: data?.weeklyRewards?.currentPeriod?.isDistributed ? "DISTRIBUTED" : "ACTIVE",
                badgeColor: data?.weeklyRewards?.currentPeriod?.isDistributed ? "bg-yellow-500" : "bg-green-500"
              }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeframe(option.value)}
                className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-200 group ${
                  timeframe === option.value
                    ? option.isSpecial 
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                      : "bg-blue-600 text-white"
                    : option.isSpecial
                      ? "bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-300 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/30"
                      : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                } ${option.isSpecial ? 'min-w-[140px]' : ''}`}
                title={option.description}
              >
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                  
                  {option.isSpecial && option.badge && (
                    <span className={`
                      absolute -top-1 -right-1 px-2 py-0.5 text-xs font-bold rounded-full text-white
                      ${option.badgeColor} animate-pulse
                    `}>
                      {option.badge}
                    </span>
                  )}
                  
                  {option.isSpecial && timeframe === option.value && data?.weeklyRewards?.currentPeriod && (
                    <span className="text-xs bg-black/20 px-2 py-1 rounded-full">
                      {data.weeklyRewards.currentPeriod.totalRewardsPool.toLocaleString()} 🎁
                    </span>
                  )}
                </div>
                
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  {option.description}
                  {option.isSpecial && data?.weeklyRewards?.currentPeriod && (
                    <div className="text-xs text-gray-300 mt-1">
                      Pool: {data.weeklyRewards.currentPeriod.totalRewardsPool.toLocaleString()} tokens
                    </div>
                  )}
                </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Weekly Competition Quick Stats - FIXED THE MATCHES PLAYED COUNT */}
        {timeframe === "week" && data?.weeklyRewards?.currentPeriod && (
          <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-green-500/10 rounded-xl p-4 border border-purple-500/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {data.weeklyRewards.currentPeriod.totalRewardsPool.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Prize Pool</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {/* FIXED: Calculate matches played from weekly leaderboard data */}
                    {calculateWeeklyMatchesPlayed()}
                  </div>
                  <div className="text-xs text-gray-400">Matches Played</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {data.weeklyRewards.weeklyLeaderboard?.length || 0}
                  </div>
                  <div className="text-xs text-gray-400">Competitors</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-3 py-1 rounded-full font-medium ${
                  data.weeklyRewards.currentPeriod.isDistributed 
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-green-500/20 text-green-400 border border-green-500/30"
                }`}>
                  {data.weeklyRewards.currentPeriod.isDistributed ? "📊 Distributed" : "⚡ Active Competition"}
                </span>
                
                <span className="text-gray-400 text-xs">
                  {data.weeklyRewards.currentPeriod.weekDisplay}
                </span>
              </div>
            </div>
            
            {!data.weeklyRewards.currentPeriod.isDistributed && data.weeklyRewards.currentPeriod.totalRewardsPool > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>🥇 1st: {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.5).toLocaleString()}</span>
                  <span>🥈 2nd: {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.2).toLocaleString()}</span>
                  <span>🥉 3rd: {Math.floor(data.weeklyRewards.currentPeriod.totalRewardsPool * 0.1).toLocaleString()}</span>
                  <span className="text-purple-400">+ 7 more spots</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly Rewards Section */}
        {data.weeklyRewards && (
          <div className="space-y-6">
            
            {/* Current Week Info (when not on week tab) */}
            {data.weeklyRewards.currentPeriod && timeframe !== "week" && (
              <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-6 border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-purple-400">🎯 Weekly Competition</h2>
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
              </div>
            )}

            {/* Claimable Rewards */}
            {data.weeklyRewards.claimableRewards && data.weeklyRewards.claimableRewards.length > 0 && (
              <div className="bg-green-500/20 rounded-xl p-6 border border-green-500/30">
                <h3 className="text-xl font-bold text-green-400 mb-4">💰 Claimable Weekly Rewards</h3>
                
                <div className="space-y-3">
                  {data.weeklyRewards.claimableRewards.map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between bg-black/20 rounded-lg p-4">
                      <div>
                        <div className="font-bold">#{reward.rank} Place - {reward.weekDisplay}</div>
                        <div className="text-sm text-gray-400">{reward.points} points earned</div>
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

          </div>
        )}

        {/* Main Overall Rankings Table */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {timeframe === "week" ? "⚡ Weekly Competition Leaderboard" :
               timeframe === "month" ? "📅 This Month's Leaderboard" :
               "🏆 All-Time Leaderboard"}
            </h2>
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
        <div className="font-mono font-bold text-yellow-400">{entry.matchesPlayed}</div>
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
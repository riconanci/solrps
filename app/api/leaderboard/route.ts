// app/api/leaderboard/route.ts - ENHANCED WITH ANTI-SYBIL WEEKLY REWARDS
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../_utils";
import { getCurrentWeekStart, getCurrentWeekEnd, formatWeekDisplay, getWeeklyLeaderboard } from "@/lib/weekly";

// Type definitions for better TypeScript support
interface WeeklyPlayer {
  userId: string;
  displayName: string;
  points: number;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  uniqueOpponentsCount: number;
  maxWinsFromSingleOpponent: number;
  winShareFromSingleOpponent: number;
  isEligible: boolean;
  ineligibilityReasons: string[];
}

interface WeeklyStats {
  totalPlayers: number;
  eligiblePlayers: number;
  ineligiblePlayers: number;
}

interface LeaderboardResult {
  leaderboard: WeeklyPlayer[];
  ineligiblePlayers: WeeklyPlayer[];
  stats: WeeklyStats;
}

interface RegularPlayer {
  userId: string;
  displayName: string;
  totalWins: number;
  totalEarnings: number;
  gamesWon: number;
  gamesLost: number;
  totalStaked: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all";
    const user = await getUserOrSeed(req);
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeframe === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (timeframe === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    // GET WEEKLY REWARDS DATA WITH ANTI-SYBIL FILTERING
    const weekStart = getCurrentWeekStart();
    const weekEnd = getCurrentWeekEnd(weekStart);

    // Get or create current weekly period
    let currentWeeklyPeriod = await prisma.weeklyPeriod.findUnique({
      where: { weekStart }
    });

    // Get weekly leaderboard with anti-sybil filtering
    let weeklyLeaderboard: WeeklyPlayer[] = [];
    let weeklyStats: WeeklyStats | null = null;
    let ineligiblePlayers: WeeklyPlayer[] = [];
    
    if (currentWeeklyPeriod) {
      const leaderboardResult: LeaderboardResult = await getWeeklyLeaderboard(prisma, currentWeeklyPeriod.id);
      weeklyLeaderboard = leaderboardResult.leaderboard;
      ineligiblePlayers = leaderboardResult.ineligiblePlayers;
      weeklyStats = leaderboardResult.stats;
    }

    // Get user's claimable weekly rewards
    const claimableWeeklyRewards = await prisma.weeklyReward.findMany({
      where: {
        userId: user.id,
        isClaimed: false
      },
      include: {
        weeklyPeriod: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get recently claimed rewards
    const recentlyClaimed = await prisma.weeklyReward.findMany({
      where: {
        userId: user.id,
        isClaimed: true
      },
      include: {
        weeklyPeriod: true
      },
      orderBy: { claimedAt: 'desc' },
      take: 5 // Last 5 claimed rewards
    });

    // GET REGULAR LEADERBOARD DATA (all-time/filtered)
    const results = await prisma.matchResult.findMany({
      where: {
        ...dateFilter,
        winnerUserId: { not: null },
      },
      include: {
        session: {
          include: {
            creator: { select: { id: true, displayName: true } },
            challenger: { select: { id: true, displayName: true } }
          }
        }
      }
    });

    // Calculate regular stats per user
    const userStats = new Map<string, RegularPlayer>();

    for (const result of results) {
      const winnerId = result.winnerUserId!;
      const session = result.session;
      
      let winnerName = `User ${winnerId.slice(0, 8)}`;
      if (session.creator.id === winnerId) {
        winnerName = session.creator.displayName || winnerName;
      } else if (session.challenger?.id === winnerId) {
        winnerName = session.challenger.displayName || winnerName;
      }

      if (!userStats.has(winnerId)) {
        userStats.set(winnerId, {
          userId: winnerId,
          displayName: winnerName,
          totalWins: 0,
          totalEarnings: 0,
          gamesWon: 0,
          gamesLost: 0,
          totalStaked: 0,
        });
      }

      const stats = userStats.get(winnerId)!;
      stats.totalWins++;
      stats.totalEarnings += result.payoutWinner;
      stats.gamesWon++;
    }

    // Count losses for players who participated but didn't win
    for (const result of results) {
      const session = result.session;
      const loserId = session.creatorId === result.winnerUserId 
        ? session.challengerId 
        : session.creatorId;

      if (loserId) {
        let loserName = `User ${loserId.slice(0, 8)}`;
        if (session.creator.id === loserId) {
          loserName = session.creator.displayName || loserName;
        } else if (session.challenger?.id === loserId) {
          loserName = session.challenger.displayName || loserName;
        }

        if (!userStats.has(loserId)) {
          userStats.set(loserId, {
            userId: loserId,
            displayName: loserName,
            totalWins: 0,
            totalEarnings: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalStaked: 0,
          });
        }

        const stats = userStats.get(loserId)!;
        stats.gamesLost++;
        stats.totalStaked += session.totalStake;
      }
    }

    // Convert to array and calculate additional metrics
    const leaderboard = Array.from(userStats.values()).map((stats, index) => {
      const totalGames = stats.gamesWon + stats.gamesLost;
      const winRate = totalGames > 0 ? (stats.gamesWon / totalGames) * 100 : 0;
      const netProfit = stats.totalEarnings - stats.totalStaked;
      
      return {
        rank: index + 1,
        userId: stats.userId,
        displayName: stats.displayName,
        totalWinnings: stats.totalEarnings,
        matchesWon: stats.gamesWon,
        matchesPlayed: totalGames,
        winRate: Math.round(winRate * 10) / 10,
        avgWinning: stats.gamesWon > 0 ? Math.round(stats.totalEarnings / stats.gamesWon) : 0,
        netProfit,
      };
    });

    // Sort by net profit descending
    leaderboard.sort((a, b) => b.netProfit - a.netProfit);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return NextResponse.json({
      success: true,
      timeframe,
      
      // WEEKLY REWARDS DATA WITH ANTI-SYBIL
      weeklyRewards: {
        currentPeriod: currentWeeklyPeriod ? {
          id: currentWeeklyPeriod.id,
          weekDisplay: formatWeekDisplay(currentWeeklyPeriod.weekStart),
          totalRewardsPool: currentWeeklyPeriod.totalRewardsPool,
          totalMatches: currentWeeklyPeriod.totalMatches,
          isDistributed: currentWeeklyPeriod.isDistributed
        } : null,
        
        weeklyLeaderboard: weeklyLeaderboard.slice(0, 10), // Top 10 eligible
        
        // Anti-sybil transparency info
        antiSybilStats: weeklyStats ? {
          totalPlayers: weeklyStats.totalPlayers,
          eligiblePlayers: weeklyStats.eligiblePlayers,
          ineligiblePlayers: weeklyStats.ineligiblePlayers,
          blockRate: weeklyStats.totalPlayers > 0 
            ? Math.round((weeklyStats.ineligiblePlayers / weeklyStats.totalPlayers) * 100) 
            : 0
        } : null,
        
        // Show ineligible players for transparency (admin view)
        ineligiblePlayers: ineligiblePlayers.slice(0, 5).map((player: WeeklyPlayer) => ({
          displayName: player.displayName,
          points: player.points,
          uniqueOpponentsCount: player.uniqueOpponentsCount,
          winShareFromSingleOpponent: player.winShareFromSingleOpponent,
          reasons: player.ineligibilityReasons
        })),
        
        claimableRewards: claimableWeeklyRewards.map((reward: any) => ({
          id: reward.id,
          rank: reward.rank,
          points: reward.points,
          rewardAmount: reward.rewardAmount,
          weekDisplay: formatWeekDisplay(reward.weeklyPeriod.weekStart)
        })),
        
        recentlyClaimed: recentlyClaimed.map((reward: any) => ({
          rank: reward.rank,
          points: reward.points,
          rewardAmount: reward.rewardAmount,
          weekDisplay: formatWeekDisplay(reward.weeklyPeriod.weekStart),
          claimedAt: reward.claimedAt
        })),
        
        totalClaimableAmount: claimableWeeklyRewards.reduce((sum: number, reward: any) => sum + reward.rewardAmount, 0)
      },
      
      // REGULAR LEADERBOARD DATA
      leaderboard: leaderboard.slice(0, 50),
      totalPlayers: leaderboard.length,
      totalMatches: results.length,
      generatedAt: now.toISOString(),
    });

  } catch (error: any) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
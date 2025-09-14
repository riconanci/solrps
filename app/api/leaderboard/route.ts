// app/api/leaderboard/route.ts - COMPLETE REWRITE WITH FIXED WEEKLY MATCHES PLAYED
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../_utils";
import { getCurrentWeekStart, getCurrentWeekEnd, formatWeekDisplay, getWeeklyLeaderboard } from "@/lib/weekly";

// Type definitions
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
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  totalStaked: number;
}

export async function GET(req: NextRequest) {
  try {
    console.log("🎯 Starting leaderboard API with weekly matches played fix...");
    
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all";
    const user = await getUserOrSeed(req);
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeframe === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: weekAgo } };
      console.log("📅 Using week filter");
    } else if (timeframe === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: monthAgo } };
      console.log("📅 Using month filter");
    } else {
      console.log("📅 Using all-time filter");
    }

    // WEEKLY REWARDS DATA WITH ANTI-SYBIL FILTERING
    console.log("🔍 Getting weekly rewards data...");
    const weekStart = getCurrentWeekStart();
    const weekEnd = getCurrentWeekEnd(weekStart);

    let currentWeeklyPeriod = await prisma.weeklyPeriod.findUnique({
      where: { weekStart }
    });

    let weeklyLeaderboard: WeeklyPlayer[] = [];
    let weeklyStats: WeeklyStats | null = null;
    let ineligiblePlayers: WeeklyPlayer[] = [];
    
    if (currentWeeklyPeriod) {
      console.log(`📊 Found current weekly period: ${currentWeeklyPeriod.id}`);
      const leaderboardResult: LeaderboardResult = await getWeeklyLeaderboard(prisma, currentWeeklyPeriod.id);
      weeklyLeaderboard = leaderboardResult.leaderboard;
      ineligiblePlayers = leaderboardResult.ineligiblePlayers;
      weeklyStats = leaderboardResult.stats;
      
      console.log(`📈 Weekly leaderboard: ${weeklyLeaderboard.length} eligible players`);
      console.log("🏆 Top 3 weekly players:");
      weeklyLeaderboard.slice(0, 3).forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.displayName}: ${player.matchesPlayed} played, ${player.matchesWon} won`);
      });
    } else {
      console.log("⚠️ No current weekly period found");
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
      take: 5
    });

    // REGULAR LEADERBOARD DATA - FIXED TO INCLUDE ALL MATCHES
    console.log("🔍 Fetching ALL match results (including draws) for regular leaderboard...");
    
    const results = await prisma.matchResult.findMany({
      where: {
        ...dateFilter,
        // REMOVED: winnerUserId: { not: null }, - This was excluding draws!
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

    console.log(`📊 Found ${results.length} total match results (including draws) for timeframe: ${timeframe}`);

    // Calculate regular stats per user - REWRITTEN TO COUNT ALL PARTICIPANTS
    const userStats = new Map<string, RegularPlayer>();

    for (const result of results) {
      const session = result.session;
      
      if (!session.challengerId || !session.challenger) {
        console.log(`⚠️ Skipping incomplete session: ${session.id}`);
        continue;
      }
      
      const creatorId = session.creatorId;
      const challengerId = session.challengerId;
      
      // Initialize creator if not exists
      if (!userStats.has(creatorId)) {
        userStats.set(creatorId, {
          userId: creatorId,
          displayName: session.creator.displayName || `User ${creatorId.slice(0, 8)}`,
          totalWinnings: 0,
          matchesWon: 0,
          matchesPlayed: 0,
          totalStaked: 0
        });
      }
      
      // Initialize challenger if not exists
      if (!userStats.has(challengerId)) {
        userStats.set(challengerId, {
          userId: challengerId,
          displayName: session.challenger.displayName || `User ${challengerId.slice(0, 8)}`,
          totalWinnings: 0,
          matchesWon: 0,
          matchesPlayed: 0,
          totalStaked: 0
        });
      }
      
      const creatorStats = userStats.get(creatorId)!;
      const challengerStats = userStats.get(challengerId)!;
      
      // Both players participated - increment matches played
      creatorStats.matchesPlayed++;
      challengerStats.matchesPlayed++;
      
      // Both players staked tokens
      creatorStats.totalStaked += session.totalStake;
      challengerStats.totalStaked += session.totalStake;
      
      // Handle winnings and wins based on outcome
      if (result.overall === "DRAW") {
        // On draw, both players get their stake back
        creatorStats.totalWinnings += session.totalStake;
        challengerStats.totalWinnings += session.totalStake;
        // No one gets a win counted
      } else if (result.winnerUserId === creatorId) {
        // Creator won
        creatorStats.matchesWon++;
        creatorStats.totalWinnings += result.payoutWinner;
        // Challenger gets nothing (loses stake)
      } else if (result.winnerUserId === challengerId) {
        // Challenger won
        challengerStats.matchesWon++;
        challengerStats.totalWinnings += result.payoutWinner;
        // Creator gets nothing (loses stake)
      }
    }

    console.log(`👥 Processed ${userStats.size} unique players`);

    // Convert to array and calculate additional metrics
    const leaderboard = Array.from(userStats.values()).map((stats) => {
      const winRate = stats.matchesPlayed > 0 ? (stats.matchesWon / stats.matchesPlayed) * 100 : 0;
      const netProfit = stats.totalWinnings - stats.totalStaked;
      const avgWinning = stats.matchesWon > 0 ? Math.round(stats.totalWinnings / stats.matchesWon) : 0;
      
      return {
        rank: 0, // Will be set after sorting
        userId: stats.userId,
        displayName: stats.displayName,
        totalWinnings: stats.totalWinnings,
        matchesWon: stats.matchesWon,
        matchesPlayed: stats.matchesPlayed,
        winRate: winRate.toFixed(1),
        avgWinning,
        netProfit,
      };
    });

    // Sort by net profit descending and assign ranks
    leaderboard.sort((a, b) => b.netProfit - a.netProfit);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`📈 Generated regular leaderboard with ${leaderboard.length} players`);
    console.log("🏆 Top 3 regular players matches verification:");
    leaderboard.slice(0, 3).forEach((player, index) => {
      console.log(`  ${index + 1}. ${player.displayName}: ${player.matchesPlayed} played, ${player.matchesWon} won`);
    });

    const response = {
      success: true,
      timeframe,
      
      // WEEKLY REWARDS DATA WITH PROPER MATCHES PLAYED
      weeklyRewards: {
        currentPeriod: currentWeeklyPeriod ? {
          id: currentWeeklyPeriod.id,
          weekDisplay: formatWeekDisplay(currentWeeklyPeriod.weekStart),
          totalRewardsPool: currentWeeklyPeriod.totalRewardsPool,
          totalMatches: currentWeeklyPeriod.totalMatches,
          isDistributed: currentWeeklyPeriod.isDistributed
        } : null,
        
        // FIXED: Include matchesPlayed in weekly leaderboard
        weeklyLeaderboard: weeklyLeaderboard.slice(0, 10).map((player: WeeklyPlayer) => ({
          userId: player.userId,
          displayName: player.displayName,
          points: player.points,
          totalWinnings: player.totalWinnings,
          matchesWon: player.matchesWon,
          matchesPlayed: player.matchesPlayed, // NOW INCLUDED!
        })),
        
        // Anti-sybil transparency info
        stats: weeklyStats ? {
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
      
      // REGULAR LEADERBOARD DATA - TOP 50 WITH PROPER MATCHES PLAYED
      leaderboard: leaderboard.slice(0, 50),
      totalPlayers: leaderboard.length,
      totalMatches: results.length,
      generatedAt: now.toISOString(),
    };

    console.log("✅ Leaderboard API response generated successfully");
    console.log(`📤 Response includes ${response.leaderboard.length} regular players, ${response.weeklyRewards.weeklyLeaderboard.length} weekly players`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("❌ Leaderboard API error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
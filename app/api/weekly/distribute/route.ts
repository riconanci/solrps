// app/api/weekly/distribute/route.ts - UPDATED FOR ANTI-SYBIL
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isWeeklyPeriodComplete, getWeeklyLeaderboard } from "@/lib/weekly";
import { calculateWeeklyRewardDistribution } from "@/lib/payout";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { weeklyPeriodId } = body;

    if (!weeklyPeriodId) {
      return NextResponse.json({ error: "Weekly period ID required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Get the weekly period
      const period = await tx.weeklyPeriod.findUnique({
        where: { id: weeklyPeriodId }
      });

      if (!period) {
        throw new Error("Weekly period not found");
      }

      if (period.isDistributed) {
        throw new Error("Rewards already distributed for this period");
      }

      if (!isWeeklyPeriodComplete(period)) {
        throw new Error("Weekly period is not yet complete");
      }

      // Get weekly leaderboard with anti-sybil filtering
      const leaderboardResult = await getWeeklyLeaderboard(tx, weeklyPeriodId);
      const { leaderboard, ineligiblePlayers, stats } = leaderboardResult;
      
      if (leaderboard.length === 0) {
        // Log why no one is eligible
        console.log("🚨 NO ELIGIBLE PLAYERS FOR WEEKLY REWARDS:");
        console.log(`   - Total players: ${stats.totalPlayers}`);
        console.log(`   - Ineligible: ${stats.ineligiblePlayers}`);
        
        // Mark period as distributed even with no rewards
        await tx.weeklyPeriod.update({
          where: { id: weeklyPeriodId },
          data: {
            isDistributed: true,
            distributedAt: new Date()
          }
        });
        
        return {
          period,
          leaderboard: [],
          rewards: [],
          totalDistributed: 0,
          ineligiblePlayers,
          stats
        };
      }

      // Calculate reward distribution
      const rewardAmounts = calculateWeeklyRewardDistribution(period.totalRewardsPool);
      
      // Create weekly reward records for eligible top 10
      const rewards = [];
      for (let i = 0; i < Math.min(leaderboard.length, 10); i++) {
        const player = leaderboard[i];
        const rewardAmount = rewardAmounts[i] || 0;
        
        if (rewardAmount > 0) {
          const reward = await tx.weeklyReward.create({
            data: {
              weeklyPeriodId,
              userId: player.userId,
              rank: i + 1,
              points: player.points,
              rewardAmount,
              isClaimed: false
            }
          });
          rewards.push(reward);
        }
      }

      // Mark period as distributed
      await tx.weeklyPeriod.update({
        where: { id: weeklyPeriodId },
        data: {
          isDistributed: true,
          distributedAt: new Date()
        }
      });

      // Log successful distribution with anti-sybil stats
      console.log(`✅ WEEKLY REWARDS DISTRIBUTED: ${rewards.length} players`);
      console.log(`   - Total players: ${stats.totalPlayers}`);
      console.log(`   - Eligible: ${stats.eligiblePlayers}`);
      console.log(`   - Ineligible (anti-sybil): ${stats.ineligiblePlayers}`);

      return {
        period,
        leaderboard,
        rewards,
        totalDistributed: rewardAmounts.slice(0, rewards.length).reduce((sum, amount) => sum + amount, 0),
        ineligiblePlayers,
        stats
      };
    });

    return NextResponse.json({
      success: true,
      message: `Distributed ${result.totalDistributed} tokens to ${result.rewards.length} eligible players`,
      ...result,
      antiSybilReport: {
        totalPlayers: result.stats.totalPlayers,
        eligiblePlayers: result.stats.eligiblePlayers,
        ineligiblePlayers: result.stats.ineligiblePlayers,
        ineligibleReasons: result.ineligiblePlayers.map((p: any) => ({
          displayName: p.displayName,
          reasons: p.ineligibilityReasons
        }))
      }
    });

  } catch (error: any) {
    console.error("Weekly distribution error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to distribute weekly rewards" 
    }, { status: 500 });
  }
}

// GET endpoint to check which periods need distribution
export async function GET() {
  try {
    const completedPeriods = await prisma.weeklyPeriod.findMany({
      where: {
        isDistributed: false,
        weekEnd: { lte: new Date() } // Week has ended
      },
      orderBy: { weekStart: 'desc' }
    });

    return NextResponse.json({
      success: true,
      pendingDistributions: completedPeriods
    });

  } catch (error: any) {
    console.error("Check distributions error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to check pending distributions" 
    }, { status: 500 });
  }
}
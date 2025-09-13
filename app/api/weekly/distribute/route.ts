// app/api/weekly/distribute/route.ts
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

      // Get weekly leaderboard
      const leaderboard = await getWeeklyLeaderboard(tx, weeklyPeriodId);
      
      if (leaderboard.length === 0) {
        throw new Error("No eligible players for rewards");
      }

      // Calculate reward distribution
      const rewardAmounts = calculateWeeklyRewardDistribution(period.totalRewardsPool);
      
      // Create weekly reward records for top 10
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

      return {
        period,
        leaderboard,
        rewards,
        totalDistributed: rewardAmounts.reduce((sum, amount) => sum + amount, 0)
      };
    });

    return NextResponse.json({
      success: true,
      message: `Distributed ${result.totalDistributed} tokens to ${result.rewards.length} players`,
      ...result
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
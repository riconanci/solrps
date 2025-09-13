// app/api/weekly/auto-distribute/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isWeeklyPeriodComplete, getWeeklyLeaderboard } from "@/lib/weekly";
import { calculateWeeklyRewardDistribution } from "@/lib/payout";

export async function GET() {
  try {
    console.log("Starting automatic weekly distribution...");

    // Find all completed periods that haven't been distributed yet
    const completedPeriods = await prisma.weeklyPeriod.findMany({
      where: {
        isDistributed: false,
        weekEnd: { lte: new Date() } // Week has ended
      },
      orderBy: { weekStart: 'asc' } // Process oldest first
    });

    if (completedPeriods.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No periods ready for distribution",
        distributedPeriods: []
      });
    }

    console.log(`Found ${completedPeriods.length} periods ready for distribution`);

    const distributedPeriods = [];

    for (const period of completedPeriods) {
      try {
        const result = await prisma.$transaction(async (tx: any) => {
          // Double-check the period hasn't been processed by another request
          const currentPeriod = await tx.weeklyPeriod.findUnique({
            where: { id: period.id }
          });

          if (!currentPeriod || currentPeriod.isDistributed) {
            console.log(`Period ${period.id} already distributed, skipping`);
            return null;
          }

          // Get weekly leaderboard
          const leaderboard = await getWeeklyLeaderboard(tx, period.id);
          
          if (leaderboard.length === 0) {
            console.log(`No players for period ${period.id}, marking as distributed`);
            await tx.weeklyPeriod.update({
              where: { id: period.id },
              data: {
                isDistributed: true,
                distributedAt: new Date()
              }
            });
            return { period, leaderboard: [], rewards: [], totalDistributed: 0 };
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
                  weeklyPeriodId: period.id,
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
            where: { id: period.id },
            data: {
              isDistributed: true,
              distributedAt: new Date()
            }
          });

          const totalDistributed = rewardAmounts.reduce((sum, amount) => sum + amount, 0);

          console.log(`Distributed ${totalDistributed} tokens to ${rewards.length} players for period ${period.id}`);

          return {
            period,
            leaderboard,
            rewards,
            totalDistributed
          };
        });

        if (result) {
          distributedPeriods.push(result);
        }

      } catch (error) {
        console.error(`Error distributing rewards for period ${period.id}:`, error);
        // Continue with other periods even if one fails
      }
    }

    const totalDistributed = distributedPeriods.reduce((sum, p) => sum + p.totalDistributed, 0);
    const totalRewards = distributedPeriods.reduce((sum, p) => sum + p.rewards.length, 0);

    console.log(`Weekly distribution complete: ${totalDistributed} tokens to ${totalRewards} players across ${distributedPeriods.length} periods`);

    return NextResponse.json({
      success: true,
      message: `Distributed ${totalDistributed} tokens to ${totalRewards} players across ${distributedPeriods.length} periods`,
      distributedPeriods: distributedPeriods.map(p => ({
        periodId: p.period.id,
        weekStart: p.period.weekStart,
        weekEnd: p.period.weekEnd,
        totalDistributed: p.totalDistributed,
        rewardsCount: p.rewards.length,
        topPlayers: p.leaderboard.slice(0, 3).map((player: any) => ({
          displayName: player.displayName,
          points: player.points
        }))
      }))
    });

  } catch (error: any) {
    console.error("Auto weekly distribution error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to auto-distribute weekly rewards" 
    }, { status: 500 });
  }
}

// Also expose as POST for manual triggering
export async function POST() {
  return GET();
}
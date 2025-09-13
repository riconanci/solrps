// app/api/weekly/auto-distribute/route.ts - UPDATED FOR ANTI-SYBIL
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isWeeklyPeriodComplete, getWeeklyLeaderboard } from "@/lib/weekly";
import { calculateWeeklyRewardDistribution } from "@/lib/payout";

export async function GET() {
  try {
    console.log("🚀 Starting automatic weekly rewards distribution...");

    // Get all completed periods that haven't been distributed yet
    const completedPeriods = await prisma.weeklyPeriod.findMany({
      where: {
        isDistributed: false,
        weekEnd: { lte: new Date() } // Week has ended
      },
      orderBy: { weekStart: 'desc' }
    });

    console.log(`Found ${completedPeriods.length} periods ready for distribution`);

    const distributedPeriods = [];

    // Process each completed period
    for (const period of completedPeriods) {
      try {
        console.log(`Processing period ${period.id} (${period.weekStart.toISOString()})`);

        const result = await prisma.$transaction(async (tx: any) => {
          // Get weekly leaderboard with anti-sybil filtering
          const leaderboardResult = await getWeeklyLeaderboard(tx, period.id);
          const { leaderboard, ineligiblePlayers, stats } = leaderboardResult;

          // Log anti-sybil results
          console.log(`📊 Period ${period.id} stats:`);
          console.log(`   - Total players: ${stats.totalPlayers}`);
          console.log(`   - Eligible: ${stats.eligiblePlayers}`);
          console.log(`   - Ineligible (anti-sybil): ${stats.ineligiblePlayers}`);

          if (ineligiblePlayers.length > 0) {
            console.log(`🚨 Ineligible players:`);
            ineligiblePlayers.forEach((player: any) => {
              console.log(`   - ${player.displayName}: ${player.ineligibilityReasons.join(', ')}`);
            });
          }

          if (leaderboard.length === 0) {
            console.log(`No eligible players for period ${period.id}, marking as distributed`);
            await tx.weeklyPeriod.update({
              where: { id: period.id },
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

          const totalDistributed = rewardAmounts.slice(0, rewards.length).reduce((sum, amount) => sum + amount, 0);

          console.log(`✅ Distributed ${totalDistributed} tokens to ${rewards.length} eligible players for period ${period.id}`);

          return {
            period,
            leaderboard,
            rewards,
            totalDistributed,
            stats
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
    const totalPlayers = distributedPeriods.reduce((sum, p) => sum + (p.stats?.totalPlayers || 0), 0);
    const totalEligible = distributedPeriods.reduce((sum, p) => sum + (p.stats?.eligiblePlayers || 0), 0);
    const totalIneligible = distributedPeriods.reduce((sum, p) => sum + (p.stats?.ineligiblePlayers || 0), 0);

    console.log(`🎉 Weekly distribution complete:`);
    console.log(`   - ${totalDistributed} tokens distributed`);
    console.log(`   - ${totalRewards} players received rewards`);
    console.log(`   - ${distributedPeriods.length} periods processed`);
    console.log(`   - ${totalPlayers} total players, ${totalEligible} eligible, ${totalIneligible} blocked (anti-sybil)`);

    return NextResponse.json({
      success: true,
      message: `Distributed ${totalDistributed} tokens to ${totalRewards} eligible players across ${distributedPeriods.length} periods`,
      distributedPeriods: distributedPeriods.map(p => ({
        periodId: p.period.id,
        weekStart: p.period.weekStart,
        weekEnd: p.period.weekEnd,
        totalDistributed: p.totalDistributed,
        rewardsCount: p.rewards.length,
        topPlayers: p.leaderboard.slice(0, 3).map((player: any) => ({
          displayName: player.displayName,
          points: player.points
        })),
        antiSybilStats: p.stats
      })),
      antiSybilSummary: {
        totalPlayers,
        eligiblePlayers: totalEligible,
        ineligiblePlayers: totalIneligible,
        blockRate: totalPlayers > 0 ? Math.round((totalIneligible / totalPlayers) * 100) : 0
      }
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
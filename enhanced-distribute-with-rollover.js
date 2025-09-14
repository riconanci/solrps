// enhanced-distribute-with-rollover.js
// Manual distribution with proper rollover logic
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getCurrentWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  return weekStart;
}

function getCurrentWeekEnd(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return weekEnd;
}

// Weekly reward distribution percentages
const WEEKLY_REWARD_DISTRIBUTION = [
  50, // 1st: 50%
  20, // 2nd: 20% 
  10, // 3rd: 10%
  5,  // 4th: 5%
  5,  // 5th: 5%
  2,  // 6th: 2%
  2,  // 7th: 2%
  2,  // 8th: 2%
  2,  // 9th: 2%
  2   // 10th: 2%
]; // Total: 100%

function calculateWeeklyRewardDistribution(totalPool) {
  return WEEKLY_REWARD_DISTRIBUTION.map(percentage => 
    Math.floor(totalPool * percentage / 100)
  );
}

async function enhancedDistribution() {
  try {
    console.log("🎯 ENHANCED DISTRIBUTION WITH ROLLOVER\n");

    // Find completed periods that need distribution
    const completedPeriods = await prisma.weeklyPeriod.findMany({
      where: {
        isDistributed: false,
        weekEnd: { lte: new Date() }
      },
      orderBy: { weekStart: 'desc' },
      take: 1 // Process most recent first
    });

    if (completedPeriods.length === 0) {
      console.log("❌ No periods ready for distribution");
      return;
    }

    const period = completedPeriods[0];
    console.log(`📊 Processing Period: ${period.id}`);
    console.log(`📅 Dates: ${period.weekStart.toISOString()} to ${period.weekEnd.toISOString()}`);
    console.log(`💰 Total Pool: ${period.totalRewardsPool} tokens`);

    const result = await prisma.$transaction(async (tx) => {
      // Get all match results from this period
      const results = await tx.matchResult.findMany({
        where: {
          createdAt: {
            gte: period.weekStart,
            lt: period.weekEnd
          },
          winnerUserId: { not: null }
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

      // Calculate basic leaderboard (simplified for demo)
      const userStats = new Map();
      
      for (const result of results) {
        const winnerId = result.winnerUserId;
        const session = result.session;
        
        if (!userStats.has(winnerId)) {
          let winnerName = `User ${winnerId.slice(0, 8)}`;
          if (session.creator.id === winnerId) {
            winnerName = session.creator.displayName || winnerName;
          } else if (session.challenger?.id === winnerId) {
            winnerName = session.challenger.displayName || winnerName;
          }

          userStats.set(winnerId, {
            userId: winnerId,
            displayName: winnerName,
            points: 0,
            totalWinnings: 0,
            matchesWon: 0
          });
        }

        const stats = userStats.get(winnerId);
        stats.matchesWon++;
        stats.totalWinnings += result.payoutWinner;
        stats.points += 10 + Math.floor(result.payoutWinner / 100);
      }

      // Convert to leaderboard array and sort
      const leaderboard = Array.from(userStats.values())
        .sort((a, b) => {
          if (a.points !== b.points) return b.points - a.points;
          return b.totalWinnings - a.totalWinnings;
        });

      console.log(`🏆 Found ${leaderboard.length} eligible players`);

      // Calculate reward amounts for all 10 positions
      const rewardAmounts = calculateWeeklyRewardDistribution(period.totalRewardsPool);
      console.log(`💰 Reward breakdown:`, rewardAmounts);

      // Create rewards only for players that exist
      const rewards = [];
      let totalDistributed = 0;

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
          totalDistributed += rewardAmount;
          
          console.log(`🎁 Rank ${i + 1}: ${player.displayName} gets ${rewardAmount} tokens`);
        }
      }

      // Calculate rollover amount (undistributed rewards)
      const rolloverAmount = period.totalRewardsPool - totalDistributed;
      
      console.log(`\n📊 DISTRIBUTION SUMMARY:`);
      console.log(`   💰 Total Pool: ${period.totalRewardsPool}`);
      console.log(`   🎁 Distributed: ${totalDistributed}`);
      console.log(`   🔄 Rollover: ${rolloverAmount}`);
      console.log(`   👥 Players Rewarded: ${rewards.length}/10`);

      // Mark current period as distributed
      await tx.weeklyPeriod.update({
        where: { id: period.id },
        data: {
          isDistributed: true,
          distributedAt: new Date()
        }
      });

      // 🎯 CREATE NEW ACTIVE PERIOD WITH ROLLOVER
      const nextWeekStart = getCurrentWeekStart();
      const nextWeekEnd = getCurrentWeekEnd(nextWeekStart);
      
      // Check if next period already exists
      const existingNextPeriod = await tx.weeklyPeriod.findUnique({
        where: { weekStart: nextWeekStart }
      });

      let nextPeriod;
      if (!existingNextPeriod) {
        nextPeriod = await tx.weeklyPeriod.create({
          data: {
            weekStart: nextWeekStart,
            weekEnd: nextWeekEnd,
            totalRewardsPool: rolloverAmount, // 🎯 START WITH ROLLOVER
            totalMatches: 0,
            isDistributed: false
          }
        });
        console.log(`\n🆕 CREATED NEW ACTIVE PERIOD:`);
        console.log(`   📅 Dates: ${nextWeekStart.toISOString()} to ${nextWeekEnd.toISOString()}`);
        console.log(`   💰 Starting Pool: ${rolloverAmount} tokens (from rollover)`);
        console.log(`   🎮 Matches: 0`);
        console.log(`   ✅ Status: ACTIVE`);
      } else {
        // Update existing period with rollover
        nextPeriod = await tx.weeklyPeriod.update({
          where: { id: existingNextPeriod.id },
          data: {
            totalRewardsPool: { increment: rolloverAmount }
          }
        });
        console.log(`\n🔄 UPDATED EXISTING PERIOD WITH ROLLOVER:`);
        console.log(`   💰 New Pool: ${nextPeriod.totalRewardsPool} tokens`);
      }

      return {
        distributedPeriod: period,
        rewards,
        totalDistributed,
        rolloverAmount,
        nextPeriod,
        leaderboard: leaderboard.slice(0, 10)
      };
    });

    console.log(`\n🎉 ENHANCED DISTRIBUTION COMPLETE!`);
    console.log(`✅ ${result.rewards.length} players received rewards`);
    console.log(`✅ ${result.rolloverAmount} tokens rolled over to next week`);
    console.log(`✅ New active period created with rollover pool`);

  } catch (error) {
    console.error("❌ Enhanced distribution error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

enhancedDistribution();
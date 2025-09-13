// scripts/init-weekly-rewards.js
// Run this to manually initialize weekly rewards from existing games
// Usage: node scripts/init-weekly-rewards.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get the start of the current week (Monday 12am UTC)
function getCurrentWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  return weekStart;
}

// Get the end of the current week (next Monday 12am UTC)
function getCurrentWeekEnd(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return weekEnd;
}

async function initializeWeeklyRewards() {
  console.log("🎯 Initializing Weekly Rewards System...");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get or create current weekly period
      const weekStart = getCurrentWeekStart();
      const weekEnd = getCurrentWeekEnd(weekStart);
      
      let period = await tx.weeklyPeriod.findUnique({
        where: { weekStart }
      });
      
      if (!period) {
        period = await tx.weeklyPeriod.create({
          data: {
            weekStart,
            weekEnd,
            totalRewardsPool: 0,
            totalMatches: 0,
            isDistributed: false
          }
        });
        console.log(`✅ Created weekly period: ${period.id}`);
      } else {
        console.log(`✅ Found existing period: ${period.id}`);
      }

      // 2. Get all match results from this week that have weekly fees
      const thisWeekMatches = await tx.matchResult.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      console.log(`📊 Found ${thisWeekMatches.length} matches this week`);

      // 3. Calculate total weekly fees from matches
      let totalWeeklyFees = 0;
      for (const match of thisWeekMatches) {
        // If feesWeeklyRewards field exists, use it
        if (match.feesWeeklyRewards) {
          totalWeeklyFees += match.feesWeeklyRewards;
        } else {
          // Calculate from pot (2% of total pot)
          const weeklyFee = Math.floor(match.pot * 0.02);
          totalWeeklyFees += weeklyFee;
        }
      }

      console.log(`💰 Total weekly fees accumulated: ${totalWeeklyFees} tokens`);

      // 4. Update weekly period with accumulated fees
      const updatedPeriod = await tx.weeklyPeriod.update({
        where: { id: period.id },
        data: {
          totalRewardsPool: totalWeeklyFees,
          totalMatches: thisWeekMatches.length
        }
      });

      // 5. Get leaderboard data
      const userStats = new Map();
      
      for (const match of thisWeekMatches) {
        if (match.winnerUserId) {
          const winnerId = match.winnerUserId;
          
          if (!userStats.has(winnerId)) {
            // Get user display name
            const user = await tx.user.findUnique({ 
              where: { id: winnerId },
              select: { displayName: true }
            });
            
            userStats.set(winnerId, {
              userId: winnerId,
              displayName: user?.displayName || `User ${winnerId.slice(0, 8)}`,
              points: 0,
              totalWinnings: 0,
              matchesWon: 0,
              matchesPlayed: 0
            });
          }
          
          const stats = userStats.get(winnerId);
          stats.matchesWon++;
          stats.totalWinnings += match.payoutWinner;
          // Points: 10 per win + bonus for payout amount
          stats.points += 10 + Math.floor(match.payoutWinner / 100);
        }
      }

      // Convert to leaderboard array
      const leaderboard = Array.from(userStats.values())
        .sort((a, b) => {
          if (a.points !== b.points) return b.points - a.points;
          return b.totalWinnings - a.totalWinnings;
        });

      return {
        period: updatedPeriod,
        leaderboard,
        totalMatches: thisWeekMatches.length,
        totalWeeklyFees
      };
    });

    console.log("\n🎉 Weekly Rewards System Initialized!");
    console.log(`📅 Week: ${result.period.weekStart.toISOString()} to ${result.period.weekEnd.toISOString()}`);
    console.log(`🎮 Total Matches: ${result.totalMatches}`);
    console.log(`💰 Reward Pool: ${result.totalWeeklyFees} tokens`);
    console.log(`\n🏆 Current Leaderboard:`);
    
    result.leaderboard.forEach((player, index) => {
      console.log(`${index + 1}. ${player.displayName}: ${player.points} points (${player.matchesWon} wins, ${player.totalWinnings} tokens)`);
    });

    console.log(`\n✅ Now visit /leaderboard to see the weekly rewards section!`);

  } catch (error) {
    console.error("❌ Failed to initialize weekly rewards:", error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeWeeklyRewards();
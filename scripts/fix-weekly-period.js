// Fix Weekly Period Script
// Save as: scripts/fix-weekly-period.js
// Run: node scripts/fix-weekly-period.js

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

async function fixWeeklyPeriod() {
  console.log("🔧 FIXING WEEKLY PERIOD...");
  
  try {
    const weekStart = getCurrentWeekStart();
    const weekEnd = getCurrentWeekEnd(weekStart);
    
    console.log(`📅 Creating period: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
    
    // Check if it already exists
    let period = await prisma.weeklyPeriod.findUnique({
      where: { weekStart }
    });
    
    if (period) {
      console.log(`✅ Period already exists: ${period.id}`);
      return period;
    }
    
    // Get matches from this week
    const thisWeekMatches = await prisma.matchResult.findMany({
      where: {
        createdAt: {
          gte: weekStart,
          lt: weekEnd
        }
      }
    });
    
    console.log(`🎮 Found ${thisWeekMatches.length} matches this week`);
    
    // Calculate total weekly fees
    let totalWeeklyFees = 0;
    for (const match of thisWeekMatches) {
      if (match.feesWeeklyRewards) {
        totalWeeklyFees += match.feesWeeklyRewards;
      } else if (match.winnerUserId) {
        // 2% of pot goes to weekly rewards (only on wins, not draws)
        totalWeeklyFees += Math.floor(match.pot * 0.02);
      }
    }
    
    console.log(`💰 Calculated prize pool: ${totalWeeklyFees} tokens`);
    
    // Create the weekly period
    period = await prisma.weeklyPeriod.create({
      data: {
        weekStart,
        weekEnd,
        totalRewardsPool: totalWeeklyFees,
        totalMatches: thisWeekMatches.length,
        isDistributed: false
      }
    });
    
    console.log(`✅ Created weekly period: ${period.id}`);
    console.log(`   - Prize Pool: ${period.totalRewardsPool} tokens`);
    console.log(`   - Total Matches: ${period.totalMatches}`);
    console.log(`   - Status: ${period.isDistributed ? 'Distributed' : 'Active'}`);
    
    console.log("\n🎉 SUCCESS! Weekly period created!");
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Go to http://localhost:3000/leaderboard");
    console.log("2. Click 'Weekly Competition' tab");
    console.log("3. You should now see the 3-column stats grid!");
    console.log("4. If prize pool is 0, play some games to generate rewards");
    
    // Show current users for testing
    const users = await prisma.user.findMany({
      select: { id: true, displayName: true, mockBalance: true }
    });
    
    console.log("\n👥 Available test users:");
    users.forEach(user => {
      console.log(`   - ${user.displayName} (${user.id}): ${user.mockBalance} tokens`);
    });
    
    if (thisWeekMatches.length === 0) {
      console.log("\n🎮 TO GENERATE TEST DATA:");
      console.log("1. Go to http://localhost:3000/play (as Alice)");
      console.log("2. Create a game");
      console.log("3. Go to http://localhost:3000/lobby?user=bob (as Bob)");
      console.log("4. Join Alice's game");
      console.log("5. Refresh leaderboard to see updated prize pool");
    }
    
    return period;
    
  } catch (error) {
    console.error("❌ Error fixing weekly period:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixWeeklyPeriod()
  .then(() => {
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
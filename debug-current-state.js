// debug-current-state.js - Check what's actually happening
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

async function debugCurrentState() {
  try {
    console.log("🔍 DEBUGGING CURRENT SYSTEM STATE\n");
    
    const now = new Date();
    const currentWeekStart = getCurrentWeekStart();
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + 7);
    
    console.log(`📅 CURRENT TIME INFO:`);
    console.log(`   Now: ${now.toISOString()}`);
    console.log(`   Expected current week start: ${currentWeekStart.toISOString()}`);
    console.log(`   Expected current week end: ${currentWeekEnd.toISOString()}`);
    console.log(`   Is current week ongoing? ${now < currentWeekEnd ? 'YES ✅' : 'NO ❌'}\n`);
    
    // Get all periods
    const allPeriods = await prisma.weeklyPeriod.findMany({
      orderBy: { weekStart: 'desc' }
    });

    console.log(`📊 ALL WEEKLY PERIODS (${allPeriods.length} found):\n`);
    
    allPeriods.forEach((period, index) => {
      const isComplete = now >= period.weekEnd;
      const isCurrent = period.weekStart.getTime() === currentWeekStart.getTime();
      const status = period.isDistributed ? 'DISTRIBUTED' : 'ACTIVE';
      
      console.log(`${index + 1}. ID: ${period.id}`);
      console.log(`   Start: ${period.weekStart.toISOString()}`);
      console.log(`   End: ${period.weekEnd.toISOString()}`);
      console.log(`   Status: ${status}`);
      console.log(`   Complete: ${isComplete ? 'YES' : 'NO'}`);
      console.log(`   Is Current Week: ${isCurrent ? 'YES ✅' : 'NO'}`);
      console.log(`   Pool: ${period.totalRewardsPool} tokens`);
      console.log(`   Matches: ${period.totalMatches}`);
      
      if (period.distributedAt) {
        console.log(`   Distributed At: ${period.distributedAt.toISOString()}`);
      }
      
      console.log('');
    });
    
    // Check what the leaderboard API would find
    console.log(`🎯 WHAT LEADERBOARD API SEES:`);
    
    const leaderboardPeriod = await prisma.weeklyPeriod.findUnique({
      where: { weekStart: currentWeekStart }
    });
    
    if (leaderboardPeriod) {
      console.log(`   ✅ Found current week period: ${leaderboardPeriod.id}`);
      console.log(`   Status: ${leaderboardPeriod.isDistributed ? 'DISTRIBUTED' : 'ACTIVE'}`);
      console.log(`   Pool: ${leaderboardPeriod.totalRewardsPool} tokens`);
      console.log(`   Matches: ${leaderboardPeriod.totalMatches}`);
      
      if (leaderboardPeriod.isDistributed && now < leaderboardPeriod.weekEnd) {
        console.log(`   🚨 ISSUE: Period is distributed but week is still ongoing!`);
      }
    } else {
      console.log(`   ❌ No current week period found!`);
      console.log(`   This explains why leaderboard shows old data.`);
    }
    
    // Check for periods that need distribution
    console.log(`\n🎁 PERIODS NEEDING DISTRIBUTION:`);
    const needingDistribution = await prisma.weeklyPeriod.findMany({
      where: {
        isDistributed: false,
        weekEnd: { lte: now }
      }
    });
    
    console.log(`   Found: ${needingDistribution.length} periods`);
    needingDistribution.forEach(period => {
      console.log(`   - ${period.id}: ${period.weekStart.toISOString()} (Pool: ${period.totalRewardsPool})`);
    });
    
    // Solution suggestions
    console.log(`\n💡 SOLUTION:`);
    if (!leaderboardPeriod) {
      console.log(`   1. Create missing current week period`);
      console.log(`   2. Set it as ACTIVE with rollover amount`);
    } else if (leaderboardPeriod.isDistributed && now < leaderboardPeriod.weekEnd) {
      console.log(`   1. The current week period is marked as distributed too early`);
      console.log(`   2. Either reset it to ACTIVE or create a new period for next week`);
    }

  } catch (error) {
    console.error("❌ Debug error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCurrentState();
// reset-to-active.js - Fix the current week period status
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetToActive() {
  try {
    console.log("🔧 RESETTING CURRENT WEEK TO ACTIVE\n");
    
    // The period we identified
    const periodId = "cmfipd0rr0001iizwmqoah1wj";
    
    const result = await prisma.$transaction(async (tx) => {
      // Get the current period
      const period = await tx.weeklyPeriod.findUnique({
        where: { id: periodId }
      });
      
      if (!period) {
        throw new Error("Period not found");
      }
      
      console.log(`📊 CURRENT PERIOD STATE:`);
      console.log(`   ID: ${period.id}`);
      console.log(`   Dates: ${period.weekStart.toISOString()} to ${period.weekEnd.toISOString()}`);
      console.log(`   Status: ${period.isDistributed ? 'DISTRIBUTED' : 'ACTIVE'}`);
      console.log(`   Pool: ${period.totalRewardsPool} tokens`);
      console.log(`   Matches: ${period.totalMatches}`);
      
      const now = new Date();
      const isStillOngoing = now < period.weekEnd;
      
      console.log(`   Week still ongoing? ${isStillOngoing ? 'YES ✅' : 'NO ❌'}`);
      
      if (!isStillOngoing) {
        console.log(`\n⚠️  Week has actually ended, should create new period instead`);
        return null;
      }
      
      // Reset the period to ACTIVE
      const updatedPeriod = await tx.weeklyPeriod.update({
        where: { id: periodId },
        data: {
          isDistributed: false,
          distributedAt: null  // Clear the distribution timestamp
        }
      });
      
      console.log(`\n✅ PERIOD RESET TO ACTIVE:`);
      console.log(`   Status: ${updatedPeriod.isDistributed ? 'DISTRIBUTED' : 'ACTIVE'}`);
      console.log(`   Pool: ${updatedPeriod.totalRewardsPool} tokens`);
      console.log(`   Matches: ${updatedPeriod.totalMatches}`);
      
      // Also check if there are any weekly rewards that need to be removed
      // (since we're "un-distributing" this period)
      const existingRewards = await tx.weeklyReward.findMany({
        where: { weeklyPeriodId: periodId }
      });
      
      if (existingRewards.length > 0) {
        console.log(`\n🎁 Found ${existingRewards.length} existing rewards for this period`);
        console.log(`   These were created when it was distributed earlier.`);
        console.log(`   Options:`);
        console.log(`   1. Keep them (players can still claim)`);
        console.log(`   2. Remove them (clean slate for re-distribution later)`);
        
        // For testing, let's keep them but show what they are
        existingRewards.forEach((reward, index) => {
          console.log(`   ${index + 1}. Rank ${reward.rank}: ${reward.rewardAmount} tokens (Claimed: ${reward.isClaimed ? 'YES' : 'NO'})`);
        });
      }
      
      return updatedPeriod;
    });
    
    if (result) {
      console.log(`\n🎉 SUCCESS! Current week period is now ACTIVE!`);
      console.log(`✅ Your leaderboard should now show "ACTIVE" status`);
      console.log(`✅ Pool: ${result.totalRewardsPool} tokens available for competition`);
      console.log(`✅ New games will add to this week's competition`);
      
      console.log(`\n📋 NEXT STEPS:`);
      console.log(`   1. Refresh your leaderboard page`);
      console.log(`   2. Play some games to test the active competition`);
      console.log(`   3. Watch the pool and match count update`);
    }

  } catch (error) {
    console.error("❌ Reset error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetToActive();
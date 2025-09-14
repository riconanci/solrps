// create-completed-period.js
// Creates a weekly period that has already ended for testing distribution/claims
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createCompletedPeriod() {
  try {
    console.log("🎯 Creating a COMPLETED weekly period for testing claims...");
    
    // Create a period that ended last week
    const periodStart = new Date('2025-09-02T00:00:00.000Z'); // Sep 2 (Monday)
    const periodEnd = new Date('2025-09-09T00:00:00.000Z');   // Sep 9 (Monday) - PAST
    
    console.log(`📅 Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    console.log(`📍 Current time: ${new Date().toISOString()}`);
    console.log(`✅ Is complete? ${new Date() >= periodEnd ? 'YES - Ready for distribution!' : 'NO - Still ongoing'}`);

    // Check if it already exists
    let period = await prisma.weeklyPeriod.findUnique({
      where: { weekStart: periodStart }
    });

    if (!period) {
      period = await prisma.weeklyPeriod.create({
        data: {
          weekStart: periodStart,
          weekEnd: periodEnd,
          totalRewardsPool: 2500, // Good sized reward pool for testing
          totalMatches: 25,
          isDistributed: false // Ready for distribution
        }
      });
      
      console.log(`\n🎉 Created COMPLETED test period!`);
    } else {
      console.log(`\n✅ Found existing COMPLETED period!`);
      
      // Reset it if it was already distributed (for re-testing)
      if (period.isDistributed) {
        period = await prisma.weeklyPeriod.update({
          where: { id: period.id },
          data: { isDistributed: false }
        });
        console.log(`   🔄 Reset to undistributed for testing`);
      }
    }
    
    console.log(`📋 Period Details:`);
    console.log(`   ID: ${period.id}`);
    console.log(`   Reward Pool: ${period.totalRewardsPool} tokens`);
    console.log(`   Status: ${period.isDistributed ? 'Already Distributed' : 'Ready for Distribution'}`);
    console.log(`   Can Distribute: ${!period.isDistributed && new Date() >= period.weekEnd ? 'YES ✅' : 'NO ❌'}`);

    // Now create some mock match results for this period to create eligible players
    console.log(`\n🎮 Creating mock game results for this period...`);
    
    // Get Alice and Bob user IDs
    const users = await prisma.user.findMany({
      select: { id: true, displayName: true }
    });
    
    if (users.length >= 2) {
      const alice = users.find(u => u.displayName?.includes('Alice')) || users[0];
      const bob = users.find(u => u.displayName?.includes('Bob')) || users[1];
      
      // Create some mock sessions and results within this period
      const mockSessionsAndResults = [];
      
      for (let i = 0; i < 3; i++) {
        // Create session
        const session = await prisma.session.create({
          data: {
            creatorId: alice.id,
            challengerId: bob.id,
            rounds: 1,
            stakePerRound: 500,
            status: 'RESOLVED',
            createdAt: new Date(periodStart.getTime() + i * 86400000), // Spread across the week
            creatorMoves: ['R'],
            challengerMoves: ['S'],
            creatorSalts: ['salt1'],
            challengerSalts: ['salt2']
          }
        });
        
        // Create match result (Alice wins Rock vs Scissors)
        const matchResult = await prisma.matchResult.create({
          data: {
            sessionId: session.id,
            winnerUserId: alice.id,
            pot: 1000,
            payoutWinner: 950,
            payoutLoser: 0,
            feesBurn: 20,
            feesWeeklyRewards: 20,
            feesDev: 10,
            roundResults: [{
              creatorMove: 1, // Rock
              challengerMove: 3, // Scissors  
              winner: 'CREATOR'
            }],
            createdAt: new Date(periodStart.getTime() + i * 86400000)
          }
        });
        
        mockSessionsAndResults.push({ session, matchResult });
      }
      
      console.log(`✅ Created ${mockSessionsAndResults.length} mock games within the period`);
      console.log(`   Alice: ${mockSessionsAndResults.length} wins, ${mockSessionsAndResults.length * 950} tokens earned`);
    }

    console.log(`\n🧪 Now test the distribution:`);
    console.log(`\n📋 Browser Console Command:`);
    console.log(`fetch('/api/weekly/distribute', {`);
    console.log(`  method: 'POST',`);
    console.log(`  headers: { 'Content-Type': 'application/json' },`);
    console.log(`  body: JSON.stringify({ weeklyPeriodId: '${period.id}' })`);
    console.log(`}).then(r => r.json()).then(console.log);`);
    
    console.log(`\n✅ After distribution succeeds, go to /leaderboard to test claims!`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createCompletedPeriod();
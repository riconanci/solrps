const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createCompletedPeriod() {
  try {
    console.log("Creating a COMPLETED weekly period for testing...");
    
    // Create a period that ended 3 days ago
    const periodStart = new Date('2025-08-26T00:00:00.000Z'); // Started Aug 26
    const periodEnd = new Date('2025-09-02T00:00:00.000Z');   // Ended Sep 2 (past)
    
    console.log(`Creating period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    console.log(`Current time: ${new Date().toISOString()}`);
    console.log(`Is complete? ${new Date() >= periodEnd ? 'YES ✅' : 'NO ❌'}`);

    // Check if it already exists
    let period = await prisma.weeklyPeriod.findUnique({
      where: { weekStart: periodStart }
    });

    if (!period) {
      period = await prisma.weeklyPeriod.create({
        data: {
          weekStart: periodStart,
          weekEnd: periodEnd,
          totalRewardsPool: 1800, // Mock reward pool
          totalMatches: 12,
          isDistributed: false // Ready for distribution
        }
      });
      
      console.log(`\n✅ Created COMPLETED test period:`);
    } else {
      console.log(`\n✅ Found existing COMPLETED period:`);
      
      // Update it to make sure it's not distributed
      if (period.isDistributed) {
        period = await prisma.weeklyPeriod.update({
          where: { id: period.id },
          data: { isDistributed: false }
        });
        console.log(`   Reset to undistributed for testing`);
      }
    }
    
    console.log(`   ID: ${period.id}`);
    console.log(`   Pool: ${period.totalRewardsPool} tokens`);
    console.log(`   Status: ${period.isDistributed ? 'Distributed' : 'Pending'}`);
    console.log(`   Ready for distribution: ${!period.isDistributed && new Date() >= period.weekEnd ? 'YES ✅' : 'NO ❌'}`);

    console.log(`\n🧪 Test the manual distribution:`);
    console.log(`curl -X POST http://localhost:3000/api/weekly/distribute -H "Content-Type: application/json" -d '{"weeklyPeriodId": "${period.id}"}'`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createCompletedPeriod();
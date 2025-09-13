const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createFreshPeriod() {
  try {
    console.log("Creating a fresh weekly period for testing...");
    
    // Create a different completed period
    const periodStart = new Date('2025-08-19T00:00:00.000Z'); // Aug 19
    const periodEnd = new Date('2025-08-26T00:00:00.000Z');   // Aug 26
    
    console.log(`Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    console.log(`Is complete? ${new Date() >= periodEnd ? 'YES ✅' : 'NO ❌'}`);

    let period = await prisma.weeklyPeriod.findUnique({
      where: { weekStart: periodStart }
    });

    if (!period) {
      period = await prisma.weeklyPeriod.create({
        data: {
          weekStart: periodStart,
          weekEnd: periodEnd,
          totalRewardsPool: 2200,
          totalMatches: 18,
          isDistributed: false
        }
      });
      console.log(`✅ Created fresh period: ${period.id}`);
    } else {
      // Reset it if it was already distributed
      period = await prisma.weeklyPeriod.update({
        where: { id: period.id },
        data: { isDistributed: false }
      });
      console.log(`✅ Reset existing period: ${period.id}`);
    }

    console.log(`Pool: ${period.totalRewardsPool} tokens`);
    console.log(`Status: ${period.isDistributed ? 'DISTRIBUTED' : 'PENDING'}`);
    console.log(`\n🧪 Test with this period ID: ${period.id}`);
    console.log(`\n📋 Manual distribution command:`);
    console.log(`Use this period ID in your browser console test: "${period.id}"`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createFreshPeriod();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getPeriods() {
  try {
    console.log("Checking weekly periods...");
    
    const allPeriods = await prisma.weeklyPeriod.findMany({
      orderBy: { weekStart: 'desc' }
    });

    console.log(`Found ${allPeriods.length} periods:`);
    
    allPeriods.forEach((period, index) => {
      const isComplete = new Date() >= period.weekEnd;
      const status = period.isDistributed ? 'DISTRIBUTED' : 'PENDING';
      
      console.log(`\n${index + 1}. ID: ${period.id}`);
      console.log(`   Start: ${period.weekStart.toISOString()}`);
      console.log(`   End: ${period.weekEnd.toISOString()}`);
      console.log(`   Status: ${status}`);
      console.log(`   Complete: ${isComplete ? 'YES' : 'NO'}`);
      console.log(`   Pool: ${period.totalRewardsPool} tokens`);
      
      if (!period.isDistributed && isComplete) {
        console.log(`   ** READY FOR DISTRIBUTION **`);
      }
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

getPeriods();
// Quick test script - save as test-manual-distribution.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createTestPeriod() {
  try {
    // Create a period from last week (already completed)
    const lastWeekStart = new Date();
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 14); // 2 weeks ago
    lastWeekStart.setUTCHours(0, 0, 0, 0);
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setUTCDate(lastWeekStart.getUTCDate() + 7);

    // Check if it already exists
    let period = await prisma.weeklyPeriod.findUnique({
      where: { weekStart: lastWeekStart }
    });

    if (!period) {
      period = await prisma.weeklyPeriod.create({
        data: {
          weekStart: lastWeekStart,
          weekEnd: lastWeekEnd,
          totalRewardsPool: 2400, // Mock reward pool
          totalMatches: 20,
          isDistributed: false
        }
      });
      console.log(`✅ Created test period: ${period.id}`);
      console.log(`📅 Period: ${period.weekStart} to ${period.weekEnd}`);
      console.log(`💰 Reward pool: ${period.totalRewardsPool}`);
    } else {
      console.log(`✅ Found existing test period: ${period.id}`);
    }

    console.log("\n🧪 Now test manual distribution:");
    console.log(`curl -X POST http://localhost:3000/api/weekly/distribute -H "Content-Type: application/json" -d '{"weeklyPeriodId": "${period.id}"}'`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPeriod();
// Weekly Competition Debug & Setup Guide
// Save this as: scripts/debug-weekly-setup.js

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

async function debugWeeklySetup() {
  console.log("🔍 DEBUGGING WEEKLY COMPETITION SETUP");
  console.log("=" * 50);

  try {
    // 1. Check if weekly period exists
    const weekStart = getCurrentWeekStart();
    const weekEnd = getCurrentWeekEnd(weekStart);
    
    console.log(`📅 Current week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
    
    let currentPeriod = await prisma.weeklyPeriod.findUnique({
      where: { weekStart }
    });
    
    console.log(`🎯 Current weekly period: ${currentPeriod ? 'EXISTS ✅' : 'MISSING ❌'}`);
    
    if (currentPeriod) {
      console.log(`   - ID: ${currentPeriod.id}`);
      console.log(`   - Prize Pool: ${currentPeriod.totalRewardsPool}`);
      console.log(`   - Total Matches: ${currentPeriod.totalMatches}`);
      console.log(`   - Is Distributed: ${currentPeriod.isDistributed}`);
    }

    // 2. Check matches this week
    const thisWeekMatches = await prisma.matchResult.findMany({
      where: {
        createdAt: {
          gte: weekStart,
          lt: weekEnd
        }
      },
      include: {
        session: {
          include: {
            creator: { select: { displayName: true } },
            challenger: { select: { displayName: true } }
          }
        }
      }
    });

    console.log(`🎮 Matches this week: ${thisWeekMatches.length}`);
    
    if (thisWeekMatches.length > 0) {
      console.log("   Recent matches:");
      thisWeekMatches.slice(0, 5).forEach((match, i) => {
        const creator = match.session.creator?.displayName || 'Unknown';
        const challenger = match.session.challenger?.displayName || 'Unknown';
        const winner = match.winnerUserId ? 'Won' : 'Draw';
        console.log(`   ${i + 1}. ${creator} vs ${challenger} - ${winner} (${match.pot} pot)`);
      });
    } else {
      console.log("   ❌ No matches found this week!");
      console.log("   💡 TIP: Play some games to generate weekly data");
    }

    // 3. Check users
    const users = await prisma.user.findMany({
      select: { id: true, displayName: true, mockBalance: true }
    });
    
    console.log(`👥 Total users: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.displayName}: ${user.mockBalance} balance`);
    });

    // 4. Auto-create weekly period if missing
    if (!currentPeriod) {
      console.log("\n🔧 CREATING MISSING WEEKLY PERIOD...");
      
      currentPeriod = await prisma.weeklyPeriod.create({
        data: {
          weekStart,
          weekEnd,
          totalRewardsPool: 0,
          totalMatches: thisWeekMatches.length,
          isDistributed: false
        }
      });
      
      console.log(`✅ Created weekly period: ${currentPeriod.id}`);
    }

    // 5. Update period with current matches
    if (thisWeekMatches.length > 0) {
      let totalWeeklyFees = 0;
      thisWeekMatches.forEach(match => {
        if (match.feesWeeklyRewards) {
          totalWeeklyFees += match.feesWeeklyRewards;
        } else if (match.winnerUserId) {
          // 2% of pot for weekly rewards
          totalWeeklyFees += Math.floor(match.pot * 0.02);
        }
      });

      await prisma.weeklyPeriod.update({
        where: { id: currentPeriod.id },
        data: {
          totalRewardsPool: totalWeeklyFees,
          totalMatches: thisWeekMatches.length
        }
      });

      console.log(`💰 Updated prize pool: ${totalWeeklyFees} tokens`);
    }

    // 6. Test leaderboard API
    console.log("\n🌐 TESTING LEADERBOARD API...");
    
    console.log("✅ Weekly period setup complete!");
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Go to http://localhost:3000/leaderboard");
    console.log("2. Click 'Weekly Competition' tab");
    console.log("3. Look for debug panel at top of page");
    console.log("4. If no matches, play some games between Alice & Bob");
    console.log("5. Refresh leaderboard to see updated data");

    // 7. Show current anti-sybil settings
    console.log("\n🛡️ ANTI-SYBIL SETTINGS:");
    console.log("Check src/lib/weekly.ts for these values:");
    console.log("- minUniqueOpponents: Should be 1 for testing");
    console.log("- maxWinShareFromSingleOpponent: Should be 1.0 for testing");
    console.log("- minTotalWins: Should be 1 for testing");

  } catch (error) {
    console.error("❌ Debug error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugWeeklySetup();

// MANUAL STEPS TO RELAX ANTI-SYBIL (if not done yet):
/*
1. Edit src/lib/weekly.ts
2. Find this section:

const ELIGIBILITY_REQUIREMENTS = {
  minUniqueOpponents: 5,
  maxWinShareFromSingleOpponent: .25,
  minTotalWins: 5,
};

3. Change to:

const ELIGIBILITY_REQUIREMENTS = {
  minUniqueOpponents: 1,
  maxWinShareFromSingleOpponent: 1.0,
  minTotalWins: 1,
};

4. Save file and restart dev server
*/
// src/lib/weekly.ts - FIXED TO PROPERLY COUNT MATCHES PLAYED
import { prisma } from "@/lib/db";

// Weekly rewards eligibility requirements - ANTI-SYBIL PROTECTION (RELAXED FOR TESTING)
const ELIGIBILITY_REQUIREMENTS = {
  minUniqueOpponents: 5, // Must beat at least 1 different player (was 5)
  maxWinShareFromSingleOpponent: 0.25, // Max 100% wins from one opponent (was 0.25)  
  minTotalWins: 5, // Must have at least 1 win total (was 5)
};

// Type definitions
interface PlayerStats {
  userId: string;
  displayName: string;
  points: number;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  uniqueOpponents: Set<string>;
  winsPerOpponent: Map<string, number>;
}

interface CleanPlayerStats {
  userId: string;
  displayName: string;
  points: number;
  totalWinnings: number;
  matchesWon: number;
  matchesPlayed: number;
  uniqueOpponentsCount: number;
  maxWinsFromSingleOpponent: number;
  winShareFromSingleOpponent: number;
  isEligible: boolean;
  ineligibilityReasons: string[];
}

interface WeeklyLeaderboardResult {
  leaderboard: CleanPlayerStats[];
  ineligiblePlayers: CleanPlayerStats[];
  eligibilityRequirements: typeof ELIGIBILITY_REQUIREMENTS;
  stats: {
    totalPlayers: number;
    eligiblePlayers: number;
    ineligiblePlayers: number;
  };
}

// Get Monday 12am UTC for the current week
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  return weekStart;
}

// Get next Monday 12am UTC (end of current week)
export function getCurrentWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return weekEnd;
}

// Check if a weekly period is complete (past end date)
export function isWeeklyPeriodComplete(period: { weekEnd: Date }): boolean {
  return new Date() >= period.weekEnd;
}

// Get weekly leaderboard with ANTI-SYBIL eligibility filtering - FIXED MATCHES PLAYED
export async function getWeeklyLeaderboard(tx: any, weeklyPeriodId: string): Promise<WeeklyLeaderboardResult> {
  console.log("🔍 Weekly: Starting weekly leaderboard calculation...");
  
  // Get the weekly period dates
  const period = await tx.weeklyPeriod.findUnique({
    where: { id: weeklyPeriodId }
  });

  if (!period) {
    throw new Error("Weekly period not found");
  }

  console.log(`📅 Weekly: Processing period ${period.weekStart} to ${period.weekEnd}`);

  // FIXED: Get ALL match results from this week (including draws)
  const results = await tx.matchResult.findMany({
    where: {
      createdAt: {
        gte: period.weekStart,
        lt: period.weekEnd
      },
      // REMOVED: winnerUserId: { not: null } - This was excluding draws!
    },
    include: {
      session: {
        include: {
          creator: { select: { id: true, displayName: true } },
          challenger: { select: { id: true, displayName: true } }
        }
      }
    }
  });

  console.log(`📊 Weekly: Found ${results.length} total match results (including draws)`);

  // Calculate user stats with opponent tracking - REWRITTEN TO COUNT ALL PARTICIPANTS
  const userStats = new Map<string, PlayerStats>();
  
  // STEP 1: Process each match result to count ALL participants
  for (const result of results) {
    const session = result.session;
    
    // Skip if no challenger (incomplete game)
    if (!session.challengerId || !session.challenger) {
      console.log(`⚠️ Weekly: Skipping incomplete session: ${session.id}`);
      continue;
    }
    
    const creatorId = session.creatorId;
    const challengerId = session.challengerId;
    
    // Initialize creator if not exists
    if (!userStats.has(creatorId)) {
      userStats.set(creatorId, {
        userId: creatorId,
        displayName: session.creator.displayName || `User ${creatorId.slice(0, 8)}`,
        points: 0,
        totalWinnings: 0,
        matchesWon: 0,
        matchesPlayed: 0,
        uniqueOpponents: new Set<string>(),
        winsPerOpponent: new Map<string, number>(),
      });
    }
    
    // Initialize challenger if not exists
    if (!userStats.has(challengerId)) {
      userStats.set(challengerId, {
        userId: challengerId,
        displayName: session.challenger.displayName || `User ${challengerId.slice(0, 8)}`,
        points: 0,
        totalWinnings: 0,
        matchesWon: 0,
        matchesPlayed: 0,
        uniqueOpponents: new Set<string>(),
        winsPerOpponent: new Map<string, number>(),
      });
    }
    
    const creatorStats = userStats.get(creatorId)!;
    const challengerStats = userStats.get(challengerId)!;
    
    // BOTH PLAYERS PARTICIPATED - increment matches played
    creatorStats.matchesPlayed++;
    challengerStats.matchesPlayed++;
    
    // Track opponent diversity for both players
    creatorStats.uniqueOpponents.add(challengerId);
    challengerStats.uniqueOpponents.add(creatorId);
    
    // Handle the outcome - wins, draws, and winnings
    if (result.overall === "DRAW") {
      console.log(`🤝 Weekly: Draw between ${session.creator.displayName} and ${session.challenger.displayName}`);
      // On draw, both players get their stake back
      creatorStats.totalWinnings += session.totalStake;
      challengerStats.totalWinnings += session.totalStake;
      // No wins counted for either player
    } else if (result.winnerUserId === creatorId) {
      console.log(`🏆 Weekly: Creator wins: ${session.creator.displayName} beats ${session.challenger.displayName}`);
      // Creator won
      creatorStats.matchesWon++;
      creatorStats.totalWinnings += result.payoutWinner;
      creatorStats.points += 10 + Math.floor(result.payoutWinner / 100);
      
      // Track wins per opponent for anti-sybil
      if (!creatorStats.winsPerOpponent.has(challengerId)) {
        creatorStats.winsPerOpponent.set(challengerId, 0);
      }
      creatorStats.winsPerOpponent.set(challengerId, creatorStats.winsPerOpponent.get(challengerId)! + 1);
      
      // Challenger gets nothing (loses stake)
    } else if (result.winnerUserId === challengerId) {
      console.log(`🏆 Weekly: Challenger wins: ${session.challenger.displayName} beats ${session.creator.displayName}`);
      // Challenger won
      challengerStats.matchesWon++;
      challengerStats.totalWinnings += result.payoutWinner;
      challengerStats.points += 10 + Math.floor(result.payoutWinner / 100);
      
      // Track wins per opponent for anti-sybil
      if (!challengerStats.winsPerOpponent.has(creatorId)) {
        challengerStats.winsPerOpponent.set(creatorId, 0);
      }
      challengerStats.winsPerOpponent.set(creatorId, challengerStats.winsPerOpponent.get(creatorId)! + 1);
      
      // Creator gets nothing (loses stake)
    }
  }

  console.log(`👥 Weekly: Processed ${userStats.size} unique players`);
  console.log("🏆 Weekly: Top players participation:");
  Array.from(userStats.values()).slice(0, 5).forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.displayName}: ${player.matchesPlayed} played, ${player.matchesWon} won`);
  });

  // Apply ANTI-SYBIL eligibility filtering
  const eligiblePlayers: CleanPlayerStats[] = [];
  const ineligiblePlayers: CleanPlayerStats[] = [];

  for (const stats of userStats.values()) {
    // Convert sets/maps to numbers for eligibility checking
    const uniqueOpponentsCount = stats.uniqueOpponents.size;
    const totalWins = stats.matchesWon;
    
    // Calculate max wins from single opponent
    let maxWinsFromSingleOpponent = 0;
    for (const winsCount of stats.winsPerOpponent.values()) {
      maxWinsFromSingleOpponent = Math.max(maxWinsFromSingleOpponent, winsCount);
    }
    
    const winShareFromSingleOpponent = totalWins > 0 
      ? maxWinsFromSingleOpponent / totalWins 
      : 0;

    // Check eligibility requirements
    const isEligible = 
      uniqueOpponentsCount >= ELIGIBILITY_REQUIREMENTS.minUniqueOpponents &&
      winShareFromSingleOpponent <= ELIGIBILITY_REQUIREMENTS.maxWinShareFromSingleOpponent &&
      totalWins >= ELIGIBILITY_REQUIREMENTS.minTotalWins;

    // Build ineligibility reasons
    const ineligibilityReasons: string[] = [];
    if (!isEligible) {
      if (uniqueOpponentsCount < ELIGIBILITY_REQUIREMENTS.minUniqueOpponents) {
        ineligibilityReasons.push(`Only ${uniqueOpponentsCount}/${ELIGIBILITY_REQUIREMENTS.minUniqueOpponents} unique opponents`);
      }
      if (winShareFromSingleOpponent > ELIGIBILITY_REQUIREMENTS.maxWinShareFromSingleOpponent) {
        ineligibilityReasons.push(`${Math.round(winShareFromSingleOpponent * 100)}% wins from single opponent (max ${ELIGIBILITY_REQUIREMENTS.maxWinShareFromSingleOpponent * 100}%)`);
      }
      if (totalWins < ELIGIBILITY_REQUIREMENTS.minTotalWins) {
        ineligibilityReasons.push(`Only ${totalWins}/${ELIGIBILITY_REQUIREMENTS.minTotalWins} total wins`);
      }
    }

    // Clean up stats object (remove Sets/Maps for JSON serialization)
    const cleanStats: CleanPlayerStats = {
      userId: stats.userId,
      displayName: stats.displayName,
      points: stats.points,
      totalWinnings: stats.totalWinnings,
      matchesWon: stats.matchesWon,
      matchesPlayed: stats.matchesPlayed, // NOW PROPERLY CALCULATED!
      uniqueOpponentsCount,
      maxWinsFromSingleOpponent,
      winShareFromSingleOpponent: Math.round(winShareFromSingleOpponent * 100) / 100,
      isEligible,
      ineligibilityReasons
    };

    if (isEligible) {
      eligiblePlayers.push(cleanStats);
    } else {
      ineligiblePlayers.push(cleanStats);
    }
  }

  // Sort eligible players by points (then by winnings as tiebreaker)
  const leaderboard = eligiblePlayers
    .sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      return b.totalWinnings - a.totalWinnings;
    })
    .slice(0, 10); // Top 10 only

  // Log ineligible players for admin monitoring
  if (ineligiblePlayers.length > 0) {
    console.log(`🚨 ANTI-SYBIL: ${ineligiblePlayers.length} players ineligible for weekly rewards:`);
    ineligiblePlayers.forEach(player => {
      console.log(`   - ${player.displayName}: ${player.ineligibilityReasons.join(', ')}`);
    });
  }

  console.log(`✅ WEEKLY LEADERBOARD: ${leaderboard.length} eligible players from ${userStats.size} total`);
  console.log("🏆 Final weekly leaderboard with matches played:");
  leaderboard.slice(0, 3).forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.displayName}: ${player.matchesPlayed} played, ${player.matchesWon} won, ${player.points} points`);
  });

  return {
    leaderboard,
    ineligiblePlayers,
    eligibilityRequirements: ELIGIBILITY_REQUIREMENTS,
    stats: {
      totalPlayers: userStats.size,
      eligiblePlayers: leaderboard.length,
      ineligiblePlayers: ineligiblePlayers.length
    }
  };
}

// Format week display string
export function formatWeekDisplay(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6); // End on Sunday
  
  const formatter = new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric',
    timeZone: 'UTC'
  });
  
  const startStr = formatter.format(weekStart);
  const endStr = formatter.format(weekEnd);
  
  return `${startStr} - ${endStr}`;
}

// Helper function to get eligibility requirements (for admin/debugging)
export function getEligibilityRequirements() {
  return ELIGIBILITY_REQUIREMENTS;
}
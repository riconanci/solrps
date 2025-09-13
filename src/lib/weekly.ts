// src/lib/weekly.ts - ENHANCED WITH ANTI-SYBIL ELIGIBILITY REQUIREMENTS
import { prisma } from "@/lib/db";

// Weekly rewards eligibility requirements - ANTI-SYBIL PROTECTION
const ELIGIBILITY_REQUIREMENTS = {
  minUniqueOpponents: 5, // Must beat at least 5 different players
  maxWinShareFromSingleOpponent: 0.25, // Max 25% of wins from one player  
  minTotalWins: 5, // Must have at least 5 wins total
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

// Get weekly leaderboard with ANTI-SYBIL eligibility filtering
export async function getWeeklyLeaderboard(tx: any, weeklyPeriodId: string): Promise<WeeklyLeaderboardResult> {
  // Get the weekly period dates
  const period = await tx.weeklyPeriod.findUnique({
    where: { id: weeklyPeriodId }
  });

  if (!period) {
    throw new Error("Weekly period not found");
  }

  // Get all match results from this week
  const results = await tx.matchResult.findMany({
    where: {
      createdAt: {
        gte: period.weekStart,
        lt: period.weekEnd
      },
      winnerUserId: { not: null }
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

  // Calculate user stats with opponent tracking
  const userStats = new Map<string, PlayerStats>();
  
  for (const result of results) {
    const winnerId = result.winnerUserId!;
    const session = result.session;
    
    // Determine the opponent (loser)
    const opponentId = session.creatorId === winnerId 
      ? session.challengerId 
      : session.creatorId;
    
    if (!opponentId) continue; // Skip if no opponent
    
    // Find winner's display name
    let winnerName = `User ${winnerId.slice(0, 8)}`;
    if (session.creator.id === winnerId) {
      winnerName = session.creator.displayName || winnerName;
    } else if (session.challenger?.id === winnerId) {
      winnerName = session.challenger.displayName || winnerName;
    }

    if (!userStats.has(winnerId)) {
      userStats.set(winnerId, {
        userId: winnerId,
        displayName: winnerName,
        points: 0,
        totalWinnings: 0,
        matchesWon: 0,
        matchesPlayed: 0,
        uniqueOpponents: new Set<string>(),
        winsPerOpponent: new Map<string, number>(),
      });
    }

    const stats = userStats.get(winnerId)!;
    stats.matchesWon++;
    stats.totalWinnings += result.payoutWinner;
    
    // Track opponent diversity
    stats.uniqueOpponents.add(opponentId);
    
    // Track wins per opponent
    if (!stats.winsPerOpponent.has(opponentId)) {
      stats.winsPerOpponent.set(opponentId, 0);
    }
    stats.winsPerOpponent.set(opponentId, stats.winsPerOpponent.get(opponentId)! + 1);
    
    // Points calculation: 10 per win + bonus for payout amount
    stats.points += 10 + Math.floor(result.payoutWinner / 100);
  }

  // Also count total matches played (including losses)
  for (const result of results) {
    const session = result.session;
    const participants = [session.creatorId, session.challengerId].filter(id => id);
    
    for (const participantId of participants) {
      if (!userStats.has(participantId)) {
        let name = `User ${participantId.slice(0, 8)}`;
        if (session.creator.id === participantId) {
          name = session.creator.displayName || name;
        } else if (session.challenger?.id === participantId) {
          name = session.challenger.displayName || name;
        }
        
        userStats.set(participantId, {
          userId: participantId,
          displayName: name,
          points: 0,
          totalWinnings: 0,
          matchesWon: 0,
          matchesPlayed: 0,
          uniqueOpponents: new Set<string>(),
          winsPerOpponent: new Map<string, number>(),
        });
      }
      
      userStats.get(participantId)!.matchesPlayed++;
    }
  }

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
      matchesPlayed: stats.matchesPlayed,
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
// src/lib/weekly.ts

// Get the start of the current week (Monday 12am UTC)
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days back to Monday
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0); // Set to midnight
  
  return weekStart;
}

// Get the end of the current week (next Monday 12am UTC)
export function getCurrentWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return weekEnd;
}

// Get or create the current weekly period
export async function getOrCreateCurrentWeeklyPeriod(prisma: any) {
  const weekStart = getCurrentWeekStart();
  const weekEnd = getCurrentWeekEnd(weekStart);
  
  // Try to find existing period
  let period = await prisma.weeklyPeriod.findUnique({
    where: { weekStart }
  });
  
  // Create if doesn't exist
  if (!period) {
    period = await prisma.weeklyPeriod.create({
      data: {
        weekStart,
        weekEnd,
        totalRewardsPool: 0,
        totalMatches: 0,
        isDistributed: false
      }
    });
  }
  
  return period;
}

// Check if a weekly period is ready for distribution (week has ended)
export function isWeeklyPeriodComplete(period: any): boolean {
  const now = new Date();
  return now >= period.weekEnd && !period.isDistributed;
}

// Get weekly leaderboard for a specific period
export async function getWeeklyLeaderboard(prisma: any, weeklyPeriodId: string) {
  const results = await prisma.matchResult.findMany({
    where: {
      createdAt: {
        gte: (await prisma.weeklyPeriod.findUnique({ 
          where: { id: weeklyPeriodId },
          select: { weekStart: true, weekEnd: true }
        }))?.weekStart,
        lt: (await prisma.weeklyPeriod.findUnique({ 
          where: { id: weeklyPeriodId },
          select: { weekEnd: true }
        }))?.weekEnd
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

  // Calculate weekly stats per user
  const userStats = new Map<string, {
    userId: string;
    displayName: string;
    points: number;
    totalWinnings: number;
    matchesWon: number;
    matchesPlayed: number;
  }>();

  for (const result of results) {
    const winnerId = result.winnerUserId!;
    const session = result.session;
    
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
        points: 0, // Weekly points calculation
        totalWinnings: 0,
        matchesWon: 0,
        matchesPlayed: 0
      });
    }

    const stats = userStats.get(winnerId)!;
    stats.matchesWon++;
    stats.totalWinnings += result.payoutWinner;
    
    // Points calculation (can be customized)
    // For now: 10 points per win + bonus for payout amount
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
          matchesPlayed: 0
        });
      }
      
      userStats.get(participantId)!.matchesPlayed++;
    }
  }

  // Convert to array and sort by points (then by winnings as tiebreaker)
  const leaderboard = Array.from(userStats.values())
    .sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      return b.totalWinnings - a.totalWinnings;
    })
    .slice(0, 10); // Top 10 only

  return leaderboard;
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
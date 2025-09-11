// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const timeframe = url.searchParams.get('timeframe') || 'all'; // 'week', 'month', 'all'
    
    // Calculate date filter
    let dateFilter: Date | undefined;
    const now = new Date();
    
    switch (timeframe) {
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = undefined;
    }

    // Get all match results with winners
    const matchResults = await prisma.matchResult.findMany({
      where: {
        winnerUserId: { not: null }, // Only matches with winners (exclude draws)
        ...(dateFilter && {
          createdAt: { gte: dateFilter }
        })
      },
      include: {
        winner: true,
        session: {
          include: {
            creator: true,
            challenger: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregate stats by user
    const userStats = new Map<string, {
      userId: string;
      displayName: string;
      totalWinnings: number;
      matchesWon: number;
      matchesPlayed: number;
      avgWinning: number;
    }>();

    // Process each match result
    for (const result of matchResults) {
      if (!result.winner) continue;

      const userId = result.winner.id;
      const displayName = result.winner.displayName || userId.slice(0, 6);
      
      // Get current stats or initialize
      const current = userStats.get(userId) || {
        userId,
        displayName,
        totalWinnings: 0,
        matchesWon: 0,
        matchesPlayed: 0,
        avgWinning: 0
      };

      // Update stats
      current.totalWinnings += result.payoutWinner;
      current.matchesWon += 1;
      
      userStats.set(userId, current);
    }

    // Also count matches played (including losses and draws)
    const allParticipations = await prisma.session.findMany({
      where: {
        status: { in: ["RESOLVED", "FORFEITED"] },
        ...(dateFilter && {
          createdAt: { gte: dateFilter }
        })
      },
      include: {
        creator: true,
        challenger: true
      }
    });

    // Count total matches played per user
    const playCountMap = new Map<string, number>();
    
    for (const session of allParticipations) {
      // Count for creator
      const creatorCount = playCountMap.get(session.creatorId) || 0;
      playCountMap.set(session.creatorId, creatorCount + 1);
      
      // Count for challenger if exists
      if (session.challengerId) {
        const challengerCount = playCountMap.get(session.challengerId) || 0;
        playCountMap.set(session.challengerId, challengerCount + 1);
      }
    }

    // Update matches played and calculate averages
    for (const [userId, stats] of userStats.entries()) {
      stats.matchesPlayed = playCountMap.get(userId) || stats.matchesWon;
      stats.avgWinning = stats.matchesWon > 0 ? stats.totalWinnings / stats.matchesWon : 0;
    }

    // Add users who played but never won
    for (const [userId, playCount] of playCountMap.entries()) {
      if (!userStats.has(userId)) {
        // Find user details
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          userStats.set(userId, {
            userId,
            displayName: user.displayName || userId.slice(0, 6),
            totalWinnings: 0,
            matchesWon: 0,
            matchesPlayed: playCount,
            avgWinning: 0
          });
        }
      }
    }

    // Convert to array and sort by total winnings
    const leaderboard = Array.from(userStats.values())
      .sort((a, b) => b.totalWinnings - a.totalWinnings)
      .map((stats, index) => ({
        rank: index + 1,
        ...stats,
        winRate: stats.matchesPlayed > 0 ? (stats.matchesWon / stats.matchesPlayed * 100).toFixed(1) : "0.0"
      }));

    return NextResponse.json({
      success: true,
      timeframe,
      leaderboard,
      totalPlayers: leaderboard.length,
      totalMatches: allParticipations.length
    });

  } catch (error: any) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
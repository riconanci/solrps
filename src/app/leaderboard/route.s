// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "all"; // "all", "week", "month"
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    // Get all match results with winners
    const results = await prisma.matchResult.findMany({
      where: {
        ...dateFilter,
        winnerUserId: { not: null }, // Only include games with winners (not draws)
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

    // Calculate stats per user
    const userStats = new Map();

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
          totalWins: 0,
          totalEarnings: 0,
          gamesWon: 0,
          gamesLost: 0,
          totalStaked: 0,
        });
      }

      const stats = userStats.get(winnerId);
      stats.totalWins++;
      stats.totalEarnings += result.payoutWinner;
      stats.gamesWon++;
    }

    // Also count losses for players who participated but didn't win
    for (const result of results) {
      const session = result.session;
      const loserId = session.creatorId === result.winnerUserId 
        ? session.challengerId 
        : session.creatorId;

      if (loserId) {
        let loserName = `User ${loserId.slice(0, 8)}`;
        if (session.creator.id === loserId) {
          loserName = session.creator.displayName || loserName;
        } else if (session.challenger?.id === loserId) {
          loserName = session.challenger.displayName || loserName;
        }

        if (!userStats.has(loserId)) {
          userStats.set(loserId, {
            userId: loserId,
            displayName: loserName,
            totalWins: 0,
            totalEarnings: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalStaked: 0,
          });
        }

        const stats = userStats.get(loserId);
        stats.gamesLost++;
        stats.totalStaked += session.totalStake; // They lost their stake
      }
    }

    // Convert to array and calculate additional metrics
    const leaderboard = Array.from(userStats.values()).map(stats => {
      const totalGames = stats.gamesWon + stats.gamesLost;
      const winRate = totalGames > 0 ? (stats.gamesWon / totalGames) * 100 : 0;
      const netProfit = stats.totalEarnings - stats.totalStaked;
      
      return {
        ...stats,
        totalGames,
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
        netProfit,
      };
    });

    // Sort by net profit descending
    leaderboard.sort((a, b) => b.netProfit - a.netProfit);

    return NextResponse.json({
      period,
      leaderboard: leaderboard.slice(0, 50), // Top 50
      generatedAt: now.toISOString(),
    });

  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
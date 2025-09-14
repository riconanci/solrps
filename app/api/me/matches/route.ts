// app/api/me/matches/route.ts
// ONLY API route code - limit to 9 most recent matches + auto cleanup

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { getUserOrSeed } from "../../_utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json({ 
        error: "userId parameter required" 
      }, { status: 400 });
    }

    const me = await getUserOrSeed(req);
    
    // Get only the 9 most recent sessions for this user + auto cleanup in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // First get all sessions for this user to identify old ones
      const allUserSessions = await tx.session.findMany({
        where: {
          OR: [
            { creatorId: me.id },
            { challengerId: me.id }
          ],
          status: {
            in: ['RESOLVED', 'AWAITING_REVEAL', 'FORFEITED', 'CANCELLED']
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: { id: true }
      });

      // If user has more than 9 sessions, delete the old ones beyond 9 most recent
      if (allUserSessions.length > 9) {
        const sessionsToDelete = allUserSessions.slice(9); // Keep first 9, delete rest
        const sessionIdsToDelete = sessionsToDelete.map((session: { id: string }) => session.id);
        
        console.log(`🧹 Auto-cleanup: Removing ${sessionIdsToDelete.length} old sessions for ${me.displayName}`);
        
        // Delete old match results first (foreign key constraint)
        await tx.matchResult.deleteMany({
          where: {
            sessionId: { in: sessionIdsToDelete }
          }
        });
        
        // Then delete old sessions
        await tx.session.deleteMany({
          where: {
            id: { in: sessionIdsToDelete }
          }
        });
      }

      // Now get the 9 most recent sessions with full data
      const sessions = await tx.session.findMany({
        where: {
          OR: [
            { creatorId: me.id },
            { challengerId: me.id }
          ],
          status: {
            in: ['RESOLVED', 'AWAITING_REVEAL', 'FORFEITED', 'CANCELLED']
          }
        },
        include: {
          creator: {
            select: { id: true, displayName: true }
          },
          challenger: {
            select: { id: true, displayName: true }
          },
          result: true
        },
        orderBy: {
          createdAt: 'desc'  // Most recent first
        },
        take: 9  // LIMIT TO 9 MOST RECENT MATCHES
      });

      return sessions;
    });

    console.log(`📊 Found ${result.length} recent matches for ${me.displayName} (after cleanup)`);

    // Transform sessions to match data format
    const matches = result.map((session: any) => {
      const isCreator = session.creatorId === me.id;
      const opponent = isCreator ? session.challenger : session.creator;
      
      // Parse moves if they exist (handle both string and array formats)
      let creatorMoves: string[] = [];
      let challengerMoves: string[] = [];
      let roundsOutcome: any[] = [];

      try {
        if (session.creatorMoves) {
          creatorMoves = typeof session.creatorMoves === 'string' 
            ? JSON.parse(session.creatorMoves) 
            : session.creatorMoves;
        }
        if (session.challengerMoves) {
          challengerMoves = typeof session.challengerMoves === 'string'
            ? JSON.parse(session.challengerMoves)
            : session.challengerMoves;
        }
        if (session.result?.roundsOutcome) {
          roundsOutcome = typeof session.result.roundsOutcome === 'string'
            ? JSON.parse(session.result.roundsOutcome)
            : session.result.roundsOutcome;
        }
      } catch (e) {
        console.error("Error parsing JSON fields:", e);
      }

      return {
        id: session.id,
        createdAt: session.createdAt,
        status: session.status,
        rounds: session.rounds,
        stakePerRound: session.stakePerRound,
        totalStake: session.totalStake,
        joinType: session.joinType || 'PUBLIC', // Include join type for display
        
        // Player info
        isCreator,
        myRole: isCreator ? "creator" : "challenger",
        opponent: opponent ? {
          id: opponent.id,
          displayName: opponent.displayName || opponent.id.slice(0, 6)
        } : null,
        
        // Moves (only show if revealed)
        myMoves: isCreator ? creatorMoves : challengerMoves,
        opponentMoves: isCreator ? challengerMoves : creatorMoves,
        
        // Results
        result: session.result ? {
          id: session.result.id,
          createdAt: session.result.createdAt,
          roundsOutcome,
          creatorWins: session.result.creatorWins,
          challengerWins: session.result.challengerWins,
          draws: session.result.draws,
          overall: session.result.overall,
          pot: session.result.pot,
          feesTreasury: session.result.feesTreasury,
          feesBurn: session.result.feesBurn,
          feesWeeklyRewards: session.result.feesWeeklyRewards,
          payoutWinner: session.result.payoutWinner,
          
          // Calculated fields for easier display
          didIWin: session.result.winnerUserId === me.id,
          isDraw: session.result.overall === "DRAW",
          myWins: isCreator ? session.result.creatorWins : session.result.challengerWins,
          opponentWins: isCreator ? session.result.challengerWins : session.result.creatorWins,
        } : null
      };
    });

    return NextResponse.json({ 
      success: true,
      matches,
      totalShown: matches.length,
      isLimited: matches.length === 9
    });

  } catch (error: any) {
    console.error("Get matches error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
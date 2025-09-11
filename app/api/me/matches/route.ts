// app/api/me/matches/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";

// Type for the session with includes
type SessionWithRelations = {
  id: string;
  createdAt: Date;
  status: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  creatorId: string;
  challengerId: string | null;
  creatorMoves: string | null;
  challengerMoves: string | null;
  creator: {
    id: string;
    displayName: string | null;
  };
  challenger: {
    id: string;
    displayName: string | null;
  } | null;
  result: {
    id: string;
    createdAt: Date;
    roundsOutcome: string;
    creatorWins: number;
    challengerWins: number;
    draws: number;
    overall: string;
    pot: number;
    feesTreasury: number;
    feesBurn: number;
    payoutWinner: number;
    winnerUserId: string | null;
  } | null;
};

export async function GET() {
  try {
    const me = await getUserOrSeed();
    
    // Get all sessions where user was creator or challenger and that have results
    const sessions = await prisma.session.findMany({
      where: {
        OR: [
          { creatorId: me.id },
          { challengerId: me.id }
        ],
        status: { in: ["RESOLVED", "FORFEITED"] }
      },
      orderBy: { createdAt: "desc" },
      include: { 
        creator: true,
        challenger: true,
        result: true
      },
    }) as SessionWithRelations[];

    // Transform the data for easier consumption on frontend
    const matches = sessions.map((session: SessionWithRelations) => {
      const isCreator = session.creatorId === me.id;
      const opponent = isCreator ? session.challenger : session.creator;
      
      // Parse stringified JSON fields safely
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
      matches 
    });

  } catch (error: any) {
    console.error("Get matches error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
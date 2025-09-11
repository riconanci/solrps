// src/app/api/me/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Get all sessions where user was creator or challenger
    const sessions = await prisma.session.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { challengerId: userId },
        ],
      },
      include: {
        creator: { 
          select: { id: true, displayName: true } 
        },
        challenger: { 
          select: { id: true, displayName: true } 
        },
        result: {
          include: {
            winner: {
              select: { id: true, displayName: true }
            }
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform sessions to include user perspective
    const matches = sessions.map((session: any) => {
      const isCreator = session.creatorId === userId;
      const opponent = isCreator ? session.challenger : session.creator;
      
      return {
        id: session.id,
        createdAt: session.createdAt,
        status: session.status,
        rounds: session.rounds,
        stakePerRound: session.stakePerRound,
        totalStake: session.totalStake,
        isCreator,
        opponent: opponent ? {
          id: opponent.id,
          displayName: opponent.displayName || `User ${opponent.id.slice(0, 8)}`,
        } : null,
        revealDeadline: session.revealDeadline,
        creatorRevealed: session.creatorRevealed,
        result: session.result ? {
          id: session.result.id,
          createdAt: session.result.createdAt,
          roundsOutcome: session.result.roundsOutcome,
          creatorWins: session.result.creatorWins,
          challengerWins: session.result.challengerWins,
          draws: session.result.draws,
          overall: session.result.overall,
          pot: session.result.pot,
          payoutWinner: session.result.payoutWinner,
          // Add user-specific result info
          userWon: session.result.winnerUserId === userId,
          userPayout: session.result.overall === "DRAW" 
            ? session.totalStake // refund on draw
            : session.result.winnerUserId === userId 
              ? session.result.payoutWinner // winner gets payout (net gain)
              : -session.totalStake, // loser loses their stake
        } : null,
      };
    });

    return NextResponse.json({ matches });

  } catch (error) {
    console.error("Get matches error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
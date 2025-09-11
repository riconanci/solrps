// app/api/session/reveal/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revealSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import type { Move } from "@/lib/hash";

// Mock auth function - replace with real auth later
async function getUserOrSeed() {
  const user = await prisma.user.findUnique({ 
    where: { id: "seed_alice" } 
  });
  
  if (!user) {
    throw new Error("Seed user missing. Run: npm run db:seed");
  }
  
  return user;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = revealSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid request data",
        details: parsed.error.flatten() 
      }, { status: 400 });
    }
    
    const { sessionId, moves, salt } = parsed.data;
    const user = await getUserOrSeed();

    const result = await prisma.$transaction(async (tx: any) => {
      // Get session with all relations
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { 
          creator: true, 
          challenger: true,
          result: true
        }
      });

      if (!session) {
        throw new Error("Session not found");
      }
      
      if (session.status !== "AWAITING_REVEAL") {
        throw new Error("Session is not awaiting reveal");
      }
      
      if (session.creatorId !== user.id) {
        throw new Error("Only the session creator can reveal moves");
      }
      
      if (!session.challengerId || !session.challengerMoves) {
        throw new Error("No challenger or challenger moves found");
      }

      // Check if reveal deadline has passed
      if (new Date() > session.revealDeadline) {
        throw new Error("Reveal deadline has passed");
      }

      // Verify commit hash
      const isValidCommit = verifyCommit(session.commitHash, moves as Move[], salt);
      if (!isValidCommit) {
        throw new Error("Invalid commit hash - moves and salt don't match the original commitment");
      }

      // Parse challenger moves (from stringified JSON)
      let challengerMoves: Move[];
      try {
        challengerMoves = typeof session.challengerMoves === 'string' 
          ? JSON.parse(session.challengerMoves)
          : session.challengerMoves;
      } catch (e) {
        throw new Error("Invalid challenger moves format in database");
      }

      // Validate move arrays have correct length
      if (moves.length !== session.rounds || challengerMoves.length !== session.rounds) {
        throw new Error("Move count doesn't match session rounds");
      }

      // Judge all rounds and calculate outcome
      const { outcomes, aWins, bWins, draws, overall } = tallyOutcome(moves as Move[], challengerMoves);
      
      // Calculate pot and payouts
      const pot = calcPot(session.rounds, session.stakePerRound);
      let feesTreasury = 0;
      let feesBurn = 0;
      let payoutWinner = 0;
      let winnerUserId: string | undefined;

      if (overall === "DRAW") {
        // Draw: refund both players, no fees
        await tx.user.update({
          where: { id: session.creatorId },
          data: { mockBalance: { increment: session.totalStake } }
        });
        await tx.user.update({
          where: { id: session.challengerId },
          data: { mockBalance: { increment: session.totalStake } }
        });
      } else {
        // Someone won: calculate fees and payout
        const payout = payoutFromPot(pot);
        feesTreasury = payout.feesTreasury;
        feesBurn = payout.feesBurn;
        payoutWinner = payout.payoutWinner;
        
        if (overall === "CREATOR") {
          winnerUserId = session.creatorId;
          // Creator gets back their stake + winnings from the pot
          await tx.user.update({
            where: { id: session.creatorId },
            data: { mockBalance: { increment: session.totalStake + payoutWinner - session.totalStake } }
          });
        } else {
          // CHALLENGER won
          winnerUserId = session.challengerId;
          // Challenger gets the payout (pot minus fees)
          await tx.user.update({
            where: { id: session.challengerId },
            data: { mockBalance: { increment: payoutWinner } }
          });
        }
      }

      // Update session with creator moves and mark as resolved
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          creatorMoves: JSON.stringify(moves), // Store as stringified JSON for SQLite
          creatorRevealed: true,
        }
      });

      // Create match result (SQLite-friendly with stringified JSON)
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: JSON.stringify(outcomes), // Stringified JSON for SQLite
          creatorWins: aWins,
          challengerWins: bWins,
          draws,
          overall, // String enum
          pot,
          feesTreasury,
          feesBurn,
          payoutWinner,
          winnerUserId,
          replaySeed: null,
        }
      });

      return {
        session: {
          ...session,
          creatorMoves: JSON.stringify(moves),
          status: "RESOLVED"
        },
        matchResult,
        outcomes,
        overall,
        pot,
        payoutWinner,
        feesTreasury,
        feesBurn,
        isDraw: overall === "DRAW"
      };
    });

    return NextResponse.json({
      success: true,
      message: "Moves revealed and match resolved successfully",
      data: {
        sessionId: result.session.id,
        status: result.session.status,
        matchResult: {
          id: result.matchResult.id,
          overall: result.overall,
          creatorWins: result.matchResult.creatorWins,
          challengerWins: result.matchResult.challengerWins,
          draws: result.matchResult.draws,
          pot: result.pot,
          payoutWinner: result.payoutWinner,
          feesTreasury: result.feesTreasury,
          feesBurn: result.feesBurn,
          isDraw: result.isDraw
        },
        outcomes: result.outcomes
      }
    });

  } catch (error) {
    console.error("Reveal error:", error);
    
    // Handle different types of errors with appropriate status codes
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("not found") ? 404 :
                      errorMessage.includes("deadline") || 
                      errorMessage.includes("Only") || 
                      errorMessage.includes("Invalid") ? 400 : 500;
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: statusCode });
  }
}
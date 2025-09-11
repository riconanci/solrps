// app/api/session/reveal/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revealSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import { getUserOrSeed } from "../../_utils";
import type { Move } from "@/lib/hash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = revealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    const { sessionId, moves, salt } = parsed.data;
    const user = await getUserOrSeed();

    const result = await prisma.$transaction(async (tx: any) => {
      // Get session with all relations
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { creator: true, challenger: true }
      });

      if (!session) throw new Error("Session not found");
      if (session.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
      if (session.creatorId !== user.id) throw new Error("Only creator can reveal");
      if (!session.challengerId || !session.challengerMoves) throw new Error("No challenger");

      // Check deadline
      if (new Date() > session.revealDeadline) {
        throw new Error("Reveal deadline passed");
      }

      // Verify commit hash
      const isValidCommit = verifyCommit(session.commitHash, moves as Move[], salt);
      if (!isValidCommit) {
        throw new Error("Commit hash verification failed");
      }

      // Parse challenger moves (from stringified JSON)
      let challengerMoves: Move[];
      try {
        challengerMoves = typeof session.challengerMoves === 'string' 
          ? JSON.parse(session.challengerMoves)
          : session.challengerMoves;
      } catch (e) {
        throw new Error("Invalid challenger moves format");
      }

      // Judge all rounds
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
          // Creator gets back their stake + winnings from challenger's stake
          await tx.user.update({
            where: { id: session.creatorId },
            data: { mockBalance: { increment: session.totalStake + payoutWinner - session.totalStake } }
          });
        } else {
          // CHALLENGER won
          winnerUserId = session.challengerId;
          // Challenger gets both stakes minus fees
          await tx.user.update({
            where: { id: session.challengerId },
            data: { mockBalance: { increment: payoutWinner } }
          });
        }
      }

      // Update session with creator moves and mark as revealed
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
        feesBurn
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: "Reveal successful"
    });

  } catch (error: any) {
    console.error("Reveal error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
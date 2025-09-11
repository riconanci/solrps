// app/api/session/reveal/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revealSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import { getUserOrSeed } from "../_utils";
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

      // Verify commit hash (reconstruct with pipe separator like in hash.ts)
      const reconstructedHash = await verifyCommit(session.commitHash, moves as Move[], salt);
      if (!reconstructedHash) {
        throw new Error("Commit hash verification failed");
      }

      // Judge all rounds
      const challengerMoves = session.challengerMoves as Move[];
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
          // Creator gets back their stake + winnings
          await tx.user.update({
            where: { id: session.creatorId },
            data: { mockBalance: { increment: session.totalStake + payoutWinner - session.totalStake } }
          });
        } else {
          // CHALLENGER won
          winnerUserId = session.challengerId;
          // Challenger gets back their stake + winnings
          await tx.user.update({
            where: { id: session.challengerId },
            data: { mockBalance: { increment: session.totalStake + payoutWinner - session.totalStake } }
          });
        }
      }

      // Update session to RESOLVED
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          creatorRevealed: true,
          creatorMoves: moves, // Store as JSON
        }
      });

      // Create match result
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: outcomes, // Store as JSON
          creatorWins: aWins,
          challengerWins: bWins,
          draws,
          overall: overall as "CREATOR" | "CHALLENGER" | "DRAW",
          pot,
          feesTreasury,
          feesBurn,
          payoutWinner,
          winnerUserId,
          replaySeed: Math.random().toString(36).substring(2, 15), // Random seed for replay
        }
      });

      return { matchResult, outcomes };
    });

    return NextResponse.json({
      success: true,
      result: result.matchResult,
      outcomes: result.outcomes
    });

  } catch (error: any) {
    console.error("Reveal error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
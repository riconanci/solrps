// app/api/session/join/route.ts
import { NextResponse } from "next/server";
import { joinSessionSchema } from "@/lib/zod";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";
import { calcPot, payoutFromPot } from "@/lib/payout";
import { tallyOutcome } from "@/lib/rps";
import type { Move } from "@/lib/hash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = joinSessionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sessionId, challengerMoves } = parsed.data;
    const user = await getUserOrSeed();

    const result = await prisma.$transaction(async (tx: any) => {
      // Get session and validate
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { creator: true }
      });

      if (!session) {
        throw new Error("Session not found");
      }

      if (session.status !== "OPEN") {
        throw new Error("Session is not open for joining");
      }

      if (session.creatorId === user.id) {
        throw new Error("Cannot join your own session");
      }

      // Check challenger has sufficient balance
      if (user.mockBalance < session.totalStake) {
        throw new Error("Insufficient balance");
      }

      // Debit challenger's balance
      await tx.user.update({ 
        where: { id: user.id }, 
        data: { mockBalance: { decrement: session.totalStake } } 
      });

      // AUTO-RESOLVE THE GAME IMMEDIATELY
      // TEMPORARY: Generate random moves for creator (replace with actual reveal logic)
      const creatorMoves: Move[] = Array(session.rounds).fill(null).map(() => {
        const moves: Move[] = ["R", "P", "S"];
        return moves[Math.floor(Math.random() * 3)];
      });

      // Judge all rounds
      const { outcomes, aWins, bWins, draws, overall } = tallyOutcome(creatorMoves, challengerMoves);
      
      // Calculate pot and payouts with NEW FEE STRUCTURE
      const pot = calcPot(session.rounds, session.stakePerRound);
      let feesBurn = 0;
      let feesTreasury = 0;
      let payoutWinner = 0;
      let winnerUserId: string | undefined;

      if (overall === "DRAW") {
        // Draw: refund both players, no fees
        await tx.user.update({
          where: { id: session.creatorId },
          data: { mockBalance: { increment: session.totalStake } }
        });
        await tx.user.update({
          where: { id: user.id },
          data: { mockBalance: { increment: session.totalStake } }
        });
        payoutWinner = session.totalStake; // Each player gets their stake back
      } else {
        // Someone won: calculate fees and payout
        const payout = payoutFromPot(pot);
        feesBurn = payout.feesBurn;
        feesTreasury = payout.feesTreasury; 
        payoutWinner = payout.payoutWinner;
        
        if (overall === "CREATOR") {
          winnerUserId = session.creatorId;
          await tx.user.update({
            where: { id: session.creatorId },
            data: { mockBalance: { increment: payoutWinner } }
          });
        } else {
          winnerUserId = user.id;
          await tx.user.update({
            where: { id: user.id },
            data: { mockBalance: { increment: payoutWinner } }
          });
        }

        // Log new fee structure (until schema is updated)
        console.log(`🎮 New fee structure applied:
        - Burn: ${payout.feesBurn} (2%)
        - Treasury: ${payout.feesTreasury} (2%) 
        - Dev: ${payout.feesDev} (1%)
        - Weekly Rewards: ${payout.feesWeeklyRewards} (2%)`);
      }

      // Update session to resolved
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          challengerId: user.id,
          challengerMoves: challengerMoves,
          creatorMoves: creatorMoves,
        },
      });

      // Create match result (using existing schema fields)
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: outcomes,
          creatorWins: aWins,
          challengerWins: bWins,
          draws,
          overall,
          pot,
          feesBurn,
          feesTreasury, // Contains all treasury-related fees for now
          payoutWinner,
          winnerUserId,
          replaySeed: null,
        }
      });

      return {
        session: updatedSession,
        matchResult,
        outcomes,
        creatorMoves,
        challengerMoves,
        isChallenger: true
      };
    });

    // Determine result for challenger
    const didWin = result.matchResult.overall === "CHALLENGER";
    const isDraw = result.matchResult.overall === "DRAW";
    const balanceChange = didWin ? result.matchResult.payoutWinner - result.session.totalStake :
                         isDraw ? 0 : -result.session.totalStake;

    return NextResponse.json({
      success: true,
      session: result.session,
      matchResult: result.matchResult,
      outcomes: result.outcomes,
      creatorMoves: result.creatorMoves,
      challengerMoves: result.challengerMoves,
      didWin,
      isDraw,
      balanceChange,
      message: isDraw ? "It's a draw! Stakes refunded." : 
               didWin ? `You won ${result.matchResult.payoutWinner} tokens!` :
               `You lost ${result.session.totalStake} tokens.`
    });

  } catch (error: any) {
    console.error("Join session error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to join session" 
    }, { status: 500 });
  }
}
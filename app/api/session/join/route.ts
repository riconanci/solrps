// app/api/session/join/route.ts - COMPLETE REWRITE
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
      return NextResponse.json({ 
        success: false,
        error: "Invalid request data", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { sessionId, challengerMoves } = parsed.data;
    
    // Get current user - pass request for proper user detection
    const user = await getUserOrSeed(req);
    console.log(`🎮 Join API: User ${user.displayName} (${user.id}) joining session ${sessionId}`);

    const result = await prisma.$transaction(async (tx: any) => {
      // Get session and validate
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { 
          creator: true,
          result: true
        }
      });

      if (!session) {
        throw new Error("Session not found");
      }

      console.log(`🎮 Session status: ${session.status}, Creator: ${session.creator.displayName} (${session.creatorId})`);

      if (session.status !== "OPEN") {
        throw new Error("Session is not open for joining");
      }

      if (session.creatorId === user.id) {
        throw new Error("Cannot join your own session");
      }

      // Check challenger has sufficient balance
      if (user.mockBalance < session.totalStake) {
        throw new Error(`Insufficient balance. Need ${session.totalStake}, have ${user.mockBalance}`);
      }

      // Validate challenger moves match session rounds
      if (challengerMoves.length !== session.rounds) {
        throw new Error(`Move count mismatch. Expected ${session.rounds} moves, got ${challengerMoves.length}`);
      }

      console.log(`✅ ${user.displayName} joining ${session.creator.displayName}'s game`);

      // Debit challenger's balance
      await tx.user.update({ 
        where: { id: user.id }, 
        data: { mockBalance: { decrement: session.totalStake } } 
      });

      // Parse creator moves from commit hash (for now, generate random moves as a placeholder)
      // TODO: Replace with actual creator moves from commit-reveal when implementing Phase 2
      const creatorMoves: Move[] = Array(session.rounds).fill(null).map(() => {
        const moves: Move[] = ["R", "P", "S"];
        return moves[Math.floor(Math.random() * 3)];
      });

      console.log(`🎮 Creator moves: ${creatorMoves.join(",")}, Challenger moves: ${challengerMoves.join(",")}`);

      // AUTO-RESOLVE THE GAME IMMEDIATELY
      const gameResult = tallyOutcome(creatorMoves, challengerMoves);
      const { outcomes, aWins, bWins, draws, overall } = gameResult;

      console.log(`🎮 Game result: Creator ${aWins} - ${bWins} Challenger, Overall: ${overall}`);

      // Calculate pot and payouts
      const pot = session.totalStake * 2;
      let winnerUserId: string | null = null;
      let payoutWinner = 0;
      let feesBurn = 0;
      let feesTreasury = 0;
      let feesDev = 0;
      let feesWeeklyRewards = 0;

      if (overall === "DRAW") {
        // Draw: refund both players, no fees
        console.log(`🤝 Draw - refunding both players ${session.totalStake} tokens`);
        
        await tx.user.update({
          where: { id: session.creatorId },
          data: { mockBalance: { increment: session.totalStake } }
        });
        await tx.user.update({
          where: { id: user.id },
          data: { mockBalance: { increment: session.totalStake } }
        });
        
        payoutWinner = 0; // No winner payout on draw
      } else {
        // Someone won: calculate fees and payout
        const payout = payoutFromPot(pot);
        feesBurn = payout.feesBurn;
        feesTreasury = payout.feesTreasury;
        feesDev = payout.feesDev;
        feesWeeklyRewards = payout.feesWeeklyRewards;
        payoutWinner = payout.payoutWinner;
        
        if (overall === "CREATOR") {
          winnerUserId = session.creatorId;
          console.log(`🎉 Creator won! Payout: ${payoutWinner} tokens`);
          await tx.user.update({
            where: { id: session.creatorId },
            data: { mockBalance: { increment: payoutWinner } }
          });
        } else {
          winnerUserId = user.id;
          console.log(`🎉 Challenger won! Payout: ${payoutWinner} tokens`);
          await tx.user.update({
            where: { id: user.id },
            data: { mockBalance: { increment: payoutWinner } }
          });
        }
      }

      // Update session to resolved
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          challengerId: user.id,
          challengerMoves: JSON.stringify(challengerMoves),
          creatorMoves: JSON.stringify(creatorMoves),
        },
      });

      // Create match result with proper fee tracking
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: JSON.stringify(outcomes),
          creatorWins: aWins,
          challengerWins: bWins,
          draws,
          overall,
          pot,
          feesBurn,
          feesTreasury,
          feesDev,
          feesWeeklyRewards,
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

    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({ 
      where: { id: user.id } 
    });

    // Determine result for challenger's perspective
    const didWin = result.matchResult.overall === "CHALLENGER";
    const isDraw = result.matchResult.overall === "DRAW";
    const balanceChange = isDraw ? 0 : (didWin ? result.matchResult.payoutWinner - result.session.totalStake : -result.session.totalStake);

    console.log(`🎮 Final result for ${user.displayName}: ${didWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}, Balance change: ${balanceChange}`);

    return NextResponse.json({
      success: true,
      didWin,
      isDraw,
      balanceChange,
      newBalance: updatedUser?.mockBalance || 0,
      creatorMoves: result.creatorMoves,
      challengerMoves: result.challengerMoves,
      matchResult: {
        creatorWins: result.matchResult.creatorWins,
        challengerWins: result.matchResult.challengerWins,
        draws: result.matchResult.draws,
        pot: result.matchResult.pot,
      },
      message: isDraw 
        ? "It's a draw! Stakes refunded." 
        : didWin 
          ? `You won ${result.matchResult.payoutWinner} tokens!` 
          : `You lost ${result.session.totalStake} tokens.`
    });

  } catch (error: any) {
    console.error("❌ Join session error:", error);
    return NextResponse.json({ 
      success: false,
      error: error.message || "Failed to join session" 
    }, { status: 500 });
  }
}
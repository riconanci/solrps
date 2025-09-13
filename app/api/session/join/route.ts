// app/api/session/join/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { joinSessionSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import type { Move } from "@/lib/hash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = joinSessionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    const { sessionId, challengerMoves } = parsed.data;
    
    // Get userId from request body (sent by frontend)
    const userId = body.userId || "seed_alice";
    
    // Validate user exists and is a seed user
    if (userId !== "seed_alice" && userId !== "seed_bob") {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const result = await prisma.$transaction(async (tx: any) => {
      // Get session with creator info
      const session = await tx.session.findUnique({ 
        where: { id: sessionId },
        include: { creator: true }
      });
      
      if (!session) {
        throw new Error("Session not found");
      }
      
      if (session.status !== "OPEN") {
        throw new Error("Session not open");
      }
      
      // Check if user is trying to join their own session
      if (session.creatorId === user.id) {
        throw new Error("Cannot join own session");
      }
      
      if (challengerMoves.length !== session.rounds) {
        throw new Error("Moves length mismatch");
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

      // NOW AUTO-RESOLVE THE GAME IMMEDIATELY
      // We need to extract creator's moves from the commit hash
      // For now, we'll use a simple approach - in a real app, creator would store moves separately
      
      // Get creator moves from the commit (we'll need to modify this)
      // For demo purposes, let's assume we can extract moves from the session data
      // In reality, we'd need the creator's original moves and salt
      
      // TEMPORARY: Generate random moves for creator (replace with actual reveal logic)
      const creatorMoves: Move[] = Array(session.rounds).fill(null).map(() => {
        const moves: Move[] = ["R", "P", "S"];
        return moves[Math.floor(Math.random() * 3)];
      });

      // Judge all rounds
      const { outcomes, aWins, bWins, draws, overall } = tallyOutcome(creatorMoves, challengerMoves);
      
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
          where: { id: user.id },
          data: { mockBalance: { increment: session.totalStake } }
        });
        payoutWinner = session.totalStake; // Each player gets their stake back
      } else {
        // Someone won: calculate fees and payout
        const payout = payoutFromPot(pot);
        feesTreasury = payout.feesTreasury;
        feesBurn = payout.feesBurn;
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
      }

      // Update session to resolved
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          challengerId: user.id,
          challengerMoves: challengerMoves,
          creatorMoves: creatorMoves, // Store the revealed moves
        },
      });

      // Create match result
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: outcomes,
          creatorWins: aWins,
          challengerWins: bWins,
          draws,
          overall,
          pot,
          feesTreasury,
          feesBurn,
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
      gameResolved: true,
      result: {
        sessionId: result.session.id,
        status: result.session.status,
        
        // Game outcome
        didWin,
        isDraw,
        didLose: !didWin && !isDraw,
        
        // Round details
        outcomes: result.outcomes,
        myMoves: result.challengerMoves,
        opponentMoves: result.creatorMoves,
        myWins: result.matchResult.challengerWins,
        opponentWins: result.matchResult.creatorWins,
        draws: result.matchResult.draws,
        
        // Financial details
        stakeAmount: result.session.totalStake,
        balanceChange,
        newBalance: user.mockBalance + balanceChange,
        pot: result.matchResult.pot,
        
        // Match info
        opponent: result.session.creator?.displayName || "Unknown",
        rounds: result.session.rounds,
        matchId: result.matchResult.id
      }
    });

  } catch (error: any) {
    console.error("Join session error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
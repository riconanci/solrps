// app/api/session/join/route.ts - USES ALICE'S ACTUAL MOVES (NO MORE RANDOM!)
import { NextResponse } from "next/server";
import { joinSessionSchema } from "@/lib/zod";
import { prisma } from "@/lib/db";
import { calcPot, payoutFromPot } from "@/lib/payout";
import { tallyOutcome } from "@/lib/rps";
import { getCurrentWeekStart } from "@/lib/weekly";
import { getUserOrSeed } from "../../_utils";
import { z } from "zod";
import type { Move } from "@/lib/hash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Extended schema to allow optional userId for debugging
    const extendedJoinSchema = joinSessionSchema.extend({
      userId: z.string().optional()
    });
    
    const parsed = extendedJoinSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid request data", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { sessionId, challengerMoves } = parsed.data;
    
    // ENHANCED USER DETECTION - Check multiple sources
    let userId = "seed_alice"; // Default fallback
    
    // Method 1: Check request body for explicit userId (most reliable)
    if (parsed.data.userId) {
      userId = parsed.data.userId;
      console.log(`Using explicit userId from request body: ${userId}`);
    } else {
      // Method 2: Check custom headers
      const userHeader = req.headers.get('X-User-ID');
      if (userHeader) {
        userId = userHeader;
        console.log(`Using userId from header: ${userId}`);
      } else {
        // Method 3: Try getUserOrSeed with request (less reliable)
        try {
          const user = await getUserOrSeed(req);
          userId = user.id;
          console.log(`Using userId from getUserOrSeed: ${userId}`);
        } catch (error) {
          console.log(`getUserOrSeed failed, using default: ${userId}`);
        }
      }
    }

    // Get user from database
    const user = await prisma.user.findUnique({ 
      where: { id: userId } 
    });
    
    if (!user) {
      throw new Error(`User ${userId} not found. Run: npm run db:seed`);
    }
    
    console.log(`Join API: User ${user.displayName} (${user.id}) joining session ${sessionId}`);

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

      console.log(`Session status: ${session.status}, Creator: ${session.creator.displayName} (${session.creatorId})`);

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

      // Deduct challenger's stake
      await tx.user.update({
        where: { id: user.id },
        data: { mockBalance: { decrement: session.totalStake } }
      });

      console.log(`Debited ${session.totalStake} tokens from ${user.displayName}`);

      // GET ALICE'S ACTUAL MOVES - No more random!
      let creatorMoves: Move[];
      
      if (session.creatorMoves) {
        // Parse stored moves
        try {
          creatorMoves = typeof session.creatorMoves === 'string' 
            ? JSON.parse(session.creatorMoves)
            : session.creatorMoves;
          
          console.log(`Using Alice's actual moves: ${creatorMoves.join(',')}`);
        } catch (error) {
          console.error('Error parsing creator moves:', error);
          throw new Error("Invalid creator moves stored in session");
        }
      } else {
        // Fallback: If no moves stored, generate random (should not happen in production)
        console.warn('⚠️ WARNING: No creator moves found, using random fallback');
        creatorMoves = Array(session.rounds).fill(null).map(() => {
          const moves: Move[] = ["R", "P", "S"];
          return moves[Math.floor(Math.random() * 3)];
        });
      }

      // Validate creator moves length
      if (creatorMoves.length !== session.rounds) {
        throw new Error(`Creator moves count mismatch. Expected ${session.rounds}, got ${creatorMoves.length}`);
      }

      console.log(`GAME RESOLUTION:`);
      console.log(`- Creator (${session.creator.displayName}): ${creatorMoves.join(',')}`);
      console.log(`- Challenger (${user.displayName}): ${challengerMoves.join(',')}`);

      // Judge the game - Note: correct property names are aWins, bWins, not creatorWins/challengerWins
      const outcome = tallyOutcome(creatorMoves, challengerMoves);
      console.log(`Game outcome:`, outcome);

      // Calculate pot and payouts
      const pot = calcPot(session.rounds, session.stakePerRound);
      const payout = payoutFromPot(pot);
      
      console.log(`Pot: ${pot}, Payouts:`, payout);

      // Update balances based on outcome
      if (outcome.overall === 'DRAW') {
        // Refund both players (no fees on draws)
        await tx.user.update({
          where: { id: session.creatorId },
          data: { mockBalance: { increment: session.totalStake } }
        });
        await tx.user.update({
          where: { id: user.id },
          data: { mockBalance: { increment: session.totalStake } }
        });
        console.log(`DRAW: Refunded both players`);
      } else {
        // Determine winner and pay out
        const winnerId = outcome.overall === 'CREATOR' ? session.creatorId : user.id;
        
        await tx.user.update({
          where: { id: winnerId },
          data: { mockBalance: { increment: payout.payoutWinner } }
        });
        
        console.log(`WINNER: ${winnerId === user.id ? user.displayName : session.creator.displayName} gets ${payout.payoutWinner}`);
      }

      // Update session to resolved
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          challengerId: user.id,
          challengerMoves: JSON.stringify(challengerMoves),
          resolvedAt: new Date()
        }
      });

      // Create match result with correct property names
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId: session.id,
          winnerUserId: outcome.overall === 'DRAW' ? null : 
                       (outcome.overall === 'CREATOR' ? session.creatorId : user.id),
          creatorWins: outcome.aWins,  // Correct property name from tallyOutcome
          challengerWins: outcome.bWins, // Correct property name from tallyOutcome
          draws: outcome.draws,
          pot: pot,
          payoutWinner: outcome.overall === 'DRAW' ? 0 : payout.payoutWinner,
          payoutLoser: 0,
          feeTotal: outcome.overall === 'DRAW' ? 0 : 
                   (payout.feesTreasury + payout.feesBurn + payout.feesDev + payout.feesWeeklyRewards),
          feeTreasury: outcome.overall === 'DRAW' ? 0 : payout.feesTreasury,
          feeBurn: outcome.overall === 'DRAW' ? 0 : payout.feesBurn,
          feeDev: outcome.overall === 'DRAW' ? 0 : payout.feesDev,
          feeWeekly: outcome.overall === 'DRAW' ? 0 : payout.feesWeeklyRewards, // Correct property name
          createdAt: new Date()
        }
      });

      // Add weekly tracking if there's a winner
      if (outcome.overall !== 'DRAW') {
        const weekStart = getCurrentWeekStart();
        
        let weeklyPeriod = await tx.weeklyPeriod.findUnique({
          where: { weekStart }
        });
        
        if (!weeklyPeriod) {
          const weekEnd = new Date(weekStart);
          weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
          
          weeklyPeriod = await tx.weeklyPeriod.create({
            data: {
              weekStart,
              weekEnd,
              totalRewardsPool: 0,
              isDistributed: false
            }
          });
        }

        // Update weekly pool with fee
        await tx.weeklyPeriod.update({
          where: { id: weeklyPeriod.id },
          data: { totalRewardsPool: { increment: payout.feesWeeklyRewards } }
        });

        console.log(`Added ${payout.feesWeeklyRewards} to weekly pool`);
      }

      // Fetch updated user balances
      const updatedCreator = await tx.user.findUnique({ where: { id: session.creatorId } });
      const updatedChallenger = await tx.user.findUnique({ where: { id: user.id } });

      return {
        session: updatedSession,
        result: matchResult,
        outcome,
        payout,
        creatorMoves,
        challengerMoves,
        updatedBalances: {
          creator: updatedCreator?.mockBalance,
          challenger: updatedChallenger?.mockBalance
        }
      };
    });

    console.log(`Game completed successfully`);

    // Calculate pot for response (same calculation as inside transaction)
    const totalPot = calcPot(result.session.rounds, result.session.stakePerRound);

    return NextResponse.json({
      success: true,
      didWin: result.outcome.overall === 'CHALLENGER',
      isDraw: result.outcome.overall === 'DRAW',
      balanceChange: result.outcome.overall === 'DRAW' ? 0 : 
                    (result.outcome.overall === 'CHALLENGER' ? result.payout.payoutWinner - result.session.totalStake : -result.session.totalStake),
      newBalance: result.updatedBalances.challenger,
      creatorMoves: result.creatorMoves,
      challengerMoves: result.challengerMoves,
      matchResult: {
        creatorWins: result.outcome.aWins,
        challengerWins: result.outcome.bWins,
        draws: result.outcome.draws,
        pot: totalPot
      },
      message: result.outcome.overall === 'DRAW' ? 'Draw! Both players refunded.' :
               result.outcome.overall === 'CHALLENGER' ? 'You won!' : 'You lost!'
    });

  } catch (error: any) {
    console.error("Join session error:", error);
    return NextResponse.json({ 
      success: false,
      error: error.message || "Failed to join session" 
    }, { status: 500 });
  }
}
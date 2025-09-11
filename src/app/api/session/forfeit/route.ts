// app/api/session/forfeit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forfeitSchema } from "@/lib/zod";
import { payoutFromPot, calcPot } from "@/lib/payout";

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
    const parsed = forfeitSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid request data",
        details: parsed.error.flatten() 
      }, { status: 400 });
    }
    
    const { sessionId } = parsed.data;
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
      
      if (!session.challengerId) {
        throw new Error("No challenger found for this session");
      }
      
      // Check if deadline has passed
      const now = new Date();
      if (now <= session.revealDeadline) {
        throw new Error("Reveal deadline has not passed yet");
      }

      // Only challenger can claim forfeit (creator failed to reveal)
      if (session.challengerId !== user.id) {
        throw new Error("Only the challenger can claim forfeit");
      }

      // Calculate pot and fees
      const pot = calcPot(session.rounds, session.stakePerRound);
      const { payoutWinner, feesTreasury, feesBurn } = payoutFromPot(pot);

      // Pay challenger (winner by forfeit) - they get the payout amount
      await tx.user.update({
        where: { id: session.challengerId },
        data: { 
          mockBalance: { 
            increment: payoutWinner 
          } 
        }
      });

      // Update session status to FORFEITED
      await tx.session.update({
        where: { id: sessionId },
        data: { 
          status: "FORFEITED" 
        }
      });

      // Create match result for forfeit (SQLite-friendly with stringified JSON)
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: JSON.stringify([]), // No rounds played - stringified JSON
          creatorWins: 0,
          challengerWins: 0,
          draws: 0,
          overall: "CHALLENGER", // Challenger wins by forfeit
          pot,
          feesTreasury,
          feesBurn,
          payoutWinner,
          winnerUserId: session.challengerId,
          replaySeed: null,
        }
      });

      return {
        session,
        matchResult,
        payoutAmount: payoutWinner,
        feesDeducted: feesTreasury + feesBurn
      };
    });

    return NextResponse.json({
      success: true,
      message: "Forfeit claimed successfully",
      data: {
        sessionId: result.session.id,
        status: "FORFEITED",
        payoutAmount: result.payoutAmount,
        feesDeducted: result.feesDeducted,
        matchResultId: result.matchResult.id
      }
    });

  } catch (error) {
    console.error("Forfeit error:", error);
    
    // Handle different types of errors
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("not found") ? 404 : 
                      errorMessage.includes("deadline") || errorMessage.includes("Only") ? 400 : 500;
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: statusCode });
  }
}
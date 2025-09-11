// app/api/session/forfeit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forfeitSchema } from "@/lib/zod";
import { payoutFromPot, calcPot } from "@/lib/payout";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = forfeitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    const { sessionId } = parsed.data;
    const user = await getUserOrSeed();

    const result = await prisma.$transaction(async (tx: any) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { creator: true, challenger: true }
      });

      if (!session) throw new Error("Session not found");
      if (session.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
      if (!session.challengerId) throw new Error("No challenger");
      
      // Check if deadline has passed
      const now = new Date();
      if (now <= session.revealDeadline) {
        throw new Error("Reveal deadline has not passed yet");
      }

      // Only challenger can claim forfeit (creator failed to reveal)
      if (session.challengerId !== user.id) {
        throw new Error("Only challenger can claim forfeit");
      }

      // Calculate pot and fees
      const pot = calcPot(session.rounds, session.stakePerRound);
      const { payoutWinner, feesTreasury, feesBurn } = payoutFromPot(pot);

      // Pay challenger (winner by forfeit)
      await tx.user.update({
        where: { id: session.challengerId },
        data: { mockBalance: { increment: session.totalStake + payoutWinner - session.totalStake } }
      });

      // Update session to FORFEITED
      await tx.session.update({
        where: { id: sessionId },
        data: { status: "FORFEITED" }
      });

      // Create match result for forfeit
      const matchResult = await tx.matchResult.create({
        data: {
          sessionId,
          roundsOutcome: [], // No rounds played
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

      return matchResult;
    });

    return NextResponse.json({
      success: true,
      result,
      message: "Forfeit claimed successfully"
    });

  } catch (error: any) {
    console.error("Forfeit error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
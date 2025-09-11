// app/api/session/join/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { joinSessionSchema } from "@/lib/zod";
import { getUserOrSeed } from "../../_utils";

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
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new Error("Session not found");
      if (session.status !== "OPEN") throw new Error("Session not open");
      if (session.creatorId === user.id) throw new Error("Cannot join own session");
      if (challengerMoves.length !== session.rounds) throw new Error("Moves length mismatch");

      // Check challenger has sufficient balance
      const challenger = await tx.user.findUnique({ where: { id: user.id } });
      if (!challenger || challenger.mockBalance < session.totalStake) {
        throw new Error("Insufficient balance");
      }

      // Debit challenger's balance
      await tx.user.update({ 
        where: { id: user.id }, 
        data: { mockBalance: { decrement: session.totalStake } } 
      });

      // Update session with challenger info (store moves as stringified JSON for SQLite)
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "AWAITING_REVEAL",
          challengerId: user.id,
          challengerMoves: challengerMoves, // Stringify for SQLite
          revealDeadline: new Date(Date.now() + Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600) * 1000),
        },
      });

      return updatedSession;
    });

    return NextResponse.json({ 
      success: true,
      session: {
        id: result.id, 
        status: result.status,
        challengerId: result.challengerId
      }
    });

  } catch (error: any) {
    console.error("Join session error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
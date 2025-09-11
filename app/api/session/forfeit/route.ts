import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forfeitSchema } from "@/lib/zod";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = forfeitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId } = parsed.data;

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
    if (new Date() < s.revealDeadline) throw new Error("Deadline not reached");

    // Challenger wins by forfeit – apply fees
    const pot = s.rounds * s.stakePerRound * 2;
    const fees = Math.floor(pot * 0.10);
    const payoutWinner = pot - fees;

    if (!s.challengerId) throw new Error("No challenger");

    await tx.user.update({ where: { id: s.challengerId }, data: { mockBalance: { increment: payoutWinner } } });

    await tx.matchResult.create({
      data: {
        sessionId: s.id,
        roundsOutcome: [],
        creatorWins: 0,
        challengerWins: 0,
        draws: 0,
        overall: "CHALLENGER",
        pot,
        feesTreasury: Math.floor(pot * 0.05),
        feesBurn: Math.ceil(pot * 0.05),
        payoutWinner,
        winnerUserId: s.challengerId,
      },
    });

    await tx.session.update({ where: { id: s.id }, data: { status: "FORFEITED" } });

    return { status: "FORFEITED" };
  });

  return NextResponse.json(out);
}
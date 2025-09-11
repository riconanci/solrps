import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revealSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = revealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId, moves, salt } = parsed.data;
  const me = await getUserOrSeed();

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
    if (s.creatorId !== me.id) throw new Error("Only creator can reveal");
    if (!s.challengerId || !s.challengerMoves) throw new Error("No challenger");

    // Verify commit
    const ok = verifyCommit(s.commitHash, moves as any, salt);
    if (!ok) throw new Error("Commit mismatch");

    // Judge
    const { outcomes, aWins, bWins, draws, overall } = tallyOutcome(moves as any, s.challengerMoves as any);
    const pot = calcPot(s.rounds, s.stakePerRound);

    let feesTreasury = 0, feesBurn = 0, payoutWinner = 0, winnerUserId: string | undefined;

    if (overall === "DRAW") {
      // Refund both sides fully; no fees
      await tx.user.update({ where: { id: s.creatorId }, data: { mockBalance: { increment: s.totalStake } } });
      await tx.user.update({ where: { id: s.challengerId! }, data: { mockBalance: { increment: s.totalStake } } });
    } else {
      const { payoutWinner: pay, feesTreasury: t, feesBurn: b } = payoutFromPot(pot);
      feesTreasury = t; feesBurn = b; payoutWinner = pay;
      winnerUserId = overall === "CREATOR" ? s.creatorId : s.challengerId!;
      await tx.user.update({ where: { id: winnerUserId }, data: { mockBalance: { increment: pay } } });
      // fees -> mocked (no balance change)
    }

    const res = await tx.matchResult.create({
      data: {
        sessionId: s.id,
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
      },
    });

    await tx.session.update({ where: { id: s.id }, data: { status: "RESOLVED", creatorRevealed: true, creatorMoves: moves } });

    return { resultId: res.id, overall, payoutWinner };
  });

  return NextResponse.json(out);
}
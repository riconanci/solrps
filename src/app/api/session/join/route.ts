import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { joinSessionSchema } from "@/lib/zod";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = joinSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId, challengerMoves } = parsed.data;
  const user = await getUserOrSeed();

  const result = await prisma.$transaction(async (tx: any) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "OPEN") throw new Error("Session not open");
    if (s.creatorId === user.id) throw new Error("Cannot join own session");
    if (challengerMoves.length !== s.rounds) throw new Error("Moves length mismatch");

    if ((await tx.user.findUnique({ where: { id: user.id } }))!.mockBalance < s.totalStake)
      throw new Error("Insufficient balance");

    await tx.user.update({ where: { id: user.id }, data: { mockBalance: { decrement: s.totalStake } } });

    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: "AWAITING_REVEAL",
        challengerId: user.id,
        challengerMoves: challengerMoves,
        revealDeadline: new Date(Date.now() + Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600) * 1000),
      },
    });

    return updated;
  });

  return NextResponse.json({ id: result.id, status: result.status });
}
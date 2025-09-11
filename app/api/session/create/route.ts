import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionSchema } from "@/lib/zod";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { rounds, stakePerRound, commitHash, isPrivate } = parsed.data;
  const total = rounds * stakePerRound;

  const user = await getUserOrSeed();

  // Mock escrow: debit user.mockBalance by total and hold implicitly by Session.totalStake
  if (user.mockBalance < total) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

  const session = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: user.id }, data: { mockBalance: { decrement: total } } });
    const s = await tx.session.create({
      data: {
        status: "OPEN",
        rounds,
        stakePerRound,
        totalStake: total,
        commitHash,
        creatorId: updated.id,
        revealDeadline: new Date(Date.now() + Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600) * 1000),
        isPrivate: !!isPrivate,
      },
    });
    return s;
  });

  return NextResponse.json({ id: session.id });
}
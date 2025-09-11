import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";

export async function GET() {
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { creator: true },
  });
  const items = sessions.map((s) => ({
    id: s.id,
    creator: s.creator.displayName ?? s.creatorId.slice(0, 6),
    rounds: s.rounds,
    stakePerRound: s.stakePerRound,
    totalStake: s.totalStake,
    age: formatDistanceToNowStrict(s.createdAt, { addSuffix: true }),
  }));
  return NextResponse.json({ items });
}
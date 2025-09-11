import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.matchResult.groupBy({
    by: ["winnerUserId"],
    where: { createdAt: { gte: weekAgo }, payoutWinner: { gt: 0 }, winnerUserId: { not: null } },
    _sum: { payoutWinner: true },
    _count: { _all: true },
  });
  return NextResponse.json({
    items: rows.map((r) => ({ userId: r.winnerUserId, total: r._sum.payoutWinner ?? 0, wins: r._count._all })),
  });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";

export async function GET() {
  const me = await getUserOrSeed();
  const matches = await prisma.matchResult.findMany({
    where: { OR: [{ winnerUserId: me.id }, { session: { creatorId: me.id } }, { session: { challengerId: me.id } }] },
    orderBy: { createdAt: "desc" },
    include: { session: true },
  });
  return NextResponse.json({ items: matches });
}
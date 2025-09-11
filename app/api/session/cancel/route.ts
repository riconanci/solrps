import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cancelSchema } from "@/lib/zod";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId } = parsed.data;

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "OPEN") throw new Error("Only OPEN can be canceled");

    await tx.user.update({ where: { id: s.creatorId }, data: { mockBalance: { increment: s.totalStake } } });
    await tx.session.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
    return { status: "CANCELLED" };
  });

  return NextResponse.json(out);
}
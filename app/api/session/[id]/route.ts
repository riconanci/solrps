import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await prisma.session.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Hide creatorMoves until revealed
  const { creatorMoves, ...rest } = s as any;
  return NextResponse.json({ ...rest, creatorMoves: s.creatorRevealed ? creatorMoves : undefined });
}
// app/api/session/[id]/route.ts - FIXED for Next.js 15+
import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";

export async function GET(
  _: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // FIXED: Await params
    
    const s = await prisma.session.findUnique({ where: { id } });
    
    if (!s) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    // Hide creatorMoves until revealed
    const { creatorMoves, ...rest } = s as any;
    
    return NextResponse.json({ 
      ...rest, 
      creatorMoves: s.creatorRevealed ? creatorMoves : undefined 
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
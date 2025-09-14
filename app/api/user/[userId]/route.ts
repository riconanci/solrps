// app/api/user/[userId]/route.ts - FIXED for Next.js 15+
import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params; // FIXED: Await params
    
    // Only allow fetching seed users for security
    if (userId !== 'seed_alice' && userId !== 'seed_bob') {
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: user.id,
      displayName: user.displayName,
      balance: user.mockBalance,
      mockBalance: user.mockBalance // Include both for compatibility
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
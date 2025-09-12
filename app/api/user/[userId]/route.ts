// app/api/user/[userId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
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
      balance: user.mockBalance
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
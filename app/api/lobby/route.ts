// app/api/lobby/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        status: "OPEN",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const formattedSessions = sessions.map((session: any) => ({
      id: session.id,
      creatorId: session.creatorId,
      creator: session.creator.displayName || `User ${session.creatorId.slice(0, 8)}`,
      rounds: session.rounds,
      stakePerRound: session.stakePerRound,
      totalStake: session.totalStake,
      status: session.status,
      createdAt: session.createdAt,
    }));

    return NextResponse.json({
      success: true,
      items: formattedSessions,
    });
  } catch (error) {
    console.error("Lobby error:", error);
    return NextResponse.json({ 
      success: false,
      error: "Failed to fetch sessions" 
    }, { status: 500 });
  }
}
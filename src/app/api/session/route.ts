// app/api/session/my/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const querySchema = z.object({
  userId: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { userId } = querySchema.parse({
      userId: searchParams.get('userId'),
    });

    const sessions = await prisma.session.findMany({
      where: {
        creatorId: userId,
        status: 'OPEN' // Only show open sessions
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        rounds: true,
        stakePerRound: true,
        totalStake: true,
        isPrivate: true,
        status: true,
        createdAt: true,
      }
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
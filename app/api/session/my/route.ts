// app/api/session/my/route.ts - NEW ROUTE for user-specific sessions
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/db';
import { z } from 'zod';

const querySchema = z.object({
  userId: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get('userId');
    
    if (!userIdParam) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const { userId } = querySchema.parse({
      userId: userIdParam,
    });

    console.log(`📚 Fetching sessions for user: ${userId}`);

    // Get all sessions created by this user (OPEN status only for "Your Games")
    const sessions = await prisma.session.findMany({
      where: {
        creatorId: userId,
        status: 'OPEN' // Only show active/waiting games
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
        creatorId: true
      }
    });

    console.log(`✅ Found ${sessions.length} sessions for ${userId}`);

    return NextResponse.json({ 
      sessions,
      count: sessions.length 
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
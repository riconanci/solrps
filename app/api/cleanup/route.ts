// app/api/cleanup/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../src/lib/db';

export async function POST() {
  try {
    console.log('🧹 Starting database cleanup...');
    
    const now = new Date();
    const results = {
      expiredSessions: 0,
      oldMatchResults: 0
    };

    // Use explicit typing for the transaction
    const cleanupResult = await prisma.$transaction(async (tx: any) => {
      // 1. Clean up expired OPEN sessions (older than 24 hours)
      const expiredOpenSessions = await tx.session.findMany({
        where: {
          status: 'OPEN',
          createdAt: {
            lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
          }
        },
        include: { creator: true }
      });

      // Refund creators and mark as CANCELLED
      for (const session of expiredOpenSessions) {
        await tx.user.update({
          where: { id: session.creatorId },
          data: { mockBalance: { increment: session.totalStake } }
        });
        
        await tx.session.update({
          where: { id: session.id },
          data: { status: 'CANCELLED' }
        });
      }

      // 2. Clean up old AWAITING_REVEAL sessions (past deadline + 1 hour grace)
      const expiredRevealSessions = await tx.session.findMany({
        where: {
          status: 'AWAITING_REVEAL',
          revealDeadline: {
            lt: new Date(now.getTime() - 60 * 60 * 1000) // 1 hour past deadline
          }
        }
      });

      // Auto-forfeit these sessions (challenger wins)
      for (const session of expiredRevealSessions) {
        if (session.challengerId) {
          // Calculate payout (pot minus fees)
          const pot = session.totalStake * 2;
          const fees = Math.floor(pot * 0.05); // 5% total fees
          const payout = pot - fees;

          // Pay challenger
          await tx.user.update({
            where: { id: session.challengerId },
            data: { mockBalance: { increment: payout } }
          });

          // Mark as forfeited
          await tx.session.update({
            where: { id: session.id },
            data: { status: 'FORFEITED' }
          });
        }
      }

      // 3. Delete old RESOLVED/CANCELLED sessions (older than 30 days)
      const oldSessions = await tx.session.deleteMany({
        where: {
          status: { in: ['RESOLVED', 'CANCELLED', 'FORFEITED'] },
          createdAt: {
            lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          }
        }
      });

      // 4. Clean up old match results (older than 90 days)
      const oldMatches = await tx.matchResult.deleteMany({
        where: {
          createdAt: {
            lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
          }
        }
      });

      return {
        expiredSessions: expiredOpenSessions.length,
        oldMatchResults: oldMatches.count
      };
    });

    console.log('✅ Database cleanup completed:', cleanupResult);
    
    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed',
      ...cleanupResult
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Cleanup failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
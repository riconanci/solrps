// app/api/session/create/route.ts - STORES ALICE'S ACTUAL MOVES
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";
import { z } from "zod";
import type { Move } from "@/lib/hash";

// Enhanced schema to accept creator moves and salt
const createSessionSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  stakePerRound: z.union([z.literal(100), z.literal(500), z.literal(1000)]),
  commitHash: z.string().length(64),
  isPrivate: z.boolean().optional(),
  // New fields to store Alice's actual moves
  moves: z.array(z.enum(['R', 'P', 'S'])).optional(),
  salt: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid request data",
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { rounds, stakePerRound, commitHash, isPrivate, moves, salt } = parsed.data;
    const totalStake = rounds * stakePerRound;

    // Enhanced user detection
    let userId = "seed_alice";
    
    // Check request body for explicit userId
    if (body.userId) {
      userId = body.userId;
    } else {
      // Check custom headers
      const userHeader = req.headers.get('X-User-ID');
      if (userHeader) {
        userId = userHeader;
      } else {
        // Try getUserOrSeed
        try {
          const user = await getUserOrSeed(req);
          userId = user.id;
        } catch (error) {
          console.log(`getUserOrSeed failed, using default: ${userId}`);
        }
      }
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId } 
    });
    
    if (!user) {
      throw new Error(`User ${userId} not found. Run: npm run db:seed`);
    }

    console.log(`Creating session for user: ${user.displayName} (${user.id})`);

    // Check sufficient balance
    if (user.mockBalance < totalStake) {
      return NextResponse.json({ 
        error: `Insufficient balance. Need ${totalStake}, have ${user.mockBalance}` 
      }, { status: 400 });
    }

    // Validate moves if provided
    if (moves && moves.length !== rounds) {
      return NextResponse.json({ 
        error: `Move count mismatch. Expected ${rounds} moves, got ${moves.length}` 
      }, { status: 400 });
    }

    const session = await prisma.$transaction(async (tx: any) => {
      // Debit user balance
      await tx.user.update({ 
        where: { id: user.id }, 
        data: { mockBalance: { decrement: totalStake } } 
      });

      console.log(`Debited ${totalStake} tokens from ${user.displayName}`);

      // Create session with creator moves stored
      const newSession = await tx.session.create({
        data: {
          status: "OPEN",
          rounds,
          stakePerRound,
          totalStake,
          commitHash,
          creatorId: user.id,
          revealDeadline: new Date(Date.now() + 600 * 1000), // 10 minutes
          isPrivate: !!isPrivate,
          // Store Alice's actual moves and salt
          creatorMoves: moves ? JSON.stringify(moves) : null,
          creatorSalt: salt || null,
        },
      });

      console.log(`Created session ${newSession.id} with moves:`, moves);

      return newSession;
    });

    return NextResponse.json({ 
      success: true,
      sessionId: session.id,
      message: "Session created successfully"
    });

  } catch (error: any) {
    console.error("Create session error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to create session" 
    }, { status: 500 });
  }
}
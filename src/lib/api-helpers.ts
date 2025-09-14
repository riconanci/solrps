// src/lib/api-helpers.ts - ENHANCED FOR PHASE 2 (COMPLETE WITH ALL ORIGINAL FEATURES)
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UserContext {
  userId: string;
  walletPubkey?: string | null;
  isWalletUser: boolean;
  displayName?: string | null;
  mockBalance: number;
}

/**
 * Enhanced user identification for Phase 2
 * Supports both wallet addresses and legacy user IDs
 * MAINTAINS ORIGINAL FUNCTIONALITY: getUserOrSeed equivalent
 */
export async function getUserContext(request: NextRequest): Promise<UserContext | null> {
  try {
    // Phase 2: Try to get wallet address from header first
    const walletAddress = request.headers.get('x-wallet-address');
    
    if (walletAddress && isValidSolanaAddress(walletAddress)) {
      // Look up user by wallet pubkey
      let user = await prisma.user.findFirst({
        where: { walletPubkey: walletAddress }
      });

      // If wallet user doesn't exist, create them automatically
      if (!user) {
        user = await createWalletUser(walletAddress);
      }

      return {
        userId: user.id,
        walletPubkey: user.walletPubkey,
        isWalletUser: true,
        displayName: user.displayName,
        mockBalance: user.mockBalance || 500000,
      };
    }

    // ORIGINAL FUNCTIONALITY: Fallback to legacy user detection (Phase 1)
    let userId = "seed_alice"; // Default to Alice

    // Try to get user from request URL parameters
    const url = new URL(request.url);
    const userParam = url.searchParams.get('user');
    
    if (userParam === 'alice' || userParam === 'seed_alice') {
      userId = "seed_alice";
    } else if (userParam === 'bob' || userParam === 'seed_bob') {
      userId = "seed_bob";
    } else {
      // Check referer header (original functionality)
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const refUserParam = refererUrl.searchParams.get('user');
          
          if (refUserParam === 'bob' || refUserParam === 'seed_bob') {
            userId = "seed_bob";
          } else if (refUserParam === 'alice' || refUserParam === 'seed_alice') {
            userId = "seed_alice";
          }
        } catch (error) {
          // Fallback silently if referer URL parsing fails
        }
      }
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.error(`Seed user ${userId} missing. Run: npm run db:seed`);
      return null;
    }

    console.log(`🎮 API using user: ${user.displayName} (${user.id})`);

    return {
      userId: user.id,
      walletPubkey: user.walletPubkey,
      isWalletUser: false,
      displayName: user.displayName,
      mockBalance: user.mockBalance || 500000,
    };

  } catch (error) {
    console.error('Error getting user context:', error);
    return null;
  }
}

/**
 * ORIGINAL FUNCTION: getUserOrSeed - maintained for backward compatibility
 */
export async function getUserOrSeed(request?: Request) {
  let userId = "seed_alice"; // Default to Alice

  // Try to get user from request URL if provided
  if (request) {
    try {
      const url = new URL(request.url);
      const userParam = url.searchParams.get('user');
      
      if (userParam === 'alice' || userParam === 'seed_alice') {
        userId = "seed_alice";
      } else if (userParam === 'bob' || userParam === 'seed_bob') {
        userId = "seed_bob";
      }
    } catch (error) {
      // If URL parsing fails, stick with default
      console.log("Could not parse URL for user detection, using Alice");
    }
  }

  // Try to get user from headers (for cases where URL isn't available)
  if (request && userId === "seed_alice") {
    try {
      const referer = request.headers.get('referer');
      if (referer) {
        const refererUrl = new URL(referer);
        const userParam = refererUrl.searchParams.get('user');
        
        if (userParam === 'bob' || userParam === 'seed_bob') {
          userId = "seed_bob";
        }
      }
    } catch (error) {
      // Fallback silently
    }
  }

  const user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });
  
  if (!user) {
    throw new Error(`Seed user ${userId} missing. Run: npm run db:seed`);
  }
  
  console.log(`🎮 API using user: ${user.displayName} (${user.id})`);
  return user;
}

/**
 * ORIGINAL FUNCTION: getUserFromHeaders - maintained for backward compatibility
 */
export async function getUserFromHeaders(request: Request) {
  // Try to detect user from various sources
  let userId = "seed_alice"; // Default

  // Check URL parameter
  const url = new URL(request.url);
  const userParam = url.searchParams.get('user');
  
  if (userParam === 'alice' || userParam === 'seed_alice') {
    userId = "seed_alice";
  } else if (userParam === 'bob' || userParam === 'seed_bob') {
    userId = "seed_bob";
  } else {
    // Check referer header
    const referer = request.headers.get('referer');
    if (referer && referer.includes('user=seed_bob')) {
      userId = "seed_bob";
    } else if (referer && referer.includes('user=bob')) {
      userId = "seed_bob";
    }
  }

  const user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });
  
  if (!user) {
    throw new Error(`User ${userId} not found. Run: npm run db:seed`);
  }
  
  return user;
}

/**
 * Create a new user for a wallet address
 */
async function createWalletUser(walletAddress: string) {
  const userId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const displayName = formatWalletAddress(walletAddress);
  
  console.log(`🆕 Creating wallet user: ${displayName}`);
  
  return await prisma.user.create({
    data: {
      id: userId,
      walletPubkey: walletAddress,
      displayName,
      mockBalance: 500000, // Starting balance matches schema default
    }
  });
}

/**
 * Format wallet address for display
 */
function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Validate Solana wallet addresses
 */
function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Solana addresses are typically 32-44 characters, base58 encoded
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaAddressRegex.test(address);
}

/**
 * Middleware helper to add user context to request
 */
export function withUserContext(handler: (req: NextRequest, userContext: UserContext) => Promise<Response>) {
  return async (request: NextRequest) => {
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    return handler(request, userContext);
  };
}

/**
 * Find user by identifier - works with both wallet addresses and legacy user IDs
 */
export async function findUserByIdentifier(identifier: string) {
  // Try exact ID match first (legacy users)
  let user = await prisma.user.findUnique({
    where: { id: identifier }
  });

  // If not found and looks like a wallet address, try wallet lookup
  if (!user && isValidSolanaAddress(identifier)) {
    user = await prisma.user.findFirst({
      where: { walletPubkey: identifier }
    });
  }

  return user;
}

/**
 * Create or update user with wallet address
 */
export async function upsertWalletUser(walletAddress: string, displayName?: string) {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana wallet address');
  }

  // Try to find existing user with this wallet
  let user = await prisma.user.findFirst({
    where: { walletPubkey: walletAddress }
  });

  if (user) {
    // Update existing user if display name provided
    if (displayName && displayName !== user.displayName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { displayName }
      });
    }
    return user;
  }

  // Create new wallet user
  const userId = `wallet_${Date.now()}_${walletAddress.slice(0, 6)}`;
  return await prisma.user.create({
    data: {
      id: userId,
      walletPubkey: walletAddress,
      displayName: displayName || formatWalletAddress(walletAddress),
      mockBalance: 500000, // Default starting balance
    }
  });
}

/**
 * Get user balance
 */
export async function getUserBalance(userId: string): Promise<number> {
  const user = await findUserByIdentifier(userId);
  return user?.mockBalance || 0;
}

/**
 * Update user balance
 */
export async function updateUserBalance(userId: string, newBalance: number) {
  const user = await findUserByIdentifier(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return await prisma.user.update({
    where: { id: user.id },
    data: { mockBalance: newBalance }
  });
}

/**
 * ORIGINAL FUNCTION: Session creator that matches your existing API pattern
 * ENHANCED: Works with both wallet and legacy users
 */
export async function createSessionForUser(
  userId: string,
  sessionData: {
    rounds: number;
    stakePerRound: number;
    commitHash: string;
    isPrivate?: boolean;
    saltHint?: string;
  }
) {
  const user = await findUserByIdentifier(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const totalStake = sessionData.rounds * sessionData.stakePerRound;
  if (user.mockBalance < totalStake) {
    throw new Error('Insufficient balance');
  }

  // Create session in transaction to ensure atomicity
  const session = await prisma.$transaction(async (tx) => {
    // Calculate reveal deadline (30 minutes from now)
    const revealDeadline = new Date(Date.now() + 30 * 60 * 1000);

    // Create session with ALL required fields explicitly set
    const newSession = await tx.session.create({
      data: {
        creatorId: user.id,
        rounds: sessionData.rounds,
        stakePerRound: sessionData.stakePerRound,
        totalStake,
        commitHash: sessionData.commitHash,
        revealDeadline,
        isPrivate: sessionData.isPrivate || false,
        status: 'OPEN', // Explicitly set status (required in your schema)
        saltHint: sessionData.saltHint || null, // Handle optional field
      }
    });

    // Debit creator balance
    await tx.user.update({
      where: { id: user.id },
      data: { 
        mockBalance: user.mockBalance - totalStake 
      }
    });

    return newSession;
  });

  return session;
}

/**
 * Check if a session can be joined by a user
 */
export async function canJoinSession(sessionId: string, userId: string): Promise<{
  canJoin: boolean;
  reason?: string;
  session?: any;
}> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { creator: true }
  });

  if (!session) {
    return { canJoin: false, reason: 'Session not found' };
  }

  if (session.status !== 'OPEN') {
    return { canJoin: false, reason: 'Session is not open' };
  }

  if (session.creatorId === userId) {
    return { canJoin: false, reason: 'Cannot join your own session' };
  }

  const user = await findUserByIdentifier(userId);
  if (!user) {
    return { canJoin: false, reason: 'User not found' };
  }

  if (user.mockBalance < session.totalStake) {
    return { canJoin: false, reason: 'Insufficient balance' };
  }

  return { canJoin: true, session };
}

/**
 * Enhanced session joining for Phase 2 cross-wallet gameplay
 */
export async function joinSessionAsUser(
  sessionId: string, 
  challengerId: string, 
  challengerMoves: any[]
) {
  const validation = await canJoinSession(sessionId, challengerId);
  
  if (!validation.canJoin) {
    throw new Error(validation.reason || 'Cannot join session');
  }

  const { session } = validation;
  const challenger = await findUserByIdentifier(challengerId);
  
  if (!challenger) {
    throw new Error('Challenger not found');
  }

  // Join session in transaction
  return await prisma.$transaction(async (tx) => {
    // Update session with challenger
    const updatedSession = await tx.session.update({
      where: { id: sessionId },
      data: {
        challengerId: challenger.id,
        challengerMoves: JSON.stringify(challengerMoves),
        status: 'AWAITING_REVEAL', // Change status to indicate game started
      }
    });

    // Debit challenger balance
    await tx.user.update({
      where: { id: challenger.id },
      data: {
        mockBalance: challenger.mockBalance - session.totalStake
      }
    });

    return updatedSession;
  });
}

/**
 * Helper to clean up Prisma connections
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth() {
  try {
    await prisma.user.count();
    return { healthy: true };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
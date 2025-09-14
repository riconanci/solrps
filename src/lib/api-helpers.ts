// src/lib/api-helpers.ts - Phase 2 API utilities (FULLY REWRITTEN TO MATCH EXACT SCHEMA)
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UserContext {
  userId: string;
  walletPubkey?: string | null;
  isWalletUser: boolean;
  displayName?: string | null;
}

/**
 * Enhanced user identification for Phase 2
 * Supports both wallet addresses and legacy user IDs
 */
export async function getUserContext(request: NextRequest): Promise<UserContext | null> {
  try {
    // Try to get wallet address from header (Phase 2)
    const walletAddress = request.headers.get('x-wallet-address');
    
    if (walletAddress && isValidSolanaAddress(walletAddress)) {
      // Look up user by wallet pubkey
      let user = await prisma.user.findFirst({
        where: { walletPubkey: walletAddress }
      });

      // If wallet user doesn't exist, create them
      if (!user) {
        user = await createWalletUser(walletAddress);
      }

      return {
        userId: user.id,
        walletPubkey: user.walletPubkey,
        isWalletUser: true,
        displayName: user.displayName || formatWalletAddress(walletAddress),
      };
    }

    // Fallback to legacy user ID (Phase 1)
    const legacyUserId = request.headers.get('x-user-id') || 'seed_alice';
    
    const user = await prisma.user.findUnique({
      where: { id: legacyUserId }
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      walletPubkey: user.walletPubkey,
      isWalletUser: false,
      displayName: user.displayName,
    };

  } catch (error) {
    console.error('Error getting user context:', error);
    return null;
  }
}

/**
 * Create a new user for a wallet address
 */
async function createWalletUser(walletAddress: string) {
  const userId = `wallet_${walletAddress.slice(0, 8)}`;
  const displayName = formatWalletAddress(walletAddress);
  
  return await prisma.user.create({
    data: {
      id: userId,
      walletPubkey: walletAddress,
      displayName,
      mockBalance: 500000, // Default balance for new wallet users
    }
  });
}

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  // Basic validation: Solana addresses are base58 encoded, typically 32-44 characters
  return /^[A-Za-z0-9]{32,44}$/.test(address);
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Get user by either wallet address or legacy ID
 */
export async function getUserByIdOrWallet(identifier: string) {
  // Try wallet address first
  if (isValidSolanaAddress(identifier)) {
    return await prisma.user.findFirst({
      where: { walletPubkey: identifier }
    });
  }

  // Fallback to legacy ID lookup
  return await prisma.user.findUnique({
    where: { id: identifier }
  });
}

/**
 * Enhanced session creation that works with both Phase 1 and Phase 2
 * COMPLETELY REWRITTEN: Includes explicit status field to match your schema requirements
 */
export async function createGameSession(
  creatorId: string,
  rounds: number,
  stakePerRound: number,
  commitHash: string,
  isPrivate: boolean = false
) {
  // Get creator user (works for both wallet and legacy users)
  const creator = await getUserByIdOrWallet(creatorId);
  
  if (!creator) {
    throw new Error('Creator not found');
  }

  // Check balance
  const totalStake = rounds * stakePerRound;
  if (creator.mockBalance < totalStake) {
    throw new Error('Insufficient balance');
  }

  // Create session and debit balance in transaction
  const session = await prisma.$transaction(async (tx) => {
    // Calculate reveal deadline (30 minutes from now)
    const revealDeadline = new Date(Date.now() + 30 * 60 * 1000);

    // Create session with ALL required fields explicitly set
    const newSession = await tx.session.create({
      data: {
        creatorId: creator.id,
        rounds,
        stakePerRound,
        totalStake,
        commitHash,
        revealDeadline,
        isPrivate,
        status: 'OPEN', // Explicitly set status (required in your schema)
      }
    });

    // Debit creator balance
    await tx.user.update({
      where: { id: creator.id },
      data: { 
        mockBalance: creator.mockBalance - totalStake 
      }
    });

    return newSession;
  });

  return session;
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
 * Simple session creator that matches your existing API pattern
 * COMPLETELY REWRITTEN: Includes all required fields with explicit values
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

  return await prisma.$transaction(async (tx) => {
    // Create session with ALL required fields explicitly
    const sessionCreateData: any = {
      creatorId: user.id,
      rounds: sessionData.rounds,
      stakePerRound: sessionData.stakePerRound,
      totalStake,
      commitHash: sessionData.commitHash,
      revealDeadline: new Date(Date.now() + 30 * 60 * 1000),
      isPrivate: sessionData.isPrivate || false,
      status: 'OPEN', // Explicitly required in your schema
    };

    // Add optional fields only if provided
    if (sessionData.saltHint) {
      sessionCreateData.saltHint = sessionData.saltHint;
    }

    const session = await tx.session.create({
      data: sessionCreateData
    });

    // Update user balance
    await tx.user.update({
      where: { id: user.id },
      data: { mockBalance: user.mockBalance - totalStake }
    });

    return session;
  });
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
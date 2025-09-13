// app/api/dev/claim/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";
import type { PrismaClient } from "@prisma/client";

// Dev wallet addresses - you can customize this
const DEV_WALLET_IDS = [
  "alice", // For testing, Alice can claim dev rewards
  // Add your actual dev wallet IDs here
];

type DevReward = {
  id: string;
  amount: number;
  isClaimed: boolean;
  createdAt: Date;
  claimedAt: Date | null;
  description: string | null;
};

export async function POST(req: Request) {
  try {
    const user = await getUserOrSeed();

    // Check if user is authorized to claim dev rewards
    if (!DEV_WALLET_IDS.includes(user.id)) {
      return NextResponse.json({ 
        error: "Unauthorized - only dev wallets can claim dev rewards" 
      }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
      // Get all unclaimed dev rewards
      const unclaimedRewards = await tx.devReward.findMany({
        where: { isClaimed: false },
        orderBy: { createdAt: 'asc' }
      });

      if (unclaimedRewards.length === 0) {
        throw new Error("No dev rewards available to claim");
      }

      const totalAmount = unclaimedRewards.reduce((sum: number, reward: DevReward) => sum + reward.amount, 0);

      // Mark all as claimed
      await tx.devReward.updateMany({
        where: { 
          id: { in: unclaimedRewards.map((r: DevReward) => r.id) },
          isClaimed: false 
        },
        data: {
          isClaimed: true,
          claimedAt: new Date()
        }
      });

      // Add to user's balance
      await tx.user.update({
        where: { id: user.id },
        data: { mockBalance: { increment: totalAmount } }
      });

      return {
        claimedRewards: unclaimedRewards,
        totalAmount,
        newBalance: user.mockBalance + totalAmount
      };
    });

    return NextResponse.json({
      success: true,
      message: `Claimed ${result.totalAmount.toLocaleString()} dev tokens from ${result.claimedRewards.length} rewards!`,
      claimedAmount: result.totalAmount,
      claimedCount: result.claimedRewards.length,
      newBalance: result.newBalance
    });

  } catch (error: any) {
    console.error("Dev claim error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to claim dev rewards" 
    }, { status: 500 });
  }
}

// GET endpoint to check available dev rewards
export async function GET() {
  try {
    const user = await getUserOrSeed();

    // Check if user is authorized
    if (!DEV_WALLET_IDS.includes(user.id)) {
      return NextResponse.json({ 
        error: "Unauthorized - only dev wallets can view dev rewards" 
      }, { status: 403 });
    }

    const unclaimedRewards = await prisma.devReward.findMany({
      where: { isClaimed: false },
      orderBy: { createdAt: 'desc' }
    });

    const claimedRewards = await prisma.devReward.findMany({
      where: { isClaimed: true },
      orderBy: { claimedAt: 'desc' },
      take: 20 // Last 20 claimed rewards
    });

    const totalUnclaimed = unclaimedRewards.reduce((sum: number, r: DevReward) => sum + r.amount, 0);
    const totalClaimed = await prisma.devReward.aggregate({
      where: { isClaimed: true },
      _sum: { amount: true }
    });

    return NextResponse.json({
      success: true,
      unclaimed: unclaimedRewards,
      claimed: claimedRewards,
      totalUnclaimed,
      totalClaimed: totalClaimed._sum.amount || 0,
      summary: {
        unclaimedCount: unclaimedRewards.length,
        claimedCount: await prisma.devReward.count({ where: { isClaimed: true } })
      }
    });

  } catch (error: any) {
    console.error("Get dev rewards error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to get dev rewards" 
    }, { status: 500 });
  }
}

/*
Dev Rewards Claim Component for integration into a page:

import { useState, useEffect } from 'react';

export function DevRewardsClaim() {
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchDevRewards();
  }, []);

  async function fetchDevRewards() {
    try {
      const res = await fetch('/api/dev/claim');
      if (res.ok) {
        const data = await res.json();
        setRewards(data);
      }
    } catch (err) {
      console.error('Failed to fetch dev rewards:', err);
    } finally {
      setLoading(false);
    }
  }

  async function claimRewards() {
    try {
      setClaiming(true);
      const res = await fetch('/api/dev/claim', { method: 'POST' });
      const result = await res.json();
      
      if (res.ok) {
        alert(result.message);
        fetchDevRewards(); // Refresh
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <div>Loading dev rewards...</div>;
  if (!rewards) return null; // Not authorized or error

  return (
    <div className="bg-purple-500/20 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-xl font-bold mb-4 text-purple-400">
        🔧 Dev Rewards
      </h3>
      
      {rewards.totalUnclaimed > 0 ? (
        <div className="mb-4">
          <div className="text-lg font-semibold mb-2">
            Available: {rewards.totalUnclaimed.toLocaleString()} tokens
          </div>
          <div className="text-sm text-gray-400 mb-3">
            From {rewards.unclaimed.length} fee collections
          </div>
          <button
            onClick={claimRewards}
            disabled={claiming}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-medium"
          >
            {claiming ? 'Claiming...' : 'Claim All Dev Rewards'}
          </button>
        </div>
      ) : (
        <div className="text-gray-400 mb-4">
          No dev rewards available to claim
        </div>
      )}
      
      <div className="text-sm text-gray-400">
        Total claimed: {rewards.totalClaimed.toLocaleString()} tokens
      </div>
    </div>
  );
}
*/
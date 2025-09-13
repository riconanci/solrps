// app/api/weekly/claim/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { weeklyRewardId } = body;
    const user = await getUserOrSeed();

    if (!weeklyRewardId) {
      return NextResponse.json({ error: "Weekly reward ID required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Get the weekly reward
      const reward = await tx.weeklyReward.findUnique({
        where: { id: weeklyRewardId },
        include: {
          weeklyPeriod: true,
          user: true
        }
      });

      if (!reward) {
        throw new Error("Weekly reward not found");
      }

      if (reward.userId !== user.id) {
        throw new Error("You can only claim your own rewards");
      }

      if (reward.isClaimed) {
        throw new Error("Reward already claimed");
      }

      if (!reward.weeklyPeriod.isDistributed) {
        throw new Error("Rewards not yet distributed for this period");
      }

      // Claim the reward - add to user's balance
      await tx.user.update({
        where: { id: user.id },
        data: { mockBalance: { increment: reward.rewardAmount } }
      });

      // Mark as claimed
      const claimedReward = await tx.weeklyReward.update({
        where: { id: weeklyRewardId },
        data: {
          isClaimed: true,
          claimedAt: new Date()
        }
      });

      return {
        reward: claimedReward,
        newBalance: user.mockBalance + reward.rewardAmount
      };
    });

    return NextResponse.json({
      success: true,
      message: `Claimed ${result.reward.rewardAmount} tokens!`,
      reward: result.reward,
      newBalance: result.newBalance
    });

  } catch (error: any) {
    console.error("Claim reward error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to claim reward" 
    }, { status: 500 });
  }
}

// GET endpoint to fetch user's claimable rewards
export async function GET() {
  try {
    const user = await getUserOrSeed();

    const rewards = await prisma.weeklyReward.findMany({
      where: {
        userId: user.id,
        weeklyPeriod: { isDistributed: true }
      },
      include: {
        weeklyPeriod: true
      },
      orderBy: {
        weeklyPeriod: { weekStart: 'desc' }
      }
    });

    const claimable = rewards.filter((r: any) => !r.isClaimed);
    const claimed = rewards.filter((r: any) => r.isClaimed);

    const totalClaimable = claimable.reduce((sum: number, r: any) => sum + r.rewardAmount, 0);
    const totalClaimed = claimed.reduce((sum: number, r: any) => sum + r.rewardAmount, 0);

    return NextResponse.json({
      success: true,
      claimable,
      claimed,
      totalClaimable,
      totalClaimed,
      summary: {
        totalRewards: rewards.length,
        unclaimedCount: claimable.length,
        claimedCount: claimed.length
      }
    });

  } catch (error: any) {
    console.error("Get rewards error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to get rewards" 
    }, { status: 500 });
  }
}
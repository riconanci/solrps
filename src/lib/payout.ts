// src/lib/payout.ts
export function calcPot(rounds: number, stakePerRound: number) {
  return rounds * stakePerRound * 2;
}

export function calcFees(pot: number) {
  const totalFees = Math.floor(pot * 0.05); // 5% total fees
  const burn = Math.floor(pot * 0.02); // 2% burn
  const treasury = Math.floor(pot * 0.02); // 2% treasury  
  const dev = Math.floor(pot * 0.01); // 1% dev
  const weeklyRewards = treasury; // The 2% treasury becomes weekly rewards pool
  
  return { 
    totalFees, 
    burn, 
    treasury, 
    dev, 
    weeklyRewards 
  };
}

export function payoutFromPot(pot: number) {
  const { totalFees, burn, treasury, dev, weeklyRewards } = calcFees(pot);
  return { 
    payoutWinner: pot - totalFees, 
    feesBurn: burn, 
    feesTreasury: treasury, 
    feesDev: dev,
    feesWeeklyRewards: weeklyRewards
  };
}

// Weekly reward distribution percentages
export const WEEKLY_REWARD_DISTRIBUTION = [
  50, // 1st: 50%
  20, // 2nd: 20% 
  10, // 3rd: 10%
  5,  // 4th: 5%
  5,  // 5th: 5%
  2,  // 6th: 2%
  2,  // 7th: 2%
  2,  // 8th: 2%
  2,  // 9th: 2%
  2   // 10th: 2%
]; // Total: 100%

export function calculateWeeklyRewardDistribution(totalPool: number): number[] {
  return WEEKLY_REWARD_DISTRIBUTION.map(percentage => 
    Math.floor(totalPool * percentage / 100)
  );
}
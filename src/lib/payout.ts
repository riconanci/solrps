export function calcPot(rounds: number, stakePerRound: number) {
  return rounds * stakePerRound * 2;
}

export function calcFees(pot: number) {
  const fees = Math.floor(pot * 0.10);
  const treasury = Math.floor(pot * 0.05);
  const burn = fees - treasury; // ensure 10% total
  return { fees, treasury, burn };
}

export function payoutFromPot(pot: number) {
  const { fees, treasury, burn } = calcFees(pot);
  return { payoutWinner: pot - fees, feesTreasury: treasury, feesBurn: burn };
}
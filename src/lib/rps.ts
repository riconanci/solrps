// src/lib/rps.ts
import type { Move } from "@/lib/hash";

export type RoundWinner = "A" | "B" | "DRAW";

export function judgeRound(a: Move, b: Move): RoundWinner {
  if (a === b) return "DRAW";
  if ((a === "R" && b === "S") || (a === "P" && b === "R") || (a === "S" && b === "P")) return "A";
  return "B";
}

export function tallyOutcome(aMoves: Move[], bMoves: Move[]) {
  let aWins = 0;
  let bWins = 0; 
  let draws = 0;
  
  const outcomes: { round: number; a: Move; b: Move; winner: RoundWinner }[] = [];
  
  for (let i = 0; i < aMoves.length; i++) {
    const winner = judgeRound(aMoves[i], bMoves[i]);
    outcomes.push({ 
      round: i + 1, 
      a: aMoves[i], 
      b: bMoves[i], 
      winner 
    });
    
    if (winner === "A") aWins++;
    else if (winner === "B") bWins++;
    else draws++;
  }
  
  const overall = aWins === bWins ? "DRAW" : aWins > bWins ? "CREATOR" : "CHALLENGER";
  
  return { 
    outcomes, 
    aWins, 
    bWins, 
    draws, 
    overall 
  } as const;
}
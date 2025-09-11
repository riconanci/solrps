// tests/api/session.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { judgeRound, tallyOutcome } from "@/lib/rps";
import { calcPot, payoutFromPot } from "@/lib/payout";
import { hashCommit, verifyCommit, type Move } from "@/lib/hash";

describe("RPS Game Logic", () => {
  it("judges rounds correctly", () => {
    expect(judgeRound("R", "S")).toBe("A"); // Rock beats Scissors
    expect(judgeRound("S", "R")).toBe("B"); // Scissors loses to Rock
    expect(judgeRound("P", "P")).toBe("DRAW"); // Paper ties Paper
    expect(judgeRound("P", "R")).toBe("A"); // Paper beats Rock
    expect(judgeRound("S", "P")).toBe("A"); // Scissors beats Paper
  });

  it("tallies outcomes correctly", () => {
    const result = tallyOutcome(["R", "P", "S"], ["S", "S", "S"]);
    expect(result.aWins).toBe(2); // R beats S, P beats S
    expect(result.bWins).toBe(1); // S beats S is a draw, so B wins the last round
    expect(result.draws).toBe(0);
    expect(result.overall).toBe("CREATOR");
  });

  it("tallies draws correctly", () => {
    const result = tallyOutcome(["R", "P"], ["S", "R"]);
    expect(result.aWins).toBe(1); // R beats S
    expect(result.bWins).toBe(1); // R beats P
    expect(result.draws).toBe(0);
    expect(result.overall).toBe("DRAW");
  });
});

describe("Payout Logic", () => {
  it("calculates pot correctly", () => {
    expect(calcPot(3, 100)).toBe(600); // 3 rounds * 100 per round * 2 players
    expect(calcPot(1, 500)).toBe(1000);
    expect(calcPot(5, 1000)).toBe(10000);
  });

  it("calculates payouts correctly", () => {
    const pot = 1000;
    const result = payoutFromPot(pot);
    
    expect(result.feesTreasury).toBe(50); // 5% treasury
    expect(result.feesBurn).toBe(50); // 5% burn
    expect(result.payoutWinner).toBe(900); // 90% to winner
    expect(result.feesTreasury + result.feesBurn + result.payoutWinner).toBe(pot);
  });
});

describe("Hash Commit Logic", () => {
  it("creates and verifies commits", () => {
    const moves: Move[] = ["R", "P", "S"];
    const salt = "test123";
    
    const hash = hashCommit(moves, salt);
    expect(hash).toHaveLength(64); // SHA-256 hex string
    
    const isValid = verifyCommit(hash, moves, salt);
    expect(isValid).toBe(true);
    
    const isInvalid = verifyCommit(hash, moves, "wrong_salt");
    expect(isInvalid).toBe(false);
  });

  it("produces different hashes for different inputs", () => {
    const moves1: Move[] = ["R", "P", "S"];
    const moves2: Move[] = ["S", "P", "R"];
    const salt = "test123";
    
    const hash1 = hashCommit(moves1, salt);
    const hash2 = hashCommit(moves2, salt);
    
    expect(hash1).not.toBe(hash2);
  });
});
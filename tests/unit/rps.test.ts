import { describe, it, expect } from "vitest";
import { judgeRound, tallyOutcome } from "@/lib/rps";

describe("RPS", () => {
  it("judges correctly", () => {
    expect(judgeRound("R", "S")).toBe("A");
    expect(judgeRound("S", "R")).toBe("B");
    expect(judgeRound("P", "P")).toBe("DRAW");
  });

  it("tallies", () => {
    const t = tallyOutcome(["R","P","S"], ["S","S","S"]);
    expect(t.aWins).toBe(2);
    expect(t.bWins).toBe(1);
    expect(t.overall).toBe("CREATOR");
  });
});
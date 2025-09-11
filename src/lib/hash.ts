import crypto from "crypto";

export type Move = "R" | "P" | "S";

export function encodeMoves(moves: Move[]): string {
  return moves.join(",");
}

export function hashCommit(moves: Move[], salt: string): string {
  const preimage = `${encodeMoves(moves)}|${salt}`;
  return crypto.createHash("sha256").update(preimage).digest("hex");
}

export function verifyCommit(storedCommit: string, moves: Move[], salt: string) {
  return storedCommit === hashCommit(moves, salt);
}
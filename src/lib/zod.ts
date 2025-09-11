import { z } from "zod";

export const moveSchema = z.enum(["R", "P", "S"]);
export const movesArraySchema = z.array(moveSchema).min(1).max(5);

export const createSessionSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  stakePerRound: z.union([z.literal(100), z.literal(500), z.literal(1000)]),
  commitHash: z.string().length(64),
  saltLength: z.number().int().positive().optional(),
  isPrivate: z.boolean().optional(),
});

export const joinSessionSchema = z.object({
  sessionId: z.string(),
  challengerMoves: movesArraySchema,
});

export const revealSchema = z.object({
  sessionId: z.string(),
  moves: movesArraySchema,
  salt: z.string().min(1),
});

export const forfeitSchema = z.object({ sessionId: z.string() });
export const cancelSchema = z.object({ sessionId: z.string() });
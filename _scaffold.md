# SolRPS – Rock‑Paper‑Scissors P2E on Solana (V1: Mock Escrow)

> Directory: `C:\dev\solrps`

Below is a full repository scaffold you can paste into your project. Files are separated by headings with their intended paths. After creating files, run the setup steps in **README.md** at the bottom.

---

## package.json
```json
{
  "name": "solrps",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts",
    "test": "vitest run",
    "test:ui": "vitest"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@tanstack/react-query": "^5.51.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-hook-form": "^7.53.0",
    "tailwind-merge": "^2.5.2",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^4.5.4",
    "@prisma/client": "^5.17.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.11",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^9.9.0",
    "eslint-config-next": "^15.0.0-canary.73",
    "postcss": "^8.4.40",
    "prettier": "^3.3.3",
    "prisma": "^5.17.0",
    "tailwindcss": "^3.4.10",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

---

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "paths": {
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"]
    },
    "types": ["vitest/globals"]
  },
  "exclude": ["node_modules"],
  "include": ["src", "app", "pages", "prisma", "next-env.d.ts", "vitest.config.ts"]
}
```

---

## next.config.mjs
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
};
export default nextConfig;
```

---

## postcss.config.mjs
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## tailwind.config.ts
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

---

## .env.example
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/solrps?schema=public"
TREASURY_ADDRESS="TREASURY_MOCK"
BURN_ADDRESS="BURN_MOCK"
REVEAL_DEADLINE_SECONDS=600
```

---

## prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SessionStatus {
  OPEN
  LOCKED
  AWAITING_REVEAL
  RESOLVED
  FORFEITED
  CANCELLED
}

enum OverallOutcome {
  CREATOR
  CHALLENGER
  DRAW
}

model User {
  id           String   @id @default(cuid())
  createdAt    DateTime @default(now())
  displayName  String?
  walletPubkey String?
  mockBalance  Int      @default(100000)
  // Relations
  sessions     Session[] @relation("creatorSessions")
  challenges   Session[] @relation("challengerSessions")
  matches      MatchResult[]
}

model Session {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  status          SessionStatus
  rounds          Int
  stakePerRound   Int
  totalStake      Int
  commitHash      String
  saltHint        String?
  creatorId       String
  creator         User     @relation("creatorSessions", fields: [creatorId], references: [id])
  challengerId    String?
  challenger      User?    @relation("challengerSessions", fields: [challengerId], references: [id])
  creatorRevealed Boolean  @default(false)
  revealDeadline  DateTime
  isPrivate       Boolean  @default(false)
  privateCode     String?  @unique
  creatorMoves    Json?
  challengerMoves Json?
  result          MatchResult?
}

model MatchResult {
  id             String   @id @default(cuid())
  sessionId      String   @unique
  session        Session  @relation(fields: [sessionId], references: [id])
  createdAt      DateTime @default(now())
  roundsOutcome  Json
  creatorWins    Int
  challengerWins Int
  draws          Int
  overall        OverallOutcome
  pot            Int
  feesTreasury   Int
  feesBurn       Int
  payoutWinner   Int
  winnerUserId   String?
  replaySeed     String?
}
```

---

## prisma/seed.ts
```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [alice, bob] = await Promise.all([
    prisma.user.upsert({
      where: { id: "seed_alice" },
      update: {},
      create: { id: "seed_alice", displayName: "Alice", mockBalance: 500000 },
    }),
    prisma.user.upsert({
      where: { id: "seed_bob" },
      update: {},
      create: { id: "seed_bob", displayName: "Bob", mockBalance: 500000 },
    }),
  ]);

  // Example open sessions by Alice
  await prisma.session.createMany({
    data: [
      {
        status: "OPEN",
        rounds: 3,
        stakePerRound: 100,
        totalStake: 300,
        commitHash: "DEMO_COMMIT",
        saltHint: "8",
        creatorId: alice.id,
        revealDeadline: new Date(Date.now() + 1000 * 60 * 30),
        isPrivate: false,
      },
    ],
  });
}

main().finally(async () => prisma.$disconnect());
```

---

## src/lib/db.ts
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## src/lib/hash.ts
```ts
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
```

---

## src/lib/rps.ts
```ts
import type { Move } from "@/lib/hash";

export type RoundWinner = "A" | "B" | "DRAW";

export function judgeRound(a: Move, b: Move): RoundWinner {
  if (a === b) return "DRAW";
  if ((a === "R" && b === "S") || (a === "P" && b === "R") || (a === "S" && b === "P")) return "A";
  return "B";
}

export function tallyOutcome(aMoves: Move[], bMoves: Move[]) {
  let aWins = 0, bWins = 0, draws = 0;
  const outcomes: { round: number; a: Move; b: Move; winner: RoundWinner }[] = [];
  for (let i = 0; i < aMoves.length; i++) {
    const w = judgeRound(aMoves[i], bMoves[i]);
    outcomes.push({ round: i + 1, a: aMoves[i], b: bMoves[i], winner: w });
    if (w === "A") aWins++; else if (w === "B") bWins++; else draws++;
  }
  const overall = aWins === bWins ? "DRAW" : aWins > bWins ? "CREATOR" : "CHALLENGER";
  return { outcomes, aWins, bWins, draws, overall } as const;
}
```

---

## src/lib/payout.ts
```ts
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
```

---

## src/lib/env.ts
```ts
export const REVEAL_DEADLINE_SECONDS = Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600);
export const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS ?? "TREASURY_MOCK";
export const BURN_ADDRESS = process.env.BURN_ADDRESS ?? "BURN_MOCK";
```

---

## src/lib/zod.ts
```ts
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
```

---

## src/state/wallet.ts (Zustand mock wallet)
```ts
import { create } from "zustand";

type WalletState = {
  userId?: string;
  balance: number;
  connect: (userId: string, balance: number) => void;
  setBalance: (n: number) => void;
};

export const useWallet = create<WalletState>((set) => ({
  userId: undefined,
  balance: 0,
  connect: (userId, balance) => set({ userId, balance }),
  setBalance: (n) => set({ balance: n }),
}));
```

---

## app/layout.tsx
```tsx
import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-6xl p-4">{children}</div>
      </body>
    </html>
  );
}
```

---

## app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## app/page.tsx (Landing)
```tsx
import Link from "next/link";

export default function Landing() {
  return (
    <main className="grid place-items-center py-24 text-center">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">SolRPS</h1>
        <p className="text-neutral-300">Rock–Paper–Scissors on Solana — V1 with mock escrow & commit–reveal.</p>
        <Link href="/play" className="inline-block rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20">Play</Link>
      </div>
    </main>
  );
}
```

---

## app/play/page.tsx (Lobby + Create)
```tsx
"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@/state/wallet";

type SessionCard = {
  id: string; creator: string; rounds: number; stakePerRound: number; totalStake: number; age: string;
};

export default function PlayPage() {
  const { userId, balance, connect } = useWallet();
  const [lobby, setLobby] = useState<SessionCard[]>([]);

  useEffect(() => {
    // Auto-connect to a seed user for demo
    if (!userId) connect("seed_alice", 500000);
    fetchLobby();
  }, []);

  async function fetchLobby() {
    const res = await fetch("/api/lobby");
    const data = await res.json();
    setLobby(data.items);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section>
        <h2 className="mb-2 text-xl font-semibold">Open Sessions</h2>
        <div className="space-y-2">
          {lobby.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-300">Creator: {s.creator}</div>
                  <div className="text-sm">{s.rounds} rounds • {s.stakePerRound}/rd • Total {s.totalStake}</div>
                  <div className="text-xs text-neutral-400">Age: {s.age}</div>
                </div>
                <button className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">Join</button>
              </div>
            </div>
          ))}
          {lobby.length === 0 && <div className="text-sm text-neutral-400">No open sessions yet.</div>}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">Create Session</h2>
        <CreateSessionForm onCreated={fetchLobby} />
        <div className="mt-6 text-sm text-neutral-400">Balance: {balance}</div>
      </section>
    </div>
  );
}

function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const [rounds, setRounds] = useState(3);
  const [stake, setStake] = useState(100);
  const [moves, setMoves] = useState<string>("R,P,R");
  const [salt, setSalt] = useState<string>(Math.random().toString(36).slice(2, 10));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds, stakePerRound: stake, commitHash: await prehash(moves, salt) }),
    });
    if (res.ok) onCreated();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Rounds
          <select className="mt-1 w-full rounded bg-white/10 p-2" value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
            {[1,3,5].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-sm">Stake/round
          <select className="mt-1 w-full rounded bg-white/10 p-2" value={stake} onChange={(e) => setStake(Number(e.target.value))}>
            {[100,500,1000].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">Your moves (comma, e.g. R,P,S)
        <input className="mt-1 w-full rounded bg-white/10 p-2" value={moves} onChange={(e)=>setMoves(e.target.value)} />
      </label>
      <label className="block text-sm">Salt
        <input className="mt-1 w-full rounded bg-white/10 p-2" value={salt} onChange={(e)=>setSalt(e.target.value)} />
      </label>
      <button className="w-full rounded-lg bg-white/10 py-2 hover:bg-white/20">Create</button>
      <p className="text-xs text-neutral-400">Keep your salt & moves safe; you'll need them to reveal.</p>
    </form>
  );
}

async function prehash(moves: string, salt: string) {
  const preimage = `${moves}|${salt}`;
  const enc = new TextEncoder().encode(preimage);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
```

---

## app/api/_utils.ts (helper to get user + transactional)
```ts
import { prisma } from "@/lib/db";

export async function getUserOrSeed() {
  // In V1, always return seed user Alice for simplicity. Replace with auth later.
  const user = await prisma.user.findUnique({ where: { id: "seed_alice" } });
  if (!user) throw new Error("Seed user missing. Run db:seed.");
  return user;
}
```

---

## app/api/lobby/route.ts (GET)
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";

export async function GET() {
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { creator: true },
  });
  const items = sessions.map((s) => ({
    id: s.id,
    creator: s.creator.displayName ?? s.creatorId.slice(0, 6),
    rounds: s.rounds,
    stakePerRound: s.stakePerRound,
    totalStake: s.totalStake,
    age: formatDistanceToNowStrict(s.createdAt, { addSuffix: true }),
  }));
  return NextResponse.json({ items });
}
```

---

## app/api/session/create/route.ts (POST)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionSchema } from "@/lib/zod";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { rounds, stakePerRound, commitHash, isPrivate } = parsed.data;
  const total = rounds * stakePerRound;

  const user = await getUserOrSeed();

  // Mock escrow: debit user.mockBalance by total and hold implicitly by Session.totalStake
  if (user.mockBalance < total) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

  const session = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: user.id }, data: { mockBalance: { decrement: total } } });
    const s = await tx.session.create({
      data: {
        status: "OPEN",
        rounds,
        stakePerRound,
        totalStake: total,
        commitHash,
        creatorId: updated.id,
        revealDeadline: new Date(Date.now() + Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600) * 1000),
        isPrivate: !!isPrivate,
      },
    });
    return s;
  });

  return NextResponse.json({ id: session.id });
}
```

---

## app/api/session/join/route.ts (POST)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { joinSessionSchema } from "@/lib/zod";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = joinSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId, challengerMoves } = parsed.data;
  const user = await getUserOrSeed();

  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "OPEN") throw new Error("Session not open");
    if (s.creatorId === user.id) throw new Error("Cannot join own session");
    if (challengerMoves.length !== s.rounds) throw new Error("Moves length mismatch");

    if ((await tx.user.findUnique({ where: { id: user.id } }))!.mockBalance < s.totalStake)
      throw new Error("Insufficient balance");

    await tx.user.update({ where: { id: user.id }, data: { mockBalance: { decrement: s.totalStake } } });

    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: "AWAITING_REVEAL",
        challengerId: user.id,
        challengerMoves: challengerMoves,
        revealDeadline: new Date(Date.now() + Number(process.env.REVEAL_DEADLINE_SECONDS ?? 600) * 1000),
      },
    });

    return updated;
  });

  return NextResponse.json({ id: result.id, status: result.status });
}
```

---

## app/api/session/reveal/route.ts (POST)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revealSchema } from "@/lib/zod";
import { verifyCommit } from "@/lib/hash";
import { tallyOutcome } from "@/lib/rps";
import { payoutFromPot, calcPot } from "@/lib/payout";
import { getUserOrSeed } from "../../_utils";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = revealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId, moves, salt } = parsed.data;
  const me = await getUserOrSeed();

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
    if (s.creatorId !== me.id) throw new Error("Only creator can reveal");
    if (!s.challengerId || !s.challengerMoves) throw new Error("No challenger");

    // Verify commit
    const ok = verifyCommit(s.commitHash, moves as any, salt);
    if (!ok) throw new Error("Commit mismatch");

    // Judge
    const { outcomes, aWins, bWins, draws, overall } = tallyOutcome(moves as any, s.challengerMoves as any);
    const pot = calcPot(s.rounds, s.stakePerRound);

    let feesTreasury = 0, feesBurn = 0, payoutWinner = 0, winnerUserId: string | undefined;

    if (overall === "DRAW") {
      // Refund both sides fully; no fees
      await tx.user.update({ where: { id: s.creatorId }, data: { mockBalance: { increment: s.totalStake } } });
      await tx.user.update({ where: { id: s.challengerId! }, data: { mockBalance: { increment: s.totalStake } } });
    } else {
      const { payoutWinner: pay, feesTreasury: t, feesBurn: b } = payoutFromPot(pot);
      feesTreasury = t; feesBurn = b; payoutWinner = pay;
      winnerUserId = overall === "CREATOR" ? s.creatorId : s.challengerId!;
      await tx.user.update({ where: { id: winnerUserId }, data: { mockBalance: { increment: pay } } });
      // fees -> mocked (no balance change)
    }

    const res = await tx.matchResult.create({
      data: {
        sessionId: s.id,
        roundsOutcome: outcomes,
        creatorWins: aWins,
        challengerWins: bWins,
        draws,
        overall,
        pot,
        feesTreasury,
        feesBurn,
        payoutWinner,
        winnerUserId,
      },
    });

    await tx.session.update({ where: { id: s.id }, data: { status: "RESOLVED", creatorRevealed: true, creatorMoves: moves } });

    return { resultId: res.id, overall, payoutWinner };
  });

  return NextResponse.json(out);
}
```

---

## app/api/session/forfeit/route.ts (POST)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forfeitSchema } from "@/lib/zod";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = forfeitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId } = parsed.data;

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "AWAITING_REVEAL") throw new Error("Not awaiting reveal");
    if (new Date() < s.revealDeadline) throw new Error("Deadline not reached");

    // Challenger wins by forfeit – apply fees
    const pot = s.rounds * s.stakePerRound * 2;
    const fees = Math.floor(pot * 0.10);
    const payoutWinner = pot - fees;

    if (!s.challengerId) throw new Error("No challenger");

    await tx.user.update({ where: { id: s.challengerId }, data: { mockBalance: { increment: payoutWinner } } });

    await tx.matchResult.create({
      data: {
        sessionId: s.id,
        roundsOutcome: [],
        creatorWins: 0,
        challengerWins: 0,
        draws: 0,
        overall: "CHALLENGER",
        pot,
        feesTreasury: Math.floor(pot * 0.05),
        feesBurn: Math.ceil(pot * 0.05),
        payoutWinner,
        winnerUserId: s.challengerId,
      },
    });

    await tx.session.update({ where: { id: s.id }, data: { status: "FORFEITED" } });

    return { status: "FORFEITED" };
  });

  return NextResponse.json(out);
}
```

---

## app/api/session/cancel/route.ts (POST)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cancelSchema } from "@/lib/zod";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId } = parsed.data;

  const out = await prisma.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error("Session not found");
    if (s.status !== "OPEN") throw new Error("Only OPEN can be canceled");

    await tx.user.update({ where: { id: s.creatorId }, data: { mockBalance: { increment: s.totalStake } } });
    await tx.session.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
    return { status: "CANCELLED" };
  });

  return NextResponse.json(out);
}
```

---

## app/api/session/[id]/route.ts (GET details)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await prisma.session.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Hide creatorMoves until revealed
  const { creatorMoves, ...rest } = s as any;
  return NextResponse.json({ ...rest, creatorMoves: s.creatorRevealed ? creatorMoves : undefined });
}
```

---

## app/api/me/matches/route.ts (GET)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserOrSeed } from "../../_utils";

export async function GET() {
  const me = await getUserOrSeed();
  const matches = await prisma.matchResult.findMany({
    where: { OR: [{ winnerUserId: me.id }, { session: { creatorId: me.id } }, { session: { challengerId: me.id } }] },
    orderBy: { createdAt: "desc" },
    include: { session: true },
  });
  return NextResponse.json({ items: matches });
}
```

---

## app/api/leaderboard/route.ts (GET weekly)
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.matchResult.groupBy({
    by: ["winnerUserId"],
    where: { createdAt: { gte: weekAgo }, payoutWinner: { gt: 0 }, winnerUserId: { not: null } },
    _sum: { payoutWinner: true },
    _count: { _all: true },
  });
  return NextResponse.json({
    items: rows.map((r) => ({ userId: r.winnerUserId, total: r._sum.payoutWinner ?? 0, wins: r._count._all })),
  });
}
```

---

## tests/unit/rps.test.ts
```ts
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
```

---

## vitest.config.ts
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

---

## README.md
```md
# SolRPS (V1 Mock Escrow)

**Project**: Rock–Paper–Scissors P2E on Solana

**Directory**: `C:\\dev\\solrps`

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (Supabase ok) – mock escrow via `User.mockBalance`
- Zod‑validated API route handlers
- Zustand for client wallet mock; React Query ready (can be added)
- Vitest unit tests

## Install & Run
```bash
pnpm i # or npm i / yarn
pnpm db:push
pnpm db:seed
pnpm dev
```
Open http://localhost:3000

## Env
Copy `.env.example` to `.env.local` and set `DATABASE_URL` etc.

## Flows
- Create session: commits moves via SHA‑256 (client demo) and debits creator balance.
- Join session: challenger locks stake; session → AWAITING_REVEAL.
- Reveal: verifies commit, judges, calculates fees (5% treasury + 5% burn), pays winner or refunds on draw.
- Forfeit: after deadline, challenger can claim pot minus fees.
- Cancel: creator may cancel OPEN session only; full refund.

## Future (Phase 2 – Solana)
Replace mock escrow with on‑chain program (Anchor); wallet‑adapter (Phantom); SPL token mint; on‑chain SHA‑256; fee splits to Treasury & Burn accounts.

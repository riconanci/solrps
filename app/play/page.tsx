"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/state/wallet";

type SessionCard = {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  age: string;
};

const ROUND_CHOICES = [1, 3, 5] as const;
const STAKE_CHOICES = [100, 500, 1000] as const;
const MOVE_CHOICES = ["R", "P", "S"] as const;
type Move = (typeof MOVE_CHOICES)[number];

export default function PlayPage() {
  const { userId, balance, connect } = useWallet();
  const [lobby, setLobby] = useState<SessionCard[]>([]);

  useEffect(() => {
    if (!userId) connect("seed_alice", 500000);
    fetchLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLobby() {
    const res = await fetch("/api/lobby");
    const data = await res.json();
    setLobby(data.items);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Create Session</h2>
        <CreateSessionForm onCreated={fetchLobby} />
        <div className="mt-4 text-sm text-neutral-400">Balance: {balance}</div>
        <p className="mt-3 text-xs text-neutral-500">
          <strong>Salt</strong> is auto-generated and stored locally so you don’t
          have to remember it. It’s only revealed when you reveal your moves.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Open Sessions</h2>
        <div className="space-y-2">
          {lobby.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-300">Creator: {s.creator}</div>
                  <div className="text-sm">
                    {s.rounds} rounds • {s.stakePerRound}/rd • Total {s.totalStake}
                  </div>
                  <div className="text-xs text-neutral-400">Age: {s.age}</div>
                </div>
                <button className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">
                  Join
                </button>
              </div>
            </div>
          ))}
          {lobby.length === 0 && (
            <div className="text-sm text-neutral-400">No open sessions yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const [rounds, setRounds] = useState<(typeof ROUND_CHOICES)[number]>(3);
  const [stake, setStake] = useState<(typeof STAKE_CHOICES)[number]>(100);
  const [moves, setMoves] = useState<Move[]>(["R", "P", "S", "R", "P"]);

  const [salt] = useState<string>(() => cryptoRandomString(16)); // auto
  const activeMoves = useMemo(() => moves.slice(0, rounds), [moves, rounds]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const commitHash = await prehash(activeMoves.join(","), salt);
    const res = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds, stakePerRound: stake, commitHash }),
    });
    if (!res.ok) return;
    const { id } = await res.json();
    // Save salt & moves locally for auto-reveal later
    const { saveSecret } = await import("@/lib/secret").catch(() => ({ saveSecret: undefined as any }));
    if (saveSecret) saveSecret(id, { salt, moves: activeMoves as string[] });
    onCreated();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 p-4">
      {/* Rounds buttons */}
      <div>
        <div className="mb-2 text-sm font-medium">Rounds</div>
        <div className="flex gap-2">
          {ROUND_CHOICES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRounds(r)}
              className={
                "rounded-lg px-3 py-1 border " +
                (rounds === r ? "bg-white/20 border-white/30" : "bg-white/10 border-white/10 hover:bg-white/15")
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stake buttons */}
      <div>
        <div className="mb-2 text-sm font-medium">Stake / round</div>
        <div className="flex gap-2">
          {STAKE_CHOICES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStake(s)}
              className={
                "rounded-lg px-3 py-1 border " +
                (stake === s ? "bg-white/20 border-white/30" : "bg-white/10 border-white/10 hover:bg-white/15")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Per-round R/P/S with greying beyond selected rounds */}
      <div>
        <div className="mb-2 text-sm font-medium">Your Moves</div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, idx) => {
            const roundNum = idx + 1;
            const active = roundNum <= rounds;
            const current = moves[idx];
            return (
              <div
                key={idx}
                className={
                  "flex items-center justify-between rounded-lg border px-3 py-2 " +
                  (active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.03] opacity-50")
                }
              >
                <div className="text-sm">Round {roundNum}</div>
                <div className="flex gap-2">
                  {MOVE_CHOICES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!active}
                      onClick={() => {
                        const next = moves.slice();
                        next[idx] = m;
                        setMoves(next);
                      }}
                      className={
                        "rounded-md px-3 py-1 border " +
                        (current === m && active ? "bg-white/20 border-white/30" : "bg-white/10 border-white/10 hover:bg-white/15")
                      }
                    >
                      {labelMove(m)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Only the first <strong>{rounds}</strong> round(s) are active; others are greyed out.
        </p>
      </div>

      {/* Summary + submit */}
      <div className="flex items-center justify-between text-sm text-neutral-300">
        <div>
          <div>Rounds: {rounds}</div>
          <div>Stake/round: {stake}</div>
          <div>Total to lock now: {rounds * stake}</div>
        </div>
        <button className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20">Create Session</button>
      </div>
    </form>
  );
}

function labelMove(m: Move) {
  if (m === "R") return "Rock";
  if (m === "P") return "Paper";
  return "Scissors";
}

function cryptoRandomString(len: number) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function prehash(movesCsv: string, salt: string) {
  const preimage = `${movesCsv}|${salt}`;
  const enc = new TextEncoder().encode(preimage);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

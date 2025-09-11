// app/play/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [balance, setBalance] = useState(500000); // Mock balance
  const [mySessions, setMySessions] = useState<SessionCard[]>([]);

  useEffect(() => {
    fetchMySessions();
  }, []);

  async function fetchMySessions() {
    try {
      const res = await fetch("/api/lobby");
      if (res.ok) {
        const data = await res.json();
        // Filter to show only sessions created by current user (Alice)
        const myCreatedSessions = (data.items || []).filter((s: SessionCard) => s.creator === "Alice");
        setMySessions(myCreatedSessions);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Create New Match</h2>
          <CreateSessionForm onCreated={fetchMySessions} />
          <div className="mt-4 text-sm text-neutral-400">Balance: {balance.toLocaleString()}</div>
          <p className="mt-3 text-xs text-neutral-500">
            <strong>Salt</strong> is auto-generated and stored locally so you don't
            have to remember it. It's only revealed when you reveal your moves.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">My Created Sessions</h2>
          <div className="space-y-2">
            {mySessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-neutral-300">Status: Waiting for opponent</div>
                    <div className="text-sm">
                      {s.rounds} rounds • {s.stakePerRound}/rd • Total {s.totalStake}
                    </div>
                    <div className="text-xs text-neutral-400">Created: {s.age}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-green-400 font-mono">
                      {s.totalStake * 2} pot
                    </div>
                    <div className="text-xs text-neutral-400">
                      Awaiting join
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {mySessions.length === 0 && (
              <div className="text-sm text-neutral-400">No sessions created yet.</div>
            )}
          </div>
          
          {mySessions.length > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300">
                💡 <strong>Tip:</strong> Share the lobby link with friends, or wait for random opponents to join your sessions!
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const [rounds, setRounds] = useState<(typeof ROUND_CHOICES)[number]>(3);
  const [stake, setStake] = useState<(typeof STAKE_CHOICES)[number]>(100);
  const [moves, setMoves] = useState<Move[]>(["R", "P", "S", "R", "P"]);
  const [creating, setCreating] = useState(false);

  const [salt] = useState<string>(() => cryptoRandomString(16)); // auto
  const activeMoves = useMemo(() => moves.slice(0, rounds), [moves, rounds]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    
    try {
      const commitHash = await prehash(activeMoves.join(","), salt);
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rounds, stakePerRound: stake, commitHash }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to create session");
        return;
      }
      
      const { id } = await res.json();
      // Save salt & moves locally for auto-reveal later
      saveSecret(id, { salt, moves: activeMoves as string[] });
      onCreated();
    } catch (error) {
      console.error("Create session error:", error);
      alert("Failed to create session");
    } finally {
      setCreating(false);
    }
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
                (rounds === r 
                  ? "bg-white/20 border-white/30" 
                  : "bg-white/10 border-white/10 hover:bg-white/15")
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stakes buttons */}
      <div>
        <div className="mb-2 text-sm font-medium">Stake per round</div>
        <div className="flex gap-2">
          {STAKE_CHOICES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStake(s)}
              className={
                "rounded-lg px-3 py-1 border " +
                (stake === s 
                  ? "bg-white/20 border-white/30" 
                  : "bg-white/10 border-white/10 hover:bg-white/15")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Moves selector with emojis */}
      <div>
        <div className="mb-2 text-sm font-medium">Your moves (first {rounds} active)</div>
        <div className="space-y-2">
          {moves.map((m, i) => {
            const isActive = i < rounds;
            return (
              <div key={i} className={`flex gap-2 items-center ${isActive ? "" : "opacity-30"}`}>
                <div className="text-xs text-neutral-400 w-12">#{i + 1}:</div>
                <div className="flex gap-1">
                  {MOVE_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      disabled={!isActive}
                      onClick={() => {
                        const newMoves = [...moves];
                        newMoves[i] = choice;
                        setMoves(newMoves);
                      }}
                      className={
                        "rounded-lg border w-12 h-12 flex items-center justify-center text-xl " +
                        (m === choice && isActive
                          ? "bg-white/20 border-white/30"
                          : "bg-white/10 border-white/10 hover:bg-white/15")
                      }
                    >
                      {getMoveEmoji(choice)}
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
        <button 
          disabled={creating}
          className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Session"}
        </button>
      </div>
    </form>
  );
}

function getMoveEmoji(m: Move) {
  if (m === "R") return "🪨";
  if (m === "P") return "📄";
  return "✂️";
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

function saveSecret(sessionId: string, secret: { salt: string; moves: string[] }) {
  try {
    localStorage.setItem(`solrps_secret_${sessionId}`, JSON.stringify(secret));
  } catch (e) {
    console.error("Failed to save secret:", e);
  }
}
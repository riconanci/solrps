// app/play/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../../src/state/wallet";

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
  const { userId, balance } = useWallet();
  const [mySessions, setMySessions] = useState<SessionCard[]>([]);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchMySessions();
  }, [userId]);

  async function fetchMySessions() {
    try {
      const res = await fetch("/api/lobby");
      if (res.ok) {
        const data = await res.json();
        // Filter to show only sessions created by current user
        const currentUser = userId || "seed_alice";
        const myCreatedSessions = (data.items || []).filter((s: SessionCard) => {
          // Match by creator name or ID
          return s.creator === currentUser || 
                 (currentUser === "seed_alice" && s.creator === "Alice") ||
                 (currentUser === "seed_bob" && s.creator === "Bob");
        });
        setMySessions(myCreatedSessions);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  async function copySessionId(sessionId: string) {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopiedSessionId(sessionId);
      setTimeout(() => setCopiedSessionId(null), 2000); // Clear after 2 seconds
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = sessionId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      
      setCopiedSessionId(sessionId);
      setTimeout(() => setCopiedSessionId(null), 2000);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Create New Match</h2>
          <CreateSessionForm onCreated={fetchMySessions} />
          <div className="mt-4 text-sm text-neutral-400">
            Balance: {(balance || 0).toLocaleString()} tokens
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            <strong>Salt</strong> is auto-generated and stored locally so you don't
            have to remember it. It's only revealed when you reveal your moves.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">My Created Sessions</h2>
          <div className="space-y-3">
            {mySessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">
                        WAITING
                      </span>
                      <span className="text-sm text-neutral-300">for opponent</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>{s.rounds} rounds • {s.stakePerRound} tokens/round</div>
                      <div>Total stake: {s.totalStake} tokens</div>
                      <div className="text-xs text-neutral-400">Created: {s.age}</div>
                    </div>
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
                
                {/* Session Key with Copy Button */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-neutral-400 mb-2">Session Key:</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copySessionId(s.id)}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0
                        ${copiedSessionId === s.id 
                          ? "bg-green-600 text-white" 
                          : "bg-purple-600 hover:bg-purple-700 text-white"
                        }
                      `}
                    >
                      {copiedSessionId === s.id ? (
                        <>✅ Copied!</>
                      ) : (
                        <>📋 Copy</>
                      )}
                    </button>
                    <div className="text-xs font-mono bg-white/5 p-2 rounded border border-white/10 break-all flex-1">
                      {s.id}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {mySessions.length === 0 && (
              <div className="text-sm text-neutral-400 p-4 text-center border border-white/10 rounded-lg">
                No sessions created yet. Create your first game above!
              </div>
            )}
          </div>
          
          {mySessions.length > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300">
                💡 <strong>Tip:</strong> Copy the session key and share it with friends for private games, 
                or wait for random opponents in the public lobby!
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const { userId } = useWallet();
  const [rounds, setRounds] = useState<(typeof ROUND_CHOICES)[number]>(3);
  const [stake, setStake] = useState<(typeof STAKE_CHOICES)[number]>(100);
  const [moves, setMoves] = useState<Move[]>(["R", "P", "S", "R", "P"]);
  const [creating, setCreating] = useState(false);

  const [salt] = useState<string>(() => cryptoRandomString(16)); // auto-generated
  const activeMoves = useMemo(() => moves.slice(0, rounds), [moves, rounds]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    
    try {
      const commitHash = await prehash(activeMoves.join(","), salt);
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          rounds, 
          stakePerRound: stake, 
          commitHash,
          userId: userId || "seed_alice" // Include user ID
        }),
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 p-4 bg-white/5">
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
                "rounded-lg px-3 py-2 border transition-colors " +
                (rounds === r 
                  ? "bg-blue-600 border-blue-500 text-white" 
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
                "rounded-lg px-3 py-2 border transition-colors " +
                (stake === s 
                  ? "bg-blue-600 border-blue-500 text-white" 
                  : "bg-white/10 border-white/10 hover:bg-white/15")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Move selection */}
      <div>
        <div className="mb-2 text-sm font-medium">Your moves (commit these now)</div>
        <div className="space-y-2">
          {Array.from({ length: rounds }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm w-16">Round {i + 1}:</span>
              <div className="flex gap-1">
                {MOVE_CHOICES.map((move) => (
                  <button
                    key={move}
                    type="button"
                    onClick={() => {
                      const newMoves = [...moves];
                      newMoves[i] = move;
                      setMoves(newMoves);
                    }}
                    className={
                      "w-12 h-12 rounded-lg border text-lg transition-colors " +
                      (moves[i] === move
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-white/10 border-white/10 hover:bg-white/15")
                    }
                  >
                    {move === "R" ? "🪨" : move === "P" ? "📄" : "✂️"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-neutral-400">
                {moves[i] === "R" ? "Rock" : moves[i] === "P" ? "Paper" : "Scissors"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={creating}
        className="
          w-full py-3 px-4 rounded-lg font-medium transition-colors
          bg-green-600 hover:bg-green-700 text-white
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        "
      >
        {creating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
            Creating...
          </>
        ) : (
          <>
            🎮 Create Game ({rounds * stake} tokens)
          </>
        )}
      </button>
    </form>
  );
}

// Helper functions (these would typically be imported)
function cryptoRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function prehash(moves: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${moves}|${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function saveSecret(sessionId: string, secret: { salt: string; moves: string[] }): void {
  try {
    localStorage.setItem(`solrps_secret_${sessionId}`, JSON.stringify(secret));
  } catch (error) {
    console.warn('Could not save secret to localStorage:', error);
  }
}
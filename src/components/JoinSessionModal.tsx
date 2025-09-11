"use client";
import { useState } from "react";
import type { Move } from "@/lib/hash";

interface JoinSessionModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  rounds: number;
  stakePerRound: number;
  onJoined: () => void;
}

export function JoinSessionModal({
  open,
  onClose,
  sessionId,
  rounds,
  stakePerRound,
  onJoined,
}: JoinSessionModalProps) {
  const [moves, setMoves] = useState<Move[]>(Array(rounds).fill("R"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !sessionId) return null;

  const totalStake = rounds * stakePerRound;

  async function join() {
    setBusy(true);
    setError(null);
    
    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          challengerMoves: moves,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to join session");
      }

      onJoined();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to join session");
    } finally {
      setBusy(false);
    }
  }

  function updateMove(roundIndex: number, move: Move) {
    const newMoves = [...moves];
    newMoves[roundIndex] = move;
    setMoves(newMoves);
  }

  function getMoveLabel(move: Move) {
    const labels = { R: "Rock", P: "Paper", S: "Scissors" };
    return labels[move];
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Join Session</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Choose your moves for all {rounds} rounds. Your stake of {totalStake} tokens will be locked.
          </p>
        </div>

        <div className="space-y-4">
          {Array.from({ length: rounds }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="text-sm font-medium">Round {i + 1}</div>
              <div className="flex gap-2">
                {(["R", "P", "S"] as const).map((move) => (
                  <button
                    key={move}
                    type="button"
                    onClick={() => updateMove(i, move)}
                    disabled={busy}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      moves[i] === move
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/10 border-white/10 hover:bg-white/15 text-neutral-300"
                    }`}
                  >
                    {getMoveLabel(move)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="bg-white/5 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-neutral-300">
              <span>Total Stake:</span>
              <span className="font-medium">{totalStake} tokens</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20 transition-colors"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-blue-500/20 px-4 py-2 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            onClick={join}
            disabled={busy}
          >
            {busy ? "Joining..." : `Join & Lock ${totalStake} Tokens`}
          </button>
        </div>
      </div>
    </div>
  );
}
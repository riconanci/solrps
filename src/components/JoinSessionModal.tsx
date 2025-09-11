"use client";

import { useState } from "react";

const MOVE_CHOICES = ["R", "P", "S"] as const;
type Move = (typeof MOVE_CHOICES)[number];

export function JoinSessionModal({
  open,
  onClose,
  sessionId,
  rounds,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  rounds: number;
  onJoined: () => void;
}) {
  const [moves, setMoves] = useState<Move[]>(
    Array.from({ length: rounds }, () => "R")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !sessionId) return null;

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
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Join failed");
      }
      onJoined();
      onClose();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-4">
        <div className="mb-3 text-lg font-semibold">Join Session</div>
        <div className="space-y-2">
          {Array.from({ length: rounds }).map((_, idx) => {
            const current = moves[idx];
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
              >
                <div className="text-sm">Round {idx + 1}</div>
                <div className="flex gap-2">
                  {MOVE_CHOICES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const next = moves.slice();
                        next[idx] = m;
                        setMoves(next);
                      }}
                      className={
                        "rounded-md px-3 py-1 border " +
                        (current === m
                          ? "bg-white/20 border-white/30"
                          : "bg-white/10 border-white/10 hover:bg-white/15")
                      }
                    >
                      {m === "R" ? "Rock" : m === "P" ? "Paper" : "Scissors"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-white/20 px-3 py-1 hover:bg-white/30"
            onClick={join}
            disabled={busy}
          >
            {busy ? "Joining..." : "Join & Lock Stake"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RevealModal } from "@/components/RevealModal";

type Match = {
  id: string;
  createdAt: string;
  overall: "CREATOR" | "CHALLENGER" | "DRAW";
  payoutWinner: number;
  session: {
    id: string;
    status: "OPEN"|"LOCKED"|"AWAITING_REVEAL"|"RESOLVED"|"FORFEITED"|"CANCELLED";
    rounds: number;
    stakePerRound: number;
    creatorId: string;
    challengerId: string | null;
    creatorRevealed: boolean;
  };
};

export default function MyPage() {
  const [items, setItems] = useState<Match[]>([]);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/me/matches");
    const j = await res.json();
    setItems(j.items ?? []);
  }
  useEffect(() => { load(); }, []);

  async function forfeit(sessionId: string) {
    const res = await fetch("/api/session/forfeit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Matches</h1>
        <Link href="/play" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Back to Play</Link>
      </div>

      <div className="space-y-3">
        {items.map((m) => {
          const s = m.session;
          return (
            <div key={m.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div>Status: <span className="font-medium">{s.status}</span></div>
                  <div>Rounds: {s.rounds} • Stake/rd: {s.stakePerRound}</div>
                  {m.payoutWinner > 0 && <div className="text-green-300">Payout: {m.payoutWinner}</div>}
                  {m.overall === "DRAW" && <div className="text-neutral-300">Result: Draw</div>}
                </div>
                <div className="flex gap-2">
                  {s.status === "AWAITING_REVEAL" && (
                    <button
                      className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                      onClick={() => { setRevealId(s.id); setRevealOpen(true); }}
                    >
                      Reveal
                    </button>
                  )}
                  {s.status === "AWAITING_REVEAL" && (
                    <button
                      className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                      onClick={() => forfeit(s.id)}
                    >
                      Forfeit (claim if deadline passed)
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-sm text-neutral-400">No matches yet.</div>}
      </div>

      <RevealModal
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        sessionId={revealId}
        onRevealed={load}
      />
    </div>
  );
}

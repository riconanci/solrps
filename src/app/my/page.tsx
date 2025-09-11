"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RevealModal } from "@/components/RevealModal";
import { format } from "date-fns";

type MatchData = {
  id: string;
  createdAt: string;
  status: "OPEN" | "LOCKED" | "AWAITING_REVEAL" | "RESOLVED" | "FORFEITED" | "CANCELLED";
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  isCreator: boolean;
  opponent: {
    id: string;
    displayName: string;
  } | null;
  revealDeadline: string;
  creatorRevealed: boolean;
  result: {
    id: string;
    createdAt: string;
    roundsOutcome: any[];
    creatorWins: number;
    challengerWins: number;
    draws: number;
    overall: "CREATOR" | "CHALLENGER" | "DRAW";
    pot: number;
    payoutWinner: number;
    userWon: boolean;
    userPayout: number;
  } | null;
};

export default function MyPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);

  async function loadMatches() {
    try {
      setLoading(true);
      // For now, using seed_alice as user ID (replace with actual auth later)
      const res = await fetch("/api/me/matches?userId=seed_alice");
      if (!res.ok) throw new Error("Failed to load matches");
      
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error("Failed to load matches:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function forfeit(sessionId: string) {
    try {
      const res = await fetch("/api/session/forfeit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Forfeit failed");
        return;
      }
      
      // Reload matches after successful forfeit
      loadMatches();
    } catch (error) {
      console.error("Forfeit error:", error);
      alert("Failed to forfeit");
    }
  }

  function getStatusBadge(status: string) {
    const colors = {
      OPEN: "bg-blue-500/20 text-blue-300",
      AWAITING_REVEAL: "bg-yellow-500/20 text-yellow-300",
      RESOLVED: "bg-green-500/20 text-green-300",
      FORFEITED: "bg-red-500/20 text-red-300",
      CANCELLED: "bg-gray-500/20 text-gray-300",
    };
    return colors[status as keyof typeof colors] || "bg-gray-500/20 text-gray-300";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neutral-400">Loading matches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Matches</h1>
        <Link 
          href="/play" 
          className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
        >
          Back to Play
        </Link>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <div key={match.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              
              {/* Match Info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-1 text-xs ${getStatusBadge(match.status)}`}>
                    {match.status}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {format(new Date(match.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
                
                <div className="text-sm">
                  <div>
                    <span className="text-neutral-400">Role:</span> {match.isCreator ? "Creator" : "Challenger"}
                  </div>
                  <div>
                    <span className="text-neutral-400">Opponent:</span> {match.opponent?.displayName || "Waiting..."}
                  </div>
                  <div>
                    <span className="text-neutral-400">Format:</span> {match.rounds} rounds • {match.stakePerRound}/round • Total: {match.totalStake}
                  </div>
                </div>

                {/* Result Info */}
                {match.result && (
                  <div className="mt-2 rounded bg-white/5 p-2 text-sm">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-neutral-400">Score:</span> {match.result.creatorWins}-{match.result.challengerWins}
                        {match.result.draws > 0 && ` (${match.result.draws} draws)`}
                      </div>
                      <div>
                        <span className="text-neutral-400">Result:</span>
                        <span className={match.result.userWon ? "text-green-300" : match.result.overall === "DRAW" ? "text-yellow-300" : "text-red-300"}>
                          {match.result.overall === "DRAW" ? "Draw" : match.result.userWon ? "Won" : "Lost"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400">Payout:</span>
                        <span className={match.result.userPayout > 0 ? "text-green-300" : match.result.userPayout < 0 ? "text-red-300" : "text-yellow-300"}>
                          {match.result.userPayout > 0 ? "+" : ""}{match.result.userPayout}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {match.status === "AWAITING_REVEAL" && match.isCreator && (
                  <button
                    className="rounded bg-blue-500/20 px-3 py-1 text-blue-300 hover:bg-blue-500/30"
                    onClick={() => { setRevealId(match.id); setRevealOpen(true); }}
                  >
                    Reveal
                  </button>
                )}
                
                {match.status === "AWAITING_REVEAL" && !match.isCreator && (
                  <button
                    className="rounded bg-red-500/20 px-3 py-1 text-red-300 hover:bg-red-500/30"
                    onClick={() => forfeit(match.id)}
                  >
                    Claim Forfeit
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {matches.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <div className="text-lg mb-2">No matches yet</div>
            <div className="text-sm">
              <Link href="/play" className="text-blue-400 hover:text-blue-300">
                Create or join a session to get started
              </Link>
            </div>
          </div>
        )}
      </div>

      <RevealModal
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        sessionId={revealId}
        onRevealed={loadMatches}
      />
    </div>
  );
}
// app/my/page.tsx
"use client";
import { useEffect, useState } from "react";
import { RevealModal } from "@/components/RevealModal";

type MatchData = {
  id: string;
  createdAt: string;
  status: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  isCreator: boolean;
  myRole: string;
  opponent: {
    id: string;
    displayName: string;
  } | null;
  myMoves: string[];
  opponentMoves: string[];
  result: {
    id: string;
    createdAt: string;
    roundsOutcome: any[];
    creatorWins: number;
    challengerWins: number;
    draws: number;
    overall: string;
    pot: number;
    feesTreasury: number;
    feesBurn: number;
    payoutWinner: number;
    didIWin: boolean;
    isDraw: boolean;
    myWins: number;
    opponentWins: number;
  } | null;
};

export default function MyMatchesPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealModal, setRevealModal] = useState<{
    open: boolean;
    sessionId: string | null;
  }>({ open: false, sessionId: null });

  useEffect(() => {
    fetchMatches();
  }, []);

  async function fetchMatches() {
    try {
      setLoading(true);
      const res = await fetch("/api/me/matches");
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading your matches...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg">Error: {error}</div>
          <button 
            onClick={fetchMatches}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Matches</h1>
        
        {matches.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="text-lg">No matches found</div>
            <p className="mt-2">Play your first game to see matches here!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                onReveal={(sessionId) => setRevealModal({ open: true, sessionId })}
              />
            ))}
          </div>
        )}
      </div>

      <RevealModal
        open={revealModal.open}
        onClose={() => setRevealModal({ open: false, sessionId: null })}
        sessionId={revealModal.sessionId}
        onRevealed={() => {
          setRevealModal({ open: false, sessionId: null });
          fetchMatches(); // Refresh matches after reveal
        }}
      />
    </div>
  );
}

function MatchCard({ 
  match, 
  onReveal 
}: { 
  match: MatchData; 
  onReveal: (sessionId: string) => void;
}) {
  const getStatusBadge = (status: string) => {
    const statusStyles = {
      RESOLVED: "bg-green-600 text-white",
      FORFEITED: "bg-red-600 text-white",
      AWAITING_REVEAL: "bg-yellow-600 text-black",
    };
    return statusStyles[status as keyof typeof statusStyles] || "bg-gray-600 text-white";
  };

  const getResultText = () => {
    if (!match.result) return null;
    
    if (match.result.isDraw) {
      return (
        <div className="flex flex-col items-center justify-center bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-yellow-400">DRAW</span>
        </div>
      );
    }
    
    return match.result.didIWin ? (
      <div className="flex flex-col items-center justify-center bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
        <span className="text-2xl font-bold text-green-400">WIN</span>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
        <span className="text-2xl font-bold text-red-400">LOST</span>
      </div>
    );
  };

  const getWinningsText = () => {
    if (!match.result) return null;
    
    if (match.result.isDraw) {
      return (
        <div className="text-center">
          <span className="text-gray-400">Refunded</span>
          <span className="text-gray-400 ml-1">Pot</span>
        </div>
      );
    }
    
    if (match.result.didIWin) {
      const netWinnings = match.result.payoutWinner - match.totalStake;
      return (
        <div className="text-center">
          <span className="text-green-400 font-mono font-bold text-lg">
            +{netWinnings.toLocaleString()}
          </span>
          <span className="text-gray-400 ml-1">Pot</span>
        </div>
      );
    } else {
      return (
        <div className="text-center">
          <span className="text-red-400 font-mono font-bold text-lg">
            -{match.totalStake.toLocaleString()}
          </span>
          <span className="text-gray-400 ml-1">Pot</span>
        </div>
      );
    }
  };

  const formatMoves = (moves: string[]) => {
    const moveEmojis = { R: "🪨", P: "📄", S: "✂️" };
    return moves.map(move => moveEmojis[move as keyof typeof moveEmojis] || move).join(" ");
  };

  return (
    <div className="border border-white/20 rounded-xl p-6 bg-white/5 hover:bg-white/10 transition-colors">
      
      {/* Header Section */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold">
              vs {match.opponent?.displayName || "Unknown"}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(match.status)}`}>
              {match.status.replace("_", " ")}
            </span>
          </div>
          
          <div className="text-sm text-gray-400">
            {new Date(match.createdAt).toLocaleDateString()} • 
            {match.rounds} rounds • {match.stakePerRound} tokens/round • 
            Role: {match.myRole}
          </div>
        </div>
        
        {/* Result and Winnings Section */}
        <div className="flex items-center gap-6">
          {/* Large Result Text */}
          {getResultText()}
          
          {/* Winnings */}
          <div className="text-right">
            {getWinningsText()}
            <div className="text-sm text-gray-400 mt-1">
              Total Pot: {match.result?.pot.toLocaleString() || (match.totalStake * 2).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Game Details */}
      {match.result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
          <div>
            <h4 className="font-semibold mb-2">Round Results</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Your wins:</span>
                <span className="text-green-400 font-semibold">{match.result.myWins}</span>
              </div>
              <div className="flex justify-between">
                <span>Opponent wins:</span>
                <span className="text-red-400 font-semibold">{match.result.opponentWins}</span>
              </div>
              {match.result.draws > 0 && (
                <div className="flex justify-between">
                  <span>Draws:</span>
                  <span className="text-yellow-400 font-semibold">{match.result.draws}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Moves</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>You:</span>
                <span className="text-lg">{formatMoves(match.myMoves)}</span>
              </div>
              <div className="flex justify-between">
                <span>Opponent:</span>
                <span className="text-lg">{formatMoves(match.opponentMoves)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round by round details */}
      {match.result?.roundsOutcome && match.result.roundsOutcome.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h4 className="font-semibold mb-2">Round by Round</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {match.result.roundsOutcome.map((round: any, index: number) => (
              <div key={index} className="text-center p-2 bg-white/5 rounded text-xs">
                <div className="font-medium">Round {round.round || index + 1}</div>
                <div className="flex justify-center gap-1 my-1">
                  <span>{formatMoves([match.isCreator ? round.a : round.b])}</span>
                  <span>vs</span>
                  <span>{formatMoves([match.isCreator ? round.b : round.a])}</span>
                </div>
                <div className={`font-semibold ${
                  round.winner === "DRAW" ? "text-yellow-400" :
                  (match.isCreator && round.winner === "A") || (!match.isCreator && round.winner === "B") 
                    ? "text-green-400" : "text-red-400"
                }`}>
                  {round.winner === "DRAW" ? "Draw" : 
                   (match.isCreator && round.winner === "A") || (!match.isCreator && round.winner === "B")
                     ? "Win" : "Loss"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {match.status === "AWAITING_REVEAL" && match.isCreator && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={() => onReveal(match.id)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            🔓 Reveal Moves
          </button>
        </div>
      )}
    </div>
  );
}
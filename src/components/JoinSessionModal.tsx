// src/components/JoinSessionModal.tsx
"use client";
import { useState } from "react";

type SessionData = {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  age: string;
};

interface JoinSessionModalProps {
  open: boolean;
  onClose: () => void;
  session: SessionData | null;
  onJoined: () => void;
}

export function JoinSessionModal({ open, onClose, session, onJoined }: JoinSessionModalProps) {
  const [moves, setMoves] = useState<string>("R,P,R");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Early return for null/closed states
  if (!open || !session) {
    return null;
  }

  // Now TypeScript knows session is not null
  const moveEmojis = { 
    R: "🪨 Rock", 
    P: "📄 Paper", 
    S: "✂️ Scissors" 
  } as const;
  
  const totalPot = session.totalStake * 2;

  const handleJoin = async () => {
    setBusy(true);
    setError(null);

    try {
      const moveArray = moves
        .split(",")
        .map(m => m.trim().toUpperCase())
        .filter(Boolean);
      
      // Validate move count
      if (moveArray.length !== session.rounds) {
        throw new Error(`You need exactly ${session.rounds} moves for this game`);
      }

      // Validate each move
      for (const move of moveArray) {
        if (!["R", "P", "S"].includes(move)) {
          throw new Error(`Invalid move: ${move}. Use R, P, or S only.`);
        }
      }

      // Make API call
      const response = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: moveArray,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to join session");
      }

      // Success - notify parent and close
      onJoined();
      onClose();
      
    } catch (err) {
      console.error("Join session error:", err);
      setError(err instanceof Error ? err.message : "Failed to join session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-xl border border-white/20 max-w-md w-full mx-4">
        
        {/* Header */}
        <h3 className="text-xl font-bold mb-4 text-white">Join Game</h3>
        
        {/* Game Info Card */}
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Creator:</span>
              <span className="font-medium text-white">{session.creator}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rounds:</span>
              <span className="font-medium text-white">{session.rounds}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Stake per round:</span>
              <span className="font-medium text-white">{session.stakePerRound} tokens</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-gray-400">Total Pot:</span>
              <span className="font-mono text-green-400 font-bold">{totalPot} tokens</span>
            </div>
          </div>
        </div>

        {/* Move Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              Choose your moves ({session.rounds} rounds)
            </label>
            <input
              type="text"
              value={moves}
              onChange={(e) => setMoves(e.target.value)}
              placeholder={`e.g., ${Array(session.rounds).fill("R").join(",")}`}
              className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              disabled={busy}
            />
            <div className="text-xs text-gray-400 mt-1">
              Use R (Rock), P (Paper), S (Scissors), separated by commas
            </div>
          </div>

          {/* Move Guide */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-sm font-medium mb-2 text-white">Move Guide:</div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(moveEmojis).map(([key, value]) => (
                <div key={key} className="text-center p-2 bg-white/5 rounded text-xs">
                  <div className="font-mono text-white font-bold">{key}</div>
                  <div className="text-gray-400">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Your stake:</span>
                <span className="font-mono text-white">{session.totalStake} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Opponent stake:</span>
                <span className="font-mono text-white">{session.totalStake} tokens</span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Winner takes:</span>
                  <span className="font-mono text-green-400 font-bold">{totalPot * 0.9} tokens</span>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  (90% after 10% fees)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={busy || !moves.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
          >
            {busy ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
}
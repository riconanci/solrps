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
  const [moves, setMoves] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Early return for null/closed states
  if (!open || !session) {
    return null;
  }

  // Now TypeScript knows session is not null
  const currentSession = session;
  const totalPot = currentSession.totalStake * 2;
  
  const handleJoin = async () => {
    setBusy(true);
    setError(null);

    try {
      const moveArray = moves.split(",").map(m => m.trim()).filter(Boolean);
      
      // Validate move count
      if (moveArray.length !== currentSession.rounds) {
        throw new Error(`Please select moves for all ${currentSession.rounds} rounds`);
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
          sessionId: currentSession.id,
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

  // Helper function to get move from current index
  function getMoveFromIndex(index: number): string {
    const moveArray = moves.split(",").map(m => m.trim()).filter(Boolean);
    return moveArray[index] || ""; // Return empty string if not set
  }

  // Helper function to get move emoji
  function getMoveEmoji(move: string): string {
    if (move === "R") return "🪨";
    if (move === "P") return "📄";
    return "✂️";
  }

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
              <span className="font-medium text-white">{currentSession.creator}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rounds:</span>
              <span className="font-medium text-white">{currentSession.rounds}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Stake per round:</span>
              <span className="font-medium text-white">{currentSession.stakePerRound} tokens</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-gray-400">Total Pot:</span>
              <span className="font-mono text-green-400 font-bold">{totalPot} tokens</span>
            </div>
          </div>
        </div>

        {/* Move Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              Choose your moves ({currentSession.rounds} rounds)
            </label>
            
            {/* Emoji Move Selector */}
            <div className="space-y-3">
              {Array.from({ length: currentSession.rounds }, (_, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="text-xs text-gray-400 w-16">Round {i + 1}:</div>
                  <div className="flex gap-1">
                    {["R", "P", "S"].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => {
                          const moveArray = moves.split(",").map(m => m.trim()).filter(Boolean);
                          // Ensure array has enough elements
                          while (moveArray.length <= i) {
                            moveArray.push("");
                          }
                          moveArray[i] = choice;
                          // Filter out empty moves at the end for cleaner display
                          const cleanedMoves = moveArray.slice(0, currentSession.rounds);
                          setMoves(cleanedMoves.join(","));
                        }}
                        className={
                          "rounded-lg border w-12 h-12 flex items-center justify-center text-xl " +
                          (getMoveFromIndex(i) === choice
                            ? "bg-white/20 border-white/30"
                            : "bg-white/10 border-white/10 hover:bg-white/15")
                        }
                      >
                        {getMoveEmoji(choice)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-gray-400 mt-2">
              Current moves: {moves || "None selected yet"}
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
                <span className="font-mono text-white">{currentSession.totalStake} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Opponent stake:</span>
                <span className="font-mono text-white">{currentSession.totalStake} tokens</span>
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
            disabled={busy || moves.split(",").filter(m => m.trim()).length !== currentSession.rounds}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
          >
            {busy ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
}
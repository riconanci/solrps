// src/components/JoinSessionModal.tsx
"use client";
import { useState } from "react";
import { useWallet } from "../state/wallet";

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
  onJoined?: (sessionId: string) => void;
}

type Move = "R" | "P" | "S";

export function JoinSessionModal({ open, onClose, session, onJoined }: JoinSessionModalProps) {
  const { userId } = useWallet();
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Don't render if closed or no session
  if (!open || !session) {
    return null;
  }

  const totalPot = session.totalStake * 2;
  const winnerPayout = Math.floor(totalPot * 0.9); // 90% after fees

  // Move selection handlers
  const selectMove = (roundIndex: number, move: Move) => {
    const newMoves = [...selectedMoves];
    
    // Ensure array is long enough
    while (newMoves.length <= roundIndex) {
      newMoves.push("R"); // Default to Rock
    }
    
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
    setError(""); // Clear error when user makes selection
  };

  const getMoveEmoji = (move: Move): string => {
    switch (move) {
      case "R": return "🪨";
      case "P": return "📄";
      case "S": return "✂️";
      default: return "❓";
    }
  };

  const getMoveName = (move: Move): string => {
    switch (move) {
      case "R": return "Rock";
      case "P": return "Paper";
      case "S": return "Scissors";
      default: return "None";
    }
  };

  const handleJoin = async () => {
    // Validation
    if (selectedMoves.length !== session.rounds) {
      setError(`Please select moves for all ${session.rounds} rounds`);
      return;
    }

    // Check for empty moves
    if (selectedMoves.some(move => !move)) {
      setError("All rounds must have a move selected");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      console.log("🎮 Joining session:", {
        sessionId: session.id,
        challengerMoves: selectedMoves,
        userId: userId || "seed_alice"
      });

      const response = await fetch("/api/session/join", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: selectedMoves,
          userId: userId || "seed_alice", // Include current user ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Successfully joined session:", result);
      
      // Reset state
      setSelectedMoves([]);
      setError("");
      
      // Notify parent and close
      onJoined?.(session.id);
      onClose();
      
    } catch (error: any) {
      console.error("❌ Failed to join session:", error);
      setError(error.message || "Failed to join session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedMoves([]);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl max-w-lg w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">🎮 Join Game</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors text-lg"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          
          {/* Game Info - Compact */}
          <div className="bg-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Game Details</h3>
              <div className="text-sm text-gray-400">{session.age}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Creator</div>
                <div className="font-medium text-white">{session.creator}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Rounds</div>
                <div className="font-medium text-white">{session.rounds}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Stake/round</div>
                <div className="font-medium text-white">{session.stakePerRound.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Your stake</div>
                <div className="font-medium text-orange-400">{session.totalStake.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-2 flex justify-between items-center">
              <div className="text-gray-400 text-sm">Winner takes</div>
              <div className="font-bold text-green-400">{winnerPayout.toLocaleString()} tokens</div>
            </div>
          </div>

          {/* Move Selection - Compact Layout */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Choose Your Moves</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex gap-1">
                  {Array.from({ length: session.rounds }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${selectedMoves[i] ? "bg-green-500" : "bg-gray-600"}`}
                    />
                  ))}
                </div>
                <span>{selectedMoves.filter(Boolean).length}/{session.rounds}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              {Array.from({ length: session.rounds }, (_, roundIndex) => (
                <div key={roundIndex} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium min-w-[32px]">R{roundIndex + 1}:</span>
                    
                    <div className="flex gap-2">
                      {(["R", "P", "S"] as Move[]).map((move) => {
                        const isSelected = selectedMoves[roundIndex] === move;
                        
                        return (
                          <button
                            key={move}
                            onClick={() => selectMove(roundIndex, move)}
                            disabled={isSubmitting}
                            className={`
                              flex items-center justify-center w-10 h-10 rounded-lg border transition-all
                              ${isSelected 
                                ? "border-blue-500 bg-blue-500/20 text-white scale-110" 
                                : "border-white/20 bg-white/5 text-gray-300 hover:border-white/40 hover:bg-white/10 hover:scale-105"
                              }
                              ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
                            `}
                          >
                            <span className="text-lg">{getMoveEmoji(move)}</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <span className="text-xs text-gray-400 min-w-[60px] text-right">
                      {selectedMoves[roundIndex] ? (
                        <span className="text-green-400">{getMoveName(selectedMoves[roundIndex])}</span>
                      ) : (
                        "Pick one"
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white/5 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Cost breakdown:</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Your stake:</span>
                <span className="text-white font-mono">-{session.totalStake.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">If you win:</span>
                <span className="text-green-400 font-mono">+{winnerPayout.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">If you lose:</span>
                <span className="text-red-400 font-mono">-{session.totalStake.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="
                flex-1 px-4 py-3 rounded-xl border border-gray-600 
                bg-gray-700/50 hover:bg-gray-600/50 
                text-gray-300 hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed 
                transition-all font-medium
              "
            >
              Cancel
            </button>
            
            <button
              onClick={handleJoin}
              disabled={
                isSubmitting || 
                selectedMoves.filter(Boolean).length !== session.rounds
              }
              className="
                flex-1 px-4 py-3 rounded-xl
                bg-blue-600 hover:bg-blue-700 
                text-white font-medium
                disabled:opacity-50 disabled:cursor-not-allowed 
                transition-all flex items-center justify-center gap-2
              "
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  Joining...
                </>
              ) : (
                <>
                  🚀 Join Game
                </>
              )}
            </button>
          </div>

          {/* Footer info */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-white/10">
            Playing as: <span className="text-gray-300">{userId || "seed_alice"}</span> | 
            Session: <span className="font-mono">{session.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
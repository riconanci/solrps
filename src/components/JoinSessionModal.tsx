// src/components/JoinSessionModal.tsx - Clean version without Phase 2 dependencies
"use client";
import { useState } from "react";
import { useWallet } from "../state/wallet";

type Move = 'R' | 'P' | 'S';

interface SessionData {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  status: string;
  createdAt: Date;
}

interface JoinSessionModalProps {
  session: SessionData;
  onClose: () => void;
  onSuccess: () => void;
}

export function JoinSessionModal({ session, onClose, onSuccess }: JoinSessionModalProps) {
  const wallet = useWallet();
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getMoveEmoji = (move: Move) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move];
  };

  const selectMove = (roundIndex: number, move: Move) => {
    const newMoves = [...selectedMoves];
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
  };

  const canJoin = selectedMoves.filter(Boolean).length === session.rounds && 
                 wallet.balance >= session.totalStake;

  const handleJoinGame = async () => {
    if (!canJoin) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: selectedMoves,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to join game');
      }

      const result = await response.json();
      
      // For now, just show a simple alert with results
      // Later we can add a proper results modal
      alert(`Game completed! Result: ${JSON.stringify(result, null, 2)}`);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to join game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Join Game</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Game Info */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span>Rounds:</span>
              <span className="font-medium">{session.rounds}</span>
            </div>
            <div className="flex justify-between">
              <span>Your Stake:</span>
              <span className="font-mono">{session.totalStake.toLocaleString()} RPS</span>
            </div>
            <div className="flex justify-between">
              <span>Total Pot:</span>
              <span className="font-mono">{(session.totalStake * 2).toLocaleString()} RPS</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>Winner Gets:</span>
              <span className="font-mono">
                {Math.floor(session.totalStake * 2 * 0.95).toLocaleString()} RPS
              </span>
            </div>
          </div>
        </div>

        {/* Move Selection Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Select Your Moves</span>
            <span className="text-sm text-gray-400">
              {selectedMoves.filter(Boolean).length}/{session.rounds}
            </span>
          </div>
          
          {/* Progress indicators */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: session.rounds }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded ${
                  selectedMoves[i] ? "bg-green-500" : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Round Selection */}
        <div className="space-y-3 mb-6">
          {Array.from({ length: session.rounds }, (_, roundIndex) => (
            <div key={roundIndex} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium min-w-[32px]">
                  R{roundIndex + 1}:
                </span>
                
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
                  {selectedMoves[roundIndex] ? getMoveEmoji(selectedMoves[roundIndex]) : "?"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Balance Check */}
        <div className="bg-white/5 rounded-lg p-3 mb-6">
          <div className="flex justify-between text-sm">
            <span>Your Balance:</span>
            <span className={`font-mono ${wallet.balance >= session.totalStake ? 'text-green-400' : 'text-red-400'}`}>
              {wallet.balance.toLocaleString()} RPS
            </span>
          </div>
          {wallet.balance < session.totalStake && (
            <p className="text-red-400 text-xs mt-1">Insufficient balance to join this game</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleJoinGame}
            disabled={!canJoin || isSubmitting}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              canJoin && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Joining...' : 'Join Game'}
          </button>
        </div>

        {/* Error Messages */}
        {!canJoin && selectedMoves.filter(Boolean).length === session.rounds && (
          <p className="text-red-400 text-sm text-center mt-3">
            Insufficient balance to join this game
          </p>
        )}

        {!canJoin && selectedMoves.filter(Boolean).length !== session.rounds && (
          <p className="text-yellow-400 text-sm text-center mt-3">
            Please select moves for all rounds
          </p>
        )}
      </div>
    </div>
  );
}
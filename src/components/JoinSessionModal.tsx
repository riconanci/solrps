// src/components/JoinSessionModal.tsx - FIXED USER DETECTION
"use client";
import { useState } from "react";
import { useWallet } from "../state/wallet";

type Move = 'R' | 'P' | 'S';

interface SessionData {
  id: string;
  creator: string;
  creatorId: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  status: string;
  createdAt: Date;
}

interface JoinSessionModalProps {
  session: SessionData;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export function JoinSessionModal({ session, onClose, onSuccess }: JoinSessionModalProps) {
  const wallet = useWallet();
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getMoveEmoji = (move: Move) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move];
  };

  const getMoveLabel = (move: Move) => {
    const labels = { R: 'Rock', P: 'Paper', S: 'Scissors' };
    return labels[move];
  };

  const selectMove = (roundIndex: number, move: Move) => {
    const newMoves = [...selectedMoves];
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
    setError(''); // Clear error when user makes changes
  };

  const canJoin = selectedMoves.filter(Boolean).length === session.rounds && 
                 wallet.balance >= session.totalStake;

  const handleJoinGame = async () => {
    if (!canJoin) return;

    // Double-check user detection before joining
    console.log(`🎮 Join attempt: ${wallet.displayName} (${wallet.userId}) joining ${session.creator}'s game`);
    
    if (wallet.userId === session.creatorId) {
      setError("You cannot join your own game!");
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create request body with explicit user context
      const requestBody = {
        sessionId: session.id,
        challengerMoves: selectedMoves,
        userId: wallet.userId, // Explicitly pass user ID
        joinType: 'PUBLIC'
      };

      console.log('🎮 Join request body:', requestBody);

      const response = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add custom header for user detection
          'X-User-ID': wallet.userId || '',
          'X-User-Name': wallet.displayName || ''
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('🎉 Join successful:', result);
      
      if (result.success) {
        onSuccess(result);
        onClose();
      } else {
        throw new Error(result.error || 'Join failed');
      }

    } catch (error: any) {
      console.error('❌ Failed to join game:', error);
      setError(error.message || 'Failed to join game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">Join Game</h2>
          <div className="text-sm text-gray-400">
            Playing against <span className="text-white font-medium">{session.creator}</span>
          </div>
          <div className="text-sm text-gray-400">
            As: <span className="text-blue-400 font-medium">{wallet.displayName} ({wallet.userId?.slice(-4)})</span>
          </div>
        </div>

        {/* Game Info */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Rounds</div>
              <div className="font-mono">{session.rounds}</div>
            </div>
            <div>
              <div className="text-gray-400">Total Stake</div>
              <div className="font-mono text-yellow-400">{session.totalStake.toLocaleString()} RPS</div>
            </div>
          </div>
        </div>

        {/* Move Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Select Your Moves</h3>
          
          <div className="space-y-4">
            {Array.from({ length: session.rounds }, (_, roundIndex) => (
              <div key={roundIndex} className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-3">Round {roundIndex + 1}</div>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['R', 'P', 'S'] as Move[]).map((move) => (
                    <button
                      key={move}
                      onClick={() => selectMove(roundIndex, move)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        selectedMoves[roundIndex] === move
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-white/10 hover:bg-white/20 border-transparent'
                      }`}
                    >
                      <div className="text-2xl mb-1">{getMoveEmoji(move)}</div>
                      <div className="text-xs">{getMoveLabel(move)}</div>
                    </button>
                  ))}
                </div>

                <div className="text-center">
                  <div className="text-2xl">
                    {selectedMoves[roundIndex] ? getMoveEmoji(selectedMoves[roundIndex]) : '❓'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedMoves[roundIndex] ? getMoveLabel(selectedMoves[roundIndex]) : 'Choose your move'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="text-blue-400">
              {selectedMoves.filter(Boolean).length} / {session.rounds}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(selectedMoves.filter(Boolean).length / session.rounds) * 100}%` }}
            />
          </div>
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

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        {/* Actions */}
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
            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              canJoin && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Joining...
              </>
            ) : (
              'Join Game'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
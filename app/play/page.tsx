// app/play/page.tsx - FIXED VERSION WITH PROPER SESSION STATUS HANDLING
"use client";
import { useEffect, useState } from "react";
import { useWallet } from "../../src/state/wallet";

type Move = 'R' | 'P' | 'S';

interface SessionCard {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  createdAt: string;
  status: string;
  isLocallyDeleted?: boolean;
}

export default function PlayPage() {
  const wallet = useWallet();
  const [selectedRounds, setSelectedRounds] = useState<1 | 3 | 5>(3);
  const [selectedStake, setSelectedStake] = useState<100 | 500 | 1000>(500);
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [createdSessions, setCreatedSessions] = useState<SessionCard[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSuccessDialog, setShowDeleteSuccessDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Local storage key for persistent game tracking
  const STORAGE_KEY = `solrps_created_games_${wallet.userId || 'default'}`;

  // Auto-connect wallet and load games
  useEffect(() => {
    if (!wallet.isConnected) {
      const initWallet = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user') || 'alice';
        const userId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
        await wallet.switchUser(userId);
      };
      initWallet();
    } else {
      loadAndRefreshSessions();
    }
  }, [wallet.isConnected]);

  const loadAndRefreshSessions = async () => {
    if (!wallet.userId) return;
    
    try {
      // Load from localStorage first
      const stored = localStorage.getItem(STORAGE_KEY);
      const localSessions: SessionCard[] = stored ? JSON.parse(stored) : [];
      
      // Filter out locally deleted and resolved/cancelled games
      const activeSessions = localSessions.filter(session => 
        !session.isLocallyDeleted && 
        !['RESOLVED', 'CANCELLED', 'FORFEITED'].includes(session.status)
      );
      
      // Check status of remaining sessions from API
      const refreshedSessions: SessionCard[] = [];
      
      for (const session of activeSessions) {
        try {
          const response = await fetch(`/api/session/${session.id}`);
          if (response.ok) {
            const sessionData = await response.json();
            // Only keep OPEN sessions
            if (sessionData.status === 'OPEN') {
              refreshedSessions.push({
                ...session,
                status: sessionData.status
              });
            }
          }
          // If session not found or not OPEN, don't include it
        } catch (error) {
          console.warn(`Failed to refresh session ${session.id}:`, error);
          // Don't include sessions we can't refresh
        }
      }
      
      setCreatedSessions(refreshedSessions);
      savePersistentSessions(refreshedSessions);
      
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const savePersistentSessions = (sessions: SessionCard[]) => {
    if (!wallet.userId) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  };

  const getMoveEmoji = (move: Move) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move];
  };

  const selectMove = (roundIndex: number, move: Move) => {
    const newMoves = [...selectedMoves];
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
  };

  const canCreateGame = selectedMoves.filter(Boolean).length === selectedRounds && 
                       (wallet.balance || 0) >= (selectedRounds * selectedStake);

  // Simple hash function for commit-reveal
  const simpleHash = async (input: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback for environments without crypto.subtle
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(16, '0');
    }
  };

  const handleCreateGame = async () => {
    if (!canCreateGame) return;

    setIsCreating(true);
    try {
      // Generate salt and commit hash
      const salt = Date.now().toString();
      const movesString = selectedMoves.join('');
      const commitHash = await simpleHash(movesString + salt);
      
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rounds: selectedRounds,
          stakePerRound: selectedStake,
          commitHash: commitHash,
          isPrivate: isPrivate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create game');
      }

      const result = await response.json();
      
      // Create new session record
      const newSession: SessionCard = {
        id: result.id,
        creator: wallet.displayName || 'You',
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        totalStake: selectedRounds * selectedStake,
        createdAt: new Date().toISOString(),
        status: 'OPEN'
      };

      // Add to sessions and save
      const updatedSessions = [...createdSessions, newSession];
      setCreatedSessions(updatedSessions);
      savePersistentSessions(updatedSessions);

      // Reset form
      setSelectedMoves([]);
      
      // Refresh wallet balance
      try {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
        }
      } catch (e) {
        console.warn('Failed to refresh balance:', e);
      }
      
      setShowSuccessDialog(true);
      
    } catch (error: any) {
      console.error('Failed to create game:', error);
      alert(`Failed to create game: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (sessionId: string) => {
    const session = createdSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Check if session can be deleted (only OPEN sessions)
    if (session.status !== 'OPEN') {
      alert(`Cannot delete ${session.status.toLowerCase()} games. Only open games can be cancelled.`);
      return;
    }
    
    setSessionToDelete(sessionId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    setShowDeleteDialog(false);
    setDeletingSessionId(sessionToDelete);
    
    try {
      const response = await fetch('/api/session/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete game');
      }

      // Remove from local sessions
      const updatedSessions = createdSessions.filter(session => session.id !== sessionToDelete);
      setCreatedSessions(updatedSessions);
      savePersistentSessions(updatedSessions);
      
      // Refresh wallet balance
      try {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
        }
      } catch (e) {
        console.warn('Failed to refresh balance:', e);
      }

      setShowDeleteSuccessDialog(true);
      
    } catch (error: any) {
      console.error('Failed to delete game:', error);
      alert(`Failed to delete game: ${error.message}`);
    } finally {
      setDeletingSessionId(null);
      setSessionToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setSessionToDelete(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      alert('Session ID copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert(`Copy failed. Session ID: ${text}`);
    }
  };

  const getStatusDisplay = (status: string) => {
    const statusConfig = {
      'OPEN': { text: 'AVAILABLE', color: 'bg-green-600', emoji: '🟢' },
      'RESOLVED': { text: 'COMPLETED', color: 'bg-gray-600', emoji: '✅' },
      'CANCELLED': { text: 'CANCELLED', color: 'bg-red-600', emoji: '❌' },
      'FORFEITED': { text: 'FORFEITED', color: 'bg-orange-600', emoji: '⏰' }
    };
    
    return statusConfig[status as keyof typeof statusConfig] || 
           { text: status, color: 'bg-gray-600', emoji: '❓' };
  };

  // Auto-refresh sessions every 30 seconds to check status
  useEffect(() => {
    if (!wallet.isConnected) return;
    
    const interval = setInterval(() => {
      loadAndRefreshSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [wallet.isConnected]);

  // Show loading if wallet not connected
  if (!wallet.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading...</h2>
          <p className="text-gray-400">Connecting to wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Create Game</h1>
        <p className="text-gray-400">Set up your Rock Paper Scissors challenge</p>
      </div>

      {/* Create Game Form */}
      <div className="bg-slate-800 rounded-xl p-6 space-y-6">
        
        {/* Game Configuration */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rounds</label>
            <div className="flex gap-2">
              {[1, 3, 5].map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => setSelectedRounds(rounds as 1 | 3 | 5)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedRounds === rounds
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {rounds} Round{rounds > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Stake Per Round</label>
            <div className="flex gap-2">
              {[100, 500, 1000].map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake as 100 | 500 | 1000)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedStake === stake
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {stake.toLocaleString()} RPS
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Move Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Your Moves ({selectedMoves.filter(Boolean).length}/{selectedRounds})
          </label>
          
          <div className="space-y-3">
            {Array.from({ length: selectedRounds }, (_, roundIndex) => (
              <div key={roundIndex} className="space-y-2">
                <div className="text-sm text-gray-400">Round {roundIndex + 1}</div>
                <div className="flex gap-2">
                  {(['R', 'P', 'S'] as Move[]).map((move) => (
                    <button
                      key={move}
                      onClick={() => selectMove(roundIndex, move)}
                      className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                        selectedMoves[roundIndex] === move
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {getMoveEmoji(move)} {move === 'R' ? 'Rock' : move === 'P' ? 'Paper' : 'Scissors'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Button */}
        <div className="pt-4 border-t border-slate-700">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCreateGame}
              disabled={!canCreateGame || isCreating}
              className={`w-full py-3 rounded-lg font-bold transition-colors ${
                canCreateGame && !isCreating
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isCreating ? 'Creating Game...' : 'Create Game'}
            </button>

            {!canCreateGame && (
              <p className="text-center text-red-400 text-sm">
                {selectedMoves.filter(Boolean).length !== selectedRounds
                  ? 'Please select all moves'
                  : 'Insufficient balance'
                }
              </p>
            )}

            <div className="text-center text-sm text-gray-400">
              Total Cost: {(selectedRounds * selectedStake).toLocaleString()} RPS
              <br />
              Your Balance: {(wallet.balance || 0).toLocaleString()} RPS
            </div>
          </div>
        </div>
      </div>

      {/* Your Active Games */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Active Games</h2>
          <button
            onClick={loadAndRefreshSessions}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
        
        {createdSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🎮</div>
            <p>No active games</p>
            <p className="text-sm">Create a game to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {createdSessions.map((session) => {
              const statusInfo = getStatusDisplay(session.status);
              return (
                <div key={session.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        {session.rounds} Rounds • {session.stakePerRound.toLocaleString()} RPS
                      </div>
                      <div className="text-xs text-gray-400">
                        ID: {session.id.slice(0, 8)}...{session.id.slice(-8)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Created: {new Date(session.createdAt).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${statusInfo.color} text-white px-2 py-1 rounded flex items-center gap-1`}>
                        <span>{statusInfo.emoji}</span>
                        {statusInfo.text}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(session.id)}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      📋 Copy ID
                    </button>
                    
                    {session.status === 'OPEN' && (
                      <button
                        onClick={() => handleDeleteRequest(session.id)}
                        disabled={deletingSessionId === session.id}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        {deletingSessionId === session.id ? '⏳ Deleting...' : '🗑️ Delete'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showSuccessDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSuccessDialog(false)}
        >
          <div className="bg-slate-800 rounded-xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Game Created Successfully!</h3>
            <p className="text-gray-400 text-sm">Your game is now available in the lobby.</p>
            <div className="mt-4 text-xs text-gray-500">Click anywhere to continue</div>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCancelDelete}
        >
          <div 
            className="bg-slate-800 rounded-xl p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">🗑️</div>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">Delete Game?</h3>
            <p className="text-gray-400 text-sm mb-6">You'll get a full refund for cancelling an open game.</p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSuccessDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteSuccessDialog(false)}
        >
          <div className="bg-slate-800 rounded-xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Game Deleted Successfully!</h3>
            <p className="text-gray-400 text-sm">Your refund has been processed.</p>
            <div className="mt-4 text-xs text-gray-500">Click anywhere to continue</div>
          </div>
        </div>
      )}
    </div>
  );
}
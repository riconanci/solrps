// app/play/page.tsx - Complete rewrite with truly persistent games
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSuccessDialog, setShowDeleteSuccessDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Local storage key for persistent game tracking
  const STORAGE_KEY = `solrps_created_games_${wallet.userId || 'default'}`;

  // Auto-connect wallet and load persistent games
  useEffect(() => {
    if (!wallet.userId) {
      wallet.connect('seed_alice', 500000, 'Alice');
    } else {
      loadPersistentGames();
    }
  }, [wallet.userId]);

  // Check for resolved games every time component mounts
  useEffect(() => {
    if (wallet.userId && createdSessions.length > 0) {
      checkForResolvedGames();
    }
  }, [createdSessions, wallet.userId]);

  const loadPersistentGames = () => {
    if (!wallet.userId) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const games = JSON.parse(stored);
        // Filter out locally deleted games
        const activeGames = games.filter((game: SessionCard) => !game.isLocallyDeleted);
        setCreatedSessions(activeGames);
      }
    } catch (error) {
      console.error('Failed to load persistent games:', error);
    }
  };

  const checkForResolvedGames = async () => {
    if (!wallet.userId || createdSessions.length === 0) return;

    try {
      // Check each session's current status
      const updatedSessions = [];
      
      for (const session of createdSessions) {
        try {
          const response = await fetch(`/api/session/${session.id}`);
          if (response.ok) {
            const sessionData = await response.json();
            
            // If session is resolved, don't include it
            if (sessionData.status !== 'RESOLVED') {
              updatedSessions.push({ ...session, status: sessionData.status });
            }
          }
        } catch (error) {
          // If session doesn't exist anymore, remove it
          continue;
        }
      }

      // Only update if there's a change
      if (updatedSessions.length !== createdSessions.length) {
        setCreatedSessions(updatedSessions);
        savePersistentGames(updatedSessions);
      }
      
    } catch (error) {
      console.error('Failed to check resolved games:', error);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Check for resolved games
      await checkForResolvedGames();
      
      // Force refresh balance too
      if (wallet.userId) {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
        }
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const savePersistentGames = (games: SessionCard[]) => {
    if (!wallet.userId) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch (error) {
      console.error('Failed to save persistent games:', error);
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
      const salt = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const moveString = selectedMoves.join('');
      const commitHash = await simpleHash(moveString + salt);
      
      const requestBody = {
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        commitHash: commitHash,
        isPrivate,
        // For instant resolution: include moves and salt
        moves: selectedMoves,
        salt: salt
      };

      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = 'Failed to create game';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      
      // Store moves and salt in localStorage for later reveal
      if (typeof window !== 'undefined') {
        localStorage.setItem(`solrps_moves_${data.id}`, JSON.stringify(selectedMoves));
        localStorage.setItem(`solrps_salt_${data.id}`, salt);
      }
      
      // Create new session and persist it
      const newSession: SessionCard = {
        id: data.id,
        creator: wallet.userId!,
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        totalStake: selectedRounds * selectedStake,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
        isLocallyDeleted: false,
      };
      
      const updatedSessions = [...createdSessions, newSession];
      setCreatedSessions(updatedSessions);
      savePersistentGames(updatedSessions);

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
      
      // Show success dialog
      setShowSuccessDialog(true);
      
    } catch (error: any) {
      console.error('Failed to create game:', error);
      alert(`Failed to create game: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (sessionId: string) => {
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

      // Mark as locally deleted and persist
      const updatedSessions = createdSessions.map(session => 
        session.id === sessionToDelete 
          ? { ...session, isLocallyDeleted: true }
          : session
      ).filter(session => !session.isLocallyDeleted); // Remove from display
      
      setCreatedSessions(updatedSessions);
      savePersistentGames([
        ...updatedSessions,
        ...createdSessions
          .filter(s => s.id === sessionToDelete)
          .map(s => ({ ...s, isLocallyDeleted: true }))
      ]);
      
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

      // Show success dialog
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

  // Show loading if wallet not connected
  if (!wallet.userId) {
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

      {/* Phase 2 Mode Indicator */}
      <div className="bg-slate-800 border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">🔧 Mock Mode</h3>
            <p className="text-gray-400 text-sm">
              Games use mock escrow. No real transactions.
            </p>
          </div>
          
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1 rounded bg-yellow-600 text-black">
              MOCK
            </span>
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
              PHASE 2
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Game Creation Form */}
        <div className="bg-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Game Settings</h2>
          
          {/* Current Balance */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-300">Your Balance:</span>
              <span className="font-mono text-blue-200">
                {(wallet.balance || 0).toLocaleString()} RPS
              </span>
            </div>
          </div>
          
          {/* Rounds Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Rounds</label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 3, 5] as const).map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => setSelectedRounds(rounds)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedRounds === rounds
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-white/20 bg-white/5 text-gray-300 hover:border-white/40'
                  }`}
                >
                  {rounds} Round{rounds > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Stake Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Stake per Round</label>
            <div className="grid grid-cols-3 gap-2">
              {([100, 500, 1000] as const).map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedStake === stake
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-white/20 bg-white/5 text-gray-300 hover:border-white/40'
                  }`}
                >
                  {stake.toLocaleString()} RPS
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Setting */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Private game (invite only)</span>
            </label>
          </div>

          {/* Move Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Your Moves ({selectedMoves.filter(Boolean).length}/{selectedRounds})
            </label>
            
            <div className="space-y-3">
              {Array.from({ length: selectedRounds }, (_, roundIndex) => (
                <div key={roundIndex} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Round {roundIndex + 1}:</span>
                    
                    <div className="flex gap-2">
                      {(['R', 'P', 'S'] as Move[]).map((move) => {
                        const isSelected = selectedMoves[roundIndex] === move;
                        
                        return (
                          <button
                            key={move}
                            onClick={() => selectMove(roundIndex, move)}
                            disabled={isCreating}
                            className={`w-12 h-12 rounded-lg border transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-500/20 text-white scale-110' 
                                : 'border-white/20 bg-white/5 text-gray-300 hover:border-white/40 hover:scale-105'
                            } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="text-lg">{getMoveEmoji(move)}</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <span className="text-xs text-gray-400 min-w-[60px] text-right">
                      {selectedMoves[roundIndex] ? getMoveEmoji(selectedMoves[roundIndex]) : '?'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Summary */}
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total Stake:</span>
                <span className="font-mono">{(selectedRounds * selectedStake).toLocaleString()} RPS</span>
              </div>
              <div className="flex justify-between">
                <span>Potential Pot:</span>
                <span className="font-mono">{(selectedRounds * selectedStake * 2).toLocaleString()} RPS</span>
              </div>
              <div className="flex justify-between">
                <span>Fees (5%):</span>
                <span className="font-mono">{Math.floor(selectedRounds * selectedStake * 2 * 0.05).toLocaleString()} RPS</span>
              </div>
              <div className="flex justify-between text-green-400">
                <span>Winner Gets:</span>
                <span className="font-mono">{Math.floor(selectedRounds * selectedStake * 2 * 0.95).toLocaleString()} RPS</span>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateGame}
            disabled={!canCreateGame || isCreating}
            className={`w-full py-3 rounded-lg font-medium transition-all ${
              canCreateGame && !isCreating
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isCreating ? 'Creating Game...' : 'Create Game'}
          </button>

          {/* Error Messages */}
          {!canCreateGame && (
            <p className="text-red-400 text-sm text-center">
              {selectedMoves.filter(Boolean).length !== selectedRounds 
                ? 'Please select all moves'
                : 'Insufficient balance'
              }
            </p>
          )}
        </div>

        {/* Created Sessions */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Games</h2>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                isRefreshing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRefreshing ? '⟳ Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
          
          {createdSessions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No active games
            </p>
          ) : (
            <div className="space-y-3">
              {createdSessions.map((session) => (
                <div key={session.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        {session.rounds} Rounds • {session.stakePerRound.toLocaleString()} RPS
                      </div>
                      <div className="text-xs text-gray-400">
                        ID: {session.id.slice(0, 8)}...{session.id.slice(-8)}
                      </div>
                    </div>
                    
                    <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded">
                      AVAILABLE
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(session.id)}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Copy ID
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(session.id)}
                      disabled={deletingSessionId === session.id}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      {deletingSessionId === session.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Success Dialog */}
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

      {/* Delete Confirmation Dialog */}
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
            <p className="text-gray-400 text-sm mb-6">You'll get a refund minus 5% fees.</p>
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

      {/* Delete Success Dialog */}
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
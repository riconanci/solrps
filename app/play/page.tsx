// app/play/page.tsx - COMPLETE VERSION WITH ALL ORIGINAL FEATURES + ALICE'S REAL MOVES FIX
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

  // ENHANCED WALLET INITIALIZATION - Force correct user detection
  useEffect(() => {
    const initializeWallet = async () => {
      console.log('Initializing wallet...');
      
      // Force detect user from URL
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user') || 'alice';
      const targetUserId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
      
      console.log(`URL says user should be: ${userParam} (${targetUserId})`);
      console.log(`Current wallet state:`, {
        userId: wallet.userId,
        displayName: wallet.displayName,
        isConnected: wallet.isConnected
      });
      
      // Force switch if needed
      if (!wallet.isConnected || wallet.userId !== targetUserId) {
        console.log(`Wallet needs switching from ${wallet.userId} to ${targetUserId}`);
        
        try {
          await wallet.switchUser(targetUserId);
          console.log(`Wallet switched successfully to: ${wallet.displayName} (${wallet.userId})`);
        } catch (error) {
          console.error('Failed to switch wallet:', error);
        }
      } else {
        console.log(`Wallet already correct: ${wallet.displayName} (${wallet.userId})`);
      }
    };

    // Initialize wallet first
    if (!wallet.userId) {
      initializeWallet();
    } else {
      // If wallet already connected, load persistent games
      loadPersistentGames();
    }
  }, [wallet.userId]);

  // Check for resolved games every time component mounts
  useEffect(() => {
    if (wallet.userId && createdSessions.length > 0) {
      checkForResolvedGames();
    }
  }, [createdSessions, wallet.userId]);

  // Initialize moves array when rounds change
  useEffect(() => {
    setSelectedMoves(new Array(selectedRounds).fill('R'));
  }, [selectedRounds]);

  const loadPersistentGames = () => {
    if (!wallet.userId) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const games = JSON.parse(stored);
        // Filter out locally deleted games
        const activeGames = games.filter((game: SessionCard) => !game.isLocallyDeleted);
        setCreatedSessions(activeGames);
        console.log(`Loaded ${activeGames.length} persistent games for ${wallet.displayName}`);
      }
    } catch (error) {
      console.error('Failed to load persistent games:', error);
    }
  };

  const savePersistentGames = (games: SessionCard[]) => {
    if (!wallet.userId) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
      console.log(`Saved ${games.length} games to localStorage`);
    } catch (error) {
      console.error('Failed to save persistent games:', error);
    }
  };

  const checkForResolvedGames = async () => {
    if (!wallet.userId || createdSessions.length === 0) return;

    try {
      // Check each session's current status
      const updatedSessions = [];
      let hasChanges = false;
      
      for (const session of createdSessions) {
        try {
          const response = await fetch(`/api/session/${session.id}`);
          if (response.ok) {
            const sessionData = await response.json();
            
            // If session is resolved, don't include it
            if (sessionData.status !== 'RESOLVED') {
              const updatedSession = { ...session, status: sessionData.status };
              updatedSessions.push(updatedSession);
              
              // Check if status changed
              if (session.status !== sessionData.status) {
                hasChanges = true;
              }
            } else {
              hasChanges = true; // Game was resolved, remove from list
              console.log(`Session ${session.id} resolved, removing from list`);
            }
          } else {
            // Session doesn't exist anymore, remove it
            hasChanges = true;
            console.log(`Session ${session.id} no longer exists, removing`);
          }
        } catch (error) {
          // If session check fails, remove it from the list
          hasChanges = true;
          console.log(`Session ${session.id} check failed, removing`);
        }
      }

      // Only update if there's a change
      if (hasChanges) {
        setCreatedSessions(updatedSessions);
        savePersistentGames(updatedSessions);
        console.log(`Updated sessions: ${createdSessions.length} -> ${updatedSessions.length}`);
      }
      
    } catch (error) {
      console.error('Failed to check resolved games:', error);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('Manual refresh started...');
      
      // Check for resolved games
      await checkForResolvedGames();
      
      // Force refresh balance too
      if (wallet.userId) {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
          console.log(`Refreshed balance: ${userData.balance}`);
        }
      }
      
      console.log('Manual refresh completed');
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

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
      
      console.log(`Creating game with moves: ${selectedMoves.join(',')} and salt: ${salt}`);
      
      const requestBody = {
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        commitHash: commitHash,
        isPrivate,
        // CRUCIAL: Send Alice's actual moves and salt to be stored
        moves: selectedMoves,
        salt: salt,
        userId: wallet.userId // Explicit user ID for API detection
      };

      console.log('Create game request:', requestBody);

      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': wallet.userId || '',
          'X-User-Name': wallet.displayName || ''
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('Create game raw response:', responseText);

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
      console.log('Create game parsed response:', data);
      
      // Store moves and salt in localStorage for later reveal (Phase 2 compatibility)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`solrps_moves_${data.sessionId}`, JSON.stringify(selectedMoves));
        localStorage.setItem(`solrps_salt_${data.sessionId}`, salt);
        console.log(`Stored moves and salt for session ${data.sessionId}`);
      }
      
      // Create new session and persist it
      const newSession: SessionCard = {
        id: data.sessionId,
        creator: wallet.displayName || wallet.userId || 'You',
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        totalStake: selectedRounds * selectedStake,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
        isLocallyDeleted: false,
      };
      
      const updatedSessions = [newSession, ...createdSessions];
      setCreatedSessions(updatedSessions);
      savePersistentGames(updatedSessions);

      // Reset form to defaults
      setSelectedMoves(new Array(selectedRounds).fill('R'));
      
      // Refresh wallet balance
      try {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
          console.log(`Balance updated after game creation: ${userData.balance}`);
        }
      } catch (e) {
        console.warn('Failed to refresh balance:', e);
      }
      
      // Show success dialog
      setShowSuccessDialog(true);
      
      console.log(`Game created successfully: ${data.sessionId}`);
      
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

      console.log(`Successfully cancelled session ${sessionToDelete}`);

      // Mark as locally deleted and persist
      const updatedSessions = createdSessions
        .filter(session => session.id !== sessionToDelete); // Remove from display
      
      setCreatedSessions(updatedSessions);
      savePersistentGames([
        ...updatedSessions,
        // Keep record of deleted session in localStorage for tracking
        ...createdSessions
          .filter(s => s.id === sessionToDelete)
          .map(s => ({ ...s, isLocallyDeleted: true }))
      ]);
      
      // Refresh wallet balance (user gets refund)
      try {
        const userResponse = await fetch(`/api/user/${wallet.userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          wallet.setBalance(userData.balance);
          console.log(`Balance updated after deletion: ${userData.balance}`);
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
        // Fallback for older browsers
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
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-lg">Loading wallet...</div>
          <div className="text-sm text-gray-400 mt-2">Connecting as user...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🎮 Create Game</h1>
        <p className="text-gray-400">Set up your Rock Paper Scissors challenge</p>
        <div className="mt-4 bg-slate-800 rounded-lg px-6 py-3 inline-block">
          <div className="text-sm text-gray-400 mb-1">Playing as</div>
          <div className="text-lg font-medium text-blue-400">
            {wallet.displayName || 'Unknown'}
          </div>
          <div className="text-sm">
            <span className="text-gray-400">Balance: </span>
            <span className="text-green-400 font-mono">
              {(wallet.balance || 0).toLocaleString()} tokens
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2 Mode Indicator */}
      <div className="bg-slate-800 border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">🔧 Phase 1 - Mock Mode</h3>
            <p className="text-gray-400 text-sm">
              Games use mock escrow. No real transactions. Alice's actual moves now used!
            </p>
          </div>
          <div className="flex gap-1">
            <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded">
              MOCK
            </span>
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
              PHASE 2 READY
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Game Creation Form */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-6">Create New Game</h2>

          {/* Rounds Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Number of Rounds</label>
            <div className="grid grid-cols-3 gap-3">
              {([1, 3, 5] as const).map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => setSelectedRounds(rounds)}
                  className={`p-3 rounded-lg border-2 transition-colors text-center ${
                    selectedRounds === rounds
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{rounds}</div>
                  <div className="text-xs opacity-75">Round{rounds > 1 ? 's' : ''}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stake Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Stake per Round</label>
            <div className="grid grid-cols-3 gap-3">
              {([100, 500, 1000] as const).map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake)}
                  className={`p-3 rounded-lg border-2 transition-colors text-center ${
                    selectedStake === stake
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{stake}</div>
                  <div className="text-xs opacity-75">Tokens</div>
                </button>
              ))}
            </div>
          </div>

          {/* Move Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Your Moves (These will be used in the game!)</label>
            <div className="space-y-4">
              {Array.from({ length: selectedRounds }, (_, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-3">Round {index + 1}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['R', 'P', 'S'] as Move[]).map((move) => (
                      <button
                        key={move}
                        onClick={() => selectMove(index, move)}
                        className={`p-3 rounded-lg border-2 transition-colors text-center ${
                          selectedMoves[index] === move
                            ? 'bg-green-600 text-white border-green-400'
                            : 'bg-white/10 hover:bg-white/20 border-transparent'
                        }`}
                      >
                        <div className="text-xl mb-1">{getMoveEmoji(move)}</div>
                        <div className="text-xs">{getMoveLabel(move)}</div>
                      </button>
                    ))}
                  </div>
                  <div className="text-center mt-3">
                    <div className="text-2xl">
                      {selectedMoves[index] ? getMoveEmoji(selectedMoves[index]) : '❓'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {selectedMoves[index] ? getMoveLabel(selectedMoves[index]) : 'Choose your move'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Settings */}
          <div className="mb-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm">Private Game (invite only)</span>
            </label>
          </div>

          {/* Cost Summary */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span>Rounds:</span>
                <span>{selectedRounds}</span>
              </div>
              <div className="flex justify-between">
                <span>Stake per Round:</span>
                <span>{selectedStake} tokens</span>
              </div>
              <div className="flex justify-between font-semibold text-yellow-400">
                <span>Total Cost:</span>
                <span>{selectedRounds * selectedStake} tokens</span>
              </div>
              <div className="flex justify-between text-green-400">
                <span>Potential Win:</span>
                <span>{Math.floor((selectedRounds * selectedStake * 2) * 0.95)} tokens</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>Fees (on wins only):</span>
                <span>5% of pot</span>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateGame}
            disabled={!canCreateGame || isCreating}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              canCreateGame && !isCreating
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isCreating ? 'Creating Game...' : 'Create Game'}
          </button>

          {/* Error Messages */}
          {!canCreateGame && (
            <div className="text-center mt-3">
              {selectedMoves.filter(Boolean).length !== selectedRounds ? (
                <p className="text-yellow-400 text-sm">Please select moves for all rounds</p>
              ) : (
                <p className="text-red-400 text-sm">Insufficient balance</p>
              )}
            </div>
          )}
        </div>

        {/* Your Games */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Your Games ({createdSessions.length})</h2>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                isRefreshing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRefreshing ? '⟳' : '🔄'} 
              {isRefreshing ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {createdSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-2xl mb-2">🎮</div>
              <div>No active games</div>
              <div className="text-sm mt-1">Create your first game to get started!</div>
            </div>
          ) : (
            <div className="space-y-4">
              {createdSessions.map((session) => (
                <div key={session.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        {session.rounds} rounds @ {session.stakePerRound} each
                      </div>
                      <div className="text-sm text-gray-400">
                        Total: {session.totalStake} tokens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Status</div>
                      <div className={`px-2 py-1 rounded text-xs ${
                        session.status === 'OPEN' ? 'bg-yellow-600 text-yellow-100' :
                        session.status === 'AWAITING_REVEAL' ? 'bg-orange-600 text-orange-100' :
                        'bg-green-600 text-green-100'
                      }`}>
                        {session.status === 'OPEN' ? 'WAITING' : 
                         session.status === 'AWAITING_REVEAL' ? 'JOINED' : 
                         session.status}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(session.id)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    >
                      📋 Copy Session ID
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(session.id)}
                      disabled={deletingSessionId === session.id}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                    >
                      {deletingSessionId === session.id ? '⟳' : '🗑️'}
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2 font-mono">
                    {session.id.slice(0, 12)}...{session.id.slice(-8)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-xl font-bold mb-2">Game Created!</h3>
              <p className="text-gray-400 mb-6">
                Your game is now live and ready for challengers to join. Your selected moves will be used in the actual game!
              </p>
              <button
                onClick={() => setShowSuccessDialog(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold mb-2">Delete Game?</h3>
              <p className="text-gray-400 mb-6">
                This will cancel the game and refund your stake. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Delete Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Dialog */}
      {showDeleteSuccessDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-2">Game Deleted!</h3>
              <p className="text-gray-400 mb-6">
                Your game has been cancelled and your stake has been refunded.
              </p>
              <button
                onClick={() => setShowDeleteSuccessDialog(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
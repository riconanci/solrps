// app/play/page.tsx - COMPLETE REWRITE - Fixed Balance & User Detection
"use client";
import { useEffect, useState } from "react";
import { useWallet } from "../../src/state/wallet";

type Move = 'R' | 'P' | 'S';

interface SessionCard {
  id: string;
  creator: string;
  creatorId: string;
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
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Move helper functions
  const getMoveEmoji = (move: Move): string => {
    switch (move) {
      case 'R': return '🪨';
      case 'P': return '📄';
      case 'S': return '✂️';
    }
  };

  // FIXED: Proper wallet initialization with balance persistence
  useEffect(() => {
    const initializeWallet = async () => {
      if (isInitialized) return;
      
      console.log('🎮 Initializing wallet...');
      
      // Determine user from URL
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user') || 'alice';
      const targetUserId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
      
      console.log(`Target user: ${userParam} (${targetUserId})`);
      
      try {
        // Always fetch fresh data from API
        const response = await fetch(`/api/user/${targetUserId}`);
        if (response.ok) {
          const userData = await response.json();
          console.log(`✅ Fetched user data:`, userData);
          
          // Connect with real balance from database
          wallet.connect(
            targetUserId, 
            userData.mockBalance || userData.balance || 500000, 
            userData.displayName || (targetUserId === 'seed_alice' ? 'Alice' : 'Bob')
          );
          
          console.log(`✅ Connected as: ${userData.displayName || targetUserId} with balance: ${userData.mockBalance}`);
        } else {
          throw new Error(`API responded with ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch user data, using defaults:', error);
        
        // Fallback to seed data
        const defaultBalance = 500000;
        const displayName = targetUserId === 'seed_alice' ? 'Alice' : 'Bob';
        wallet.connect(targetUserId, defaultBalance, displayName);
      }
      
      setIsInitialized(true);
    };

    if (!wallet.isConnected || !isInitialized) {
      initializeWallet();
    }
  }, []); // Remove wallet dependencies to prevent loops

  // Load games after wallet is initialized
  useEffect(() => {
    if (wallet.isConnected && isInitialized) {
      loadPersistentGames();
      checkForResolvedGames();
    }
  }, [wallet.isConnected, wallet.userId, isInitialized]);

  // Initialize moves when rounds change
  useEffect(() => {
    setSelectedMoves(new Array(selectedRounds).fill('R'));
  }, [selectedRounds]);

  // FIXED: Game persistence with proper user filtering
  const loadPersistentGames = async () => {
    if (!wallet.userId) return;
    
    console.log(`📚 Loading games for: ${wallet.displayName} (${wallet.userId})`);
    
    try {
      // First, try to load from API (shows server-side games)
      const response = await fetch(`/api/session/my?userId=${wallet.userId}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded ${data.sessions?.length || 0} games from API`);
        
        if (data.sessions && data.sessions.length > 0) {
          const apiSessions: SessionCard[] = data.sessions.map((s: any) => ({
            id: s.id,
            creator: wallet.displayName || 'You',
            creatorId: wallet.userId || '',
            rounds: s.rounds,
            stakePerRound: s.stakePerRound,
            totalStake: s.totalStake,
            createdAt: s.createdAt || new Date().toISOString(),
            status: s.status || 'OPEN'
          }));
          
          setCreatedSessions(apiSessions);
          
          // Also save to localStorage for persistence
          const STORAGE_KEY = `solrps_created_games_${wallet.userId}`;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(apiSessions));
          return;
        }
      }
      
      // Fallback to localStorage
      const STORAGE_KEY = `solrps_created_games_${wallet.userId}`;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const games = JSON.parse(stored);
        const activeGames = games.filter((game: SessionCard) => !game.isLocallyDeleted);
        console.log(`📦 Loaded ${activeGames.length} games from localStorage`);
        setCreatedSessions(activeGames);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
    }
  };

  const savePersistentGames = (games: SessionCard[]) => {
    if (!wallet.userId) return;
    try {
      const STORAGE_KEY = `solrps_created_games_${wallet.userId}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch (error) {
      console.error('Failed to save games:', error);
    }
  };

  // Check for resolved games
  const checkForResolvedGames = async () => {
    if (!wallet.userId || createdSessions.length === 0) return;

    try {
      for (const session of createdSessions) {
        if (session.status === 'OPEN') {
          const response = await fetch(`/api/session/${session.id}`);
          if (response.ok) {
            const sessionData = await response.json();
            if (sessionData.status !== 'OPEN') {
              console.log(`🎯 Game ${session.id} resolved, removing from display`);
              const updatedSessions = createdSessions.filter(s => s.id !== session.id);
              setCreatedSessions(updatedSessions);
              savePersistentGames(updatedSessions);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to check resolved games:', error);
    }
  };

  // Move selection
  const selectMove = (roundIndex: number, move: Move) => {
    const newMoves = [...selectedMoves];
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
  };

  // Hash function for commit-reveal
  const simpleHash = async (input: string): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(16, '0');
    }
  };

  // FIXED: Create game with proper balance updates
  const handleCreateGame = async () => {
    if (!canCreateGame) return;

    setIsCreating(true);
    try {
      const salt = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const moveString = selectedMoves.join('');
      const commitHash = await simpleHash(moveString + salt);
      
      const requestBody = {
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        commitHash: commitHash,
        isPrivate,
        moves: selectedMoves,
        salt: salt,
        userId: wallet.userId
      };

      console.log(`🎮 Creating game for ${wallet.displayName}:`, requestBody);

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
      console.log('✅ Game created successfully:', data);
      
      // Store moves and salt in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`solrps_moves_${data.sessionId}`, JSON.stringify(selectedMoves));
        localStorage.setItem(`solrps_salt_${data.sessionId}`, salt);
      }

      // Add to created sessions
      const newSession: SessionCard = {
        id: data.sessionId,
        creator: wallet.displayName || 'You',
        creatorId: wallet.userId || '',
        rounds: selectedRounds,
        stakePerRound: selectedStake,
        totalStake: selectedRounds * selectedStake,
        createdAt: new Date().toISOString(),
        status: 'OPEN'
      };

      const updatedSessions = [newSession, ...createdSessions];
      setCreatedSessions(updatedSessions);
      savePersistentGames(updatedSessions);

      // FIXED: Update balance properly
      if (data.newBalance !== undefined) {
        wallet.setBalance(data.newBalance);
      } else {
        // Fallback: manually deduct the stake
        wallet.setBalance(wallet.balance - (selectedRounds * selectedStake));
      }
      
      // Show success and refresh
      setShowSuccessDialog(true);

    } catch (error) {
      console.error('❌ Create game error:', error);
      alert(`Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // FIXED: Delete game with proper refunds
  const handleDeleteGame = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    setDeletingSessionId(sessionId);
    try {
      // For OPEN games, try to cancel on server to get refund
      const session = createdSessions.find(s => s.id === sessionId);
      if (session?.status === 'OPEN') {
        try {
          const response = await fetch('/api/session/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Game cancelled, refund processed:', data);
            // Update balance if refund successful
            if (data.newBalance !== undefined) {
              wallet.setBalance(data.newBalance);
            }
          }
        } catch (error) {
          console.log('Cancel API failed, will delete locally only:', error);
        }
      }

      // Remove from local storage regardless of server response
      const updatedSessions = createdSessions.filter(s => s.id !== sessionId);
      setCreatedSessions(updatedSessions);
      savePersistentGames(updatedSessions);

      // Clean up localStorage
      localStorage.removeItem(`solrps_moves_${sessionId}`);
      localStorage.removeItem(`solrps_salt_${sessionId}`);

    } catch (error) {
      console.error('❌ Delete game error:', error);
      alert('Failed to delete game');
    } finally {
      setDeletingSessionId(null);
    }
  };

  // FIXED: Manual refresh with balance update
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh wallet balance first
      if (wallet.userId) {
        const response = await fetch(`/api/user/${wallet.userId}`);
        if (response.ok) {
          const userData = await response.json();
          wallet.setBalance(userData.mockBalance || userData.balance);
          console.log(`✅ Balance refreshed: ${userData.mockBalance}`);
        }
      }
      
      // Then check for resolved games
      await checkForResolvedGames();
      
      // Reload persistent games
      await loadPersistentGames();
      
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copy session ID
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert('Session ID copied to clipboard!');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Session ID copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      alert(`Copy failed. Session ID: ${text}`);
    }
  };

  // FIXED: Handle success dialog dismissal with proper refresh
  const handleSuccessDialogClose = async () => {
    setShowSuccessDialog(false);
    // Refresh both sections
    await loadPersistentGames();
    await handleManualRefresh();
  };

  // Validation
  const allMovesSelected = selectedMoves.filter(Boolean).length === selectedRounds;
  const hasEnoughBalance = wallet.balance >= (selectedRounds * selectedStake);
  const canCreateGame = allMovesSelected && hasEnoughBalance && !isCreating && wallet.isConnected;

  // FIXED: Loading state with better user feedback
  if (!isInitialized || !wallet.isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-4">⚡</div>
          <div className="text-lg mb-2">Loading wallet...</div>
          <div className="text-sm text-gray-400">
            {!isInitialized ? 'Initializing...' : 'Connecting user...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 min-h-screen bg-slate-900 text-white">
      {/* FIXED: Header with proper balance display */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">🎮 Create Game</h1>
        <div className="bg-slate-800 rounded-lg px-4 py-2 inline-block">
          <div className="text-sm font-medium text-blue-400">
            {wallet.displayName} ({wallet.userId?.slice(-4)})
          </div>
          <div className="text-xs">
            <span className="text-green-400 font-mono">
              {(wallet.balance || 0).toLocaleString()} RPS
            </span>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleSuccessDialogClose}
        >
          <div 
            className="bg-slate-800 rounded-xl p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-400">Game Successfully Created</h3>
            <p className="text-gray-400 text-sm mt-4">Click anywhere to continue</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Game Form */}
        <div className="bg-slate-800 rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Game</h2>

          {/* Rounds Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Rounds</label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 3, 5] as const).map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => setSelectedRounds(rounds)}
                  className={`py-2 px-3 rounded-lg border transition-colors text-center ${
                    selectedRounds === rounds
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{rounds}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stake Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Stake per Round</label>
            <div className="grid grid-cols-3 gap-2">
              {([100, 500, 1000] as const).map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake)}
                  className={`py-2 px-3 rounded-lg border transition-colors text-center ${
                    selectedStake === stake
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{stake}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Move Selection - Emojis Only */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Your Moves</label>
            <div className="space-y-2">
              {Array.from({ length: selectedRounds }, (_, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-2">Round {index + 1}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['R', 'P', 'S'] as Move[]).map((move) => (
                      <button
                        key={move}
                        onClick={() => selectMove(index, move)}
                        className={`py-3 px-3 rounded-lg border transition-colors text-center ${
                          selectedMoves[index] === move
                            ? 'bg-green-600 text-white border-green-400'
                            : 'bg-white/10 hover:bg-white/20 border-transparent'
                        }`}
                      >
                        <div className="text-2xl">{getMoveEmoji(move)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Private Game Option */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
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
          <div className="bg-white/5 rounded-lg p-3 mb-4">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-semibold text-yellow-400">{selectedRounds * selectedStake} RPS</span>
              </div>
              <div className="flex justify-between">
                <span>Potential Win:</span>
                <span className="text-green-400">{Math.floor((selectedRounds * selectedStake * 2) * 0.95)} RPS</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Fees (wins only):</span>
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
          {!canCreateGame && wallet.isConnected && (
            <div className="text-center mt-2">
              {!allMovesSelected ? (
                <p className="text-yellow-400 text-xs">Select moves for all rounds</p>
              ) : !hasEnoughBalance ? (
                <p className="text-red-400 text-xs">Insufficient balance (need {selectedRounds * selectedStake} RPS)</p>
              ) : (
                <p className="text-gray-400 text-xs">Loading...</p>
              )}
            </div>
          )}
        </div>

        {/* FIXED: Your Games section */}
        <div className="bg-slate-800 rounded-xl p-4 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Your Games ({createdSessions.length})
              {wallet.displayName && (
                <span className="text-sm text-gray-400 font-normal ml-2">
                  - {wallet.displayName}
                </span>
              )}
            </h2>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 text-sm ${
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
              <div className="text-xs mt-1">Create your first game to get started!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {createdSessions.map((session) => (
                <div key={session.id} className="bg-white/5 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm">
                        {session.rounds} rounds × {session.stakePerRound} RPS
                      </div>
                      <div className="text-xs text-gray-400">
                        Total: {session.totalStake} RPS
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {session.id.slice(0, 8)}...
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      session.status === 'OPEN' ? 'bg-yellow-600 text-yellow-100' :
                      session.status === 'AWAITING_REVEAL' ? 'bg-orange-600 text-orange-100' :
                      'bg-green-600 text-green-100'
                    }`}>
                      {session.status === 'OPEN' ? 'WAITING' : 
                       session.status === 'AWAITING_REVEAL' ? 'IN PROGRESS' : 'COMPLETED'}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(session.id)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-2 py-1 rounded text-xs"
                      title="Copy Session ID"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleDeleteGame(session.id)}
                      disabled={deletingSessionId === session.id}
                      className={`bg-red-600/20 hover:bg-red-600/30 text-red-400 px-2 py-1 rounded text-xs ${
                        deletingSessionId === session.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title="Delete Game"
                    >
                      {deletingSessionId === session.id ? '⟳' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
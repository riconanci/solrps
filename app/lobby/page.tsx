// app/lobby/page.tsx - UPDATED WITH WORKING USER DETECTION & JOIN API
"use client";
import { useState, useEffect } from "react";
import { useWallet } from "../../src/state/wallet";

// Types
type Move = 'R' | 'P' | 'S';

interface Session {
  id: string;
  creatorId: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  status: string;
  createdAt: string;
}

interface GameResult {
  success: boolean;
  didWin: boolean;
  isDraw: boolean;
  balanceChange: number;
  newBalance: number;
  creatorMoves: Move[];
  challengerMoves: Move[];
  matchResult: {
    creatorWins: number;
    challengerWins: number;
    draws: number;
    pot: number;
  };
  message: string;
}

interface Filters {
  rounds: 'any' | 1 | 3 | 5;
  stake: 'any' | 100 | 500 | 1000;
}

export default function LobbyPage() {
  const wallet = useWallet();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    rounds: 'any',
    stake: 'any'
  });

  // Manual join states
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [manualSessionId, setManualSessionId] = useState('');
  const [manualJoinLoading, setManualJoinLoading] = useState(false);

  // ENHANCED WALLET INITIALIZATION - Force correct user detection
  useEffect(() => {
    const initializeWallet = async () => {
      console.log('🎮 Initializing wallet...');
      
      // Force detect user from URL
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user') || 'alice';
      const targetUserId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
      
      console.log(`🎮 URL says user should be: ${userParam} (${targetUserId})`);
      console.log(`🎮 Current wallet state:`, {
        userId: wallet.userId,
        displayName: wallet.displayName,
        isConnected: wallet.isConnected
      });
      
      // Force switch if needed
      if (!wallet.isConnected || wallet.userId !== targetUserId) {
        console.log(`🎮 Wallet needs switching from ${wallet.userId} to ${targetUserId}`);
        
        try {
          await wallet.switchUser(targetUserId);
          console.log(`✅ Wallet switched successfully to: ${wallet.displayName} (${wallet.userId})`);
        } catch (error) {
          console.error('❌ Failed to switch wallet:', error);
          setError('Failed to load wallet');
        }
      } else {
        console.log(`✅ Wallet already correct: ${wallet.displayName} (${wallet.userId})`);
      }
    };

    initializeWallet();
  }, []);

  // Load sessions when wallet is connected
  useEffect(() => {
    if (wallet.isConnected) {
      loadSessions();
    }
  }, [wallet.isConnected]);

  // Apply filters when sessions or filters change
  useEffect(() => {
    applyFilters();
  }, [sessions, filters]);

  const loadSessions = async () => {
    if (!wallet.isConnected) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Loading sessions...');
      const response = await fetch('/api/lobby');
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      console.log('Sessions response:', data);
      
      if (data.items) {
        // Filter to only open sessions that aren't created by current user
        const availableSessions = data.items.filter((session: Session) => 
          session.status === 'OPEN' && session.creatorId !== wallet.userId
        );
        
        console.log(`Available sessions for ${wallet.displayName}:`, availableSessions);
        setSessions(availableSessions);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load games');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    // Filter by rounds
    if (filters.rounds !== 'any') {
      filtered = filtered.filter(session => session.rounds === filters.rounds);
    }

    // Filter by stake per round
    if (filters.stake !== 'any') {
      filtered = filtered.filter(session => session.stakePerRound === filters.stake);
    }

    setFilteredSessions(filtered);
  };

  const handleFilterChange = (type: keyof Filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      rounds: 'any',
      stake: 'any'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.rounds !== 'any') count++;
    if (filters.stake !== 'any') count++;
    return count;
  };

  const handleManualJoin = async () => {
    if (!manualSessionId.trim()) {
      alert('Please enter a session ID');
      return;
    }

    setManualJoinLoading(true);

    try {
      // First fetch the session details to validate it exists
      const response = await fetch(`/api/session/${manualSessionId.trim()}`);
      
      if (!response.ok) {
        throw new Error('Session not found or invalid');
      }

      const sessionData = await response.json();
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to fetch session');
      }

      const session = sessionData.session;

      // Check if user can afford it
      const balance = wallet.balance || 0;
      if (balance < session.totalStake) {
        alert(`Insufficient balance! You need ${session.totalStake.toLocaleString()} tokens but only have ${balance.toLocaleString()}.`);
        return;
      }

      // Check if it's their own session
      if (session.creatorId === wallet.userId) {
        alert('You cannot join your own game!');
        return;
      }

      // Check if session is still open
      if (session.status !== 'OPEN') {
        alert('This game is no longer available to join');
        return;
      }

      // If all checks pass, open the join modal
      setSelectedSession(session);
      setShowManualJoin(false);
      setManualSessionId('');

    } catch (error: any) {
      console.error('Manual join error:', error);
      alert(error.message || 'Failed to join game. Please check the session ID.');
    } finally {
      setManualJoinLoading(false);
    }
  };

  const handleJoinGame = (session: Session) => {
    const balance = wallet.balance || 0;
    
    if (balance < session.totalStake) {
      alert(`Insufficient balance! You need ${session.totalStake.toLocaleString()} tokens but only have ${balance.toLocaleString()}.`);
      return;
    }
    
    setSelectedSession(session);
  };

  const handleGameComplete = (result: GameResult) => {
    console.log('Game completed:', result);
    setGameResult(result);
    setSelectedSession(null);
    
    // Update wallet balance
    wallet.setBalance(result.newBalance);
  };

  const handleCloseResult = () => {
    setGameResult(null);
    loadSessions(); // Refresh sessions after closing result
  };

  // Loading state
  if (!wallet.isConnected && !error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-lg">Loading wallet...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2 text-red-400">❌</div>
          <div className="text-lg text-red-400">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">🏢 Game Lobby</h1>
          <div className="bg-slate-800 rounded-lg px-6 py-3 inline-block">
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

        {/* Games Section */}
        <div className="bg-slate-800 rounded-xl p-6">
          {/* Header with Controls */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold">
              Available Games ({filteredSessions.length})
              {filteredSessions.length !== sessions.length && (
                <span className="text-gray-400 text-base ml-2">
                  of {sessions.length} total
                </span>
              )}
            </h2>
            
            <div className="flex flex-wrap gap-3">
              {/* Manual Join Button */}
              <button
                onClick={() => setShowManualJoin(!showManualJoin)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                🔑 Join by ID
              </button>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  showFilters || getActiveFilterCount() > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
                }`}
              >
                🔍 Filters
                {getActiveFilterCount() > 0 && (
                  <span className="bg-purple-400 text-purple-900 px-2 py-1 rounded-full text-xs font-bold">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>

              {/* Refresh Button */}
              <button
                onClick={loadSessions}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? '⟳' : '🔄'} 
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Manual Join Panel */}
          {showManualJoin && (
            <div className="bg-slate-700 rounded-lg p-4 mb-6 border border-slate-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Join by Session ID</h3>
                <button
                  onClick={() => {
                    setShowManualJoin(false);
                    setManualSessionId('');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Enter Session ID (from private game invite)
                  </label>
                  <input
                    type="text"
                    value={manualSessionId}
                    onChange={(e) => setManualSessionId(e.target.value)}
                    placeholder="e.g., clxyz123abc..."
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualJoin();
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowManualJoin(false);
                      setManualSessionId('');
                    }}
                    disabled={manualJoinLoading}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualJoin}
                    disabled={manualJoinLoading || !manualSessionId.trim()}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {manualJoinLoading ? 'Checking...' : 'Join Game'}
                  </button>
                </div>

                <div className="text-xs text-gray-400">
                  💡 Tip: Session IDs are shared by game creators for private invites
                </div>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-slate-700 rounded-lg p-4 mb-6 border border-slate-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Filters</h3>
                {getActiveFilterCount() > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rounds Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Number of Rounds</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['any', 1, 3, 5].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleFilterChange('rounds', option)}
                        className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                          filters.rounds === option
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-600 hover:bg-slate-500 text-gray-200'
                        }`}
                      >
                        {option === 'any' ? 'Any' : `${option} Round${option === 1 ? '' : 's'}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Stake per Round</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['any', 100, 500, 1000].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleFilterChange('stake', option)}
                        className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                          filters.stake === option
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-600 hover:bg-slate-500 text-gray-200'
                        }`}
                      >
                        {option === 'any' ? 'Any' : `${option}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Games List */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-2xl mb-4">⚡</div>
              <div className="text-lg">Loading available games...</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-2xl mb-4">🎮</div>
              {sessions.length === 0 ? (
                <>
                  <div className="text-lg mb-2">No games available to join</div>
                  <div className="text-sm">Create a game to get started!</div>
                </>
              ) : (
                <>
                  <div className="text-lg mb-2">No games match your filters</div>
                  <div className="text-sm">Try adjusting your filter settings</div>
                  <button
                    onClick={clearFilters}
                    className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map((session) => (
                <SessionCard 
                  key={session.id}
                  session={session}
                  currentBalance={wallet.balance || 0}
                  onJoin={() => handleJoinGame(session)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Join Modal */}
      {selectedSession && (
        <JoinGameModal
          session={selectedSession}
          wallet={wallet}
          onClose={() => setSelectedSession(null)}
          onComplete={handleGameComplete}
        />
      )}

      {/* Result Modal */}
      {gameResult && (
        <GameResultModal
          result={gameResult}
          onClose={handleCloseResult}
        />
      )}
    </div>
  );
}

// Session Card Component
function SessionCard({ 
  session, 
  currentBalance, 
  onJoin 
}: { 
  session: Session;
  currentBalance: number;
  onJoin: () => void;
}) {
  const canAfford = currentBalance >= session.totalStake;
  const winAmount = Math.floor(session.totalStake * 2 * 0.95);

  return (
    <div className="bg-white/5 hover:bg-white/10 rounded-lg p-5 transition-colors border border-white/10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{session.creator}</h3>
          <p className="text-sm text-gray-400">
            {session.rounds} round{session.rounds > 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-blue-400 font-mono font-bold">
            {session.stakePerRound.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">per round</div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Pot:</span>
          <span className="text-purple-400 font-mono">
            {(session.totalStake * 2).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Winner Gets:</span>
          <span className="text-green-400 font-mono">
            {winAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Your Risk:</span>
          <span className="text-red-400 font-mono">
            {session.totalStake.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Join Button */}
      <button
        onClick={onJoin}
        disabled={!canAfford}
        className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
          canAfford
            ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
            : 'bg-red-600/50 text-red-300 cursor-not-allowed'
        }`}
      >
        {canAfford ? (
          <>
            🎮 Join Game
          </>
        ) : (
          <>
            💸 Insufficient Balance
          </>
        )}
      </button>
    </div>
  );
}

// ENHANCED JOIN GAME MODAL - Uses working join API
function JoinGameModal({ 
  session, 
  wallet, 
  onClose, 
  onComplete 
}: { 
  session: Session;
  wallet: any;
  onClose: () => void;
  onComplete: (result: GameResult) => void;
}) {
  const [moves, setMoves] = useState<Move[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const moveOptions: Move[] = ['R', 'P', 'S'];
  const moveEmojis = { R: '🪨', P: '📄', S: '✂️' };
  const moveNames = { R: 'Rock', P: 'Paper', S: 'Scissors' };

  const handleMoveSelect = (roundIndex: number, move: Move) => {
    const newMoves = [...moves];
    newMoves[roundIndex] = move;
    setMoves(newMoves);
    setError('');
  };

  const isComplete = moves.filter(Boolean).length === session.rounds;
  const canJoin = isComplete && wallet.balance >= session.totalStake;

  const handleSubmit = async () => {
    if (!canJoin || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      console.log('Joining game:', session.id, 'with moves:', moves);
      
      // ENHANCED REQUEST - Include user info for proper detection
      const response = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': wallet.userId || '',
          'X-User-Name': wallet.displayName || ''
        },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: moves,
          userId: wallet.userId, // Explicit user ID for API detection
        })
      });

      const result = await response.json();
      console.log('Join result:', result);

      if (result.success) {
        onComplete(result);
      } else {
        throw new Error(result.error || 'Failed to join game');
      }
    } catch (error: any) {
      console.error('Join game error:', error);
      setError(error.message || 'Failed to join game');
    } finally {
      setSubmitting(false);
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
              <span>Opponent:</span>
              <span className="font-medium">{session.creator}</span>
            </div>
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

        {/* Move Selection */}
        <div className="mb-6">
          <div className="text-sm font-medium mb-4">Select Your Moves for Each Round:</div>
          
          <div className="space-y-4">
            {Array.from({ length: session.rounds }, (_, roundIndex) => (
              <div key={roundIndex} className="space-y-3">
                <div className="text-sm text-gray-400">Round {roundIndex + 1}</div>
                
                <div className="grid grid-cols-3 gap-2">
                  {moveOptions.map((move) => (
                    <button
                      key={move}
                      onClick={() => handleMoveSelect(roundIndex, move)}
                      className={`p-3 rounded-lg text-center transition-colors ${
                        moves[roundIndex] === move
                          ? 'bg-blue-600 text-white border-2 border-blue-400'
                          : 'bg-white/10 hover:bg-white/20 border-2 border-transparent'
                      }`}
                    >
                      <div className="text-xl mb-1">{moveEmojis[move]}</div>
                      <div>{moveNames[move]}</div>
                    </button>
                  ))}
                </div>

                <div className="text-center">
                  <div className="text-2xl">
                    {moves[roundIndex] ? moveEmojis[moves[roundIndex]] : '❓'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {moves[roundIndex] ? moveNames[moves[roundIndex]] : 'Choose your move'}
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
              {moves.filter(Boolean).length} / {session.rounds}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(moves.filter(Boolean).length / session.rounds) * 100}%` }}
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

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!canJoin || submitting}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              canJoin && !submitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Joining...' : 'Join Game'}
          </button>
        </div>

        {/* Error Messages */}
        {!canJoin && moves.filter(Boolean).length === session.rounds && (
          <p className="text-red-400 text-sm text-center mt-3">
            Insufficient balance to join this game
          </p>
        )}

        {!canJoin && moves.filter(Boolean).length !== session.rounds && (
          <p className="text-yellow-400 text-sm text-center mt-3">
            Please select moves for all rounds
          </p>
        )}
      </div>
    </div>
  );
}

// Game Result Modal
function GameResultModal({ 
  result, 
  onClose 
}: { 
  result: GameResult;
  onClose: () => void;
}) {
  const moveEmojis = { R: '🪨', P: '📄', S: '✂️' };

  const getResultText = () => {
    if (result.isDraw) return 'DRAW!';
    return result.didWin ? 'YOU WIN!' : 'YOU LOSE!';
  };

  const getResultColor = () => {
    if (result.isDraw) return 'text-yellow-400';
    return result.didWin ? 'text-green-400' : 'text-red-400';
  };

  const getResultEmoji = () => {
    if (result.isDraw) return '🤝';
    return result.didWin ? '🎉' : '😞';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{getResultEmoji()}</div>
          <div className={`text-2xl font-bold mb-3 ${getResultColor()}`}>
            {getResultText()}
          </div>
          <div className={`text-xl font-mono ${getResultColor()}`}>
            {result.balanceChange >= 0 ? '+' : ''}{result.balanceChange.toLocaleString()} tokens
          </div>
        </div>

        {/* Game Details */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span>Your Score:</span>
              <span>{result.matchResult.challengerWins} wins</span>
            </div>
            <div className="flex justify-between">
              <span>Opponent Score:</span>
              <span>{result.matchResult.creatorWins} wins</span>
            </div>
            <div className="flex justify-between">
              <span>Draws:</span>
              <span>{result.matchResult.draws}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total Pot:</span>
              <span>{result.matchResult.pot.toLocaleString()} tokens</span>
            </div>
          </div>
        </div>

        {/* Round Results */}
        {result.creatorMoves && result.challengerMoves && (
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="text-sm font-medium mb-3">Round by Round:</div>
            <div className="space-y-2">
              {result.creatorMoves.map((creatorMove, index) => {
                const challengerMove = result.challengerMoves[index];
                const roundResult = 
                  creatorMove === challengerMove ? 'Draw' :
                  (creatorMove === 'R' && challengerMove === 'S') ||
                  (creatorMove === 'P' && challengerMove === 'R') ||
                  (creatorMove === 'S' && challengerMove === 'P') ? 'Loss' : 'Win';

                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span>Round {index + 1}:</span>
                      <span>{moveEmojis[challengerMove]} vs {moveEmojis[creatorMove]}</span>
                    </div>
                    <div>
                      <span className={`font-medium ${
                        roundResult === 'Win' ? 'text-green-400' :
                        roundResult === 'Loss' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {roundResult}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
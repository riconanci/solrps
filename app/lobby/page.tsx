// app/lobby/page.tsx - Complete rewrite independent of play page games
"use client";
import { useState, useEffect } from "react";
import { useWallet } from "../../src/state/wallet";

interface SessionData {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  age?: string;
  status: string;
}

interface GameResult {
  didWin: boolean;
  isDraw: boolean;
  didLose: boolean;
  myMoves: string[];
  opponentMoves: string[];
  myWins: number;
  opponentWins: number;
  draws: number;
  stakeAmount: number;
  balanceChange: number;
  newBalance: number;
  pot: number;
  opponent: string;
  rounds: number;
}

export default function LobbyPage() {
  const wallet = useWallet();
  const [publicSessions, setPublicSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualJoinId, setManualJoinId] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-connect wallet
  useEffect(() => {
    if (!wallet.userId) {
      wallet.connect('seed_alice', 500000, 'Alice');
    }
  }, [wallet]);

  // Load sessions on initial page load only - REMOVED auto-refresh interval
  useEffect(() => {
    loadPublicSessions();
  }, []);

  const loadPublicSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lobby');
      if (response.ok) {
        const data = await response.json();
        console.log('Public lobby data:', data);
        
        // Handle API response format
        const sessionList = data.items || data || [];
        
        if (Array.isArray(sessionList)) {
          // Show ALL open sessions from the API, don't filter by user
          const availableSessions = sessionList.filter(session => 
            session.status === 'OPEN' || !session.status
          );
          setPublicSessions(availableSessions);
        } else {
          console.warn('API returned non-array data:', data);
          setPublicSessions([]);
        }
      } else {
        console.error('Failed to fetch public sessions:', response.status);
        setPublicSessions([]);
      }
    } catch (error) {
      console.error('Failed to load public sessions:', error);
      setPublicSessions([]);
    } finally {
      setLoading(false);
      setLastRefresh(Date.now()); // Update refresh timestamp
    }
  };

  const handleManualJoin = async () => {
    if (!manualJoinId.trim()) return;
    
    try {
      // Try to fetch session details first
      const sessionResponse = await fetch(`/api/session/${manualJoinId.trim()}`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        
        // Check if session is available
        if (sessionData.status !== 'OPEN') {
          alert('This game is no longer available to join.');
          setManualJoinId('');
          return;
        }
        
        // Check if trying to join own game
        if (sessionData.creatorId === wallet.userId) {
          alert("You can't join your own game!");
          setManualJoinId('');
          return;
        }
        
        setSelectedSession({
          id: sessionData.id,
          creator: sessionData.creator?.displayName || sessionData.creatorId?.slice(0, 6) || 'Unknown',
          rounds: sessionData.rounds,
          stakePerRound: sessionData.stakePerRound,
          totalStake: sessionData.totalStake,
          status: sessionData.status,
        });
      } else {
        alert('Session not found or invalid session ID.');
      }
      setManualJoinId('');
    } catch (error) {
      console.error('Error with manual join:', error);
      alert('Invalid session ID or session not found');
      setManualJoinId('');
    }
  };

  const handleJoinPublicGame = (session: SessionData) => {
    // Check if trying to join own game
    if (session.creator === wallet.userId || session.creator.includes(wallet.userId?.slice(0, 6) || '')) {
      alert("You can't join your own game!");
      return;
    }
    
    // Double-check session is still available
    if (session.status !== 'OPEN') {
      alert('This game is no longer available to join.');
      loadPublicSessions(); // Refresh the list
      return;
    }
    
    setSelectedSession(session);
  };

  const refreshSessions = () => {
    loadPublicSessions();
  };

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

  const timeAgo = Math.floor((Date.now() - lastRefresh) / 1000);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Game Lobby</h1>
        <p className="text-gray-400">Join available games or enter a session ID</p>
      </div>

      {/* Phase 2 Mode Indicator */}
      <div className="bg-slate-800 border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">🔧 Mock Mode</h3>
            <p className="text-gray-400 text-sm">
              Games use mock escrow. Instant resolution for testing.
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

      {/* Public Games Section */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Public Games</h2>
            <p className="text-xs text-gray-500">
              Last updated: {timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`}
            </p>
          </div>
          
          {/* Manual Join Controls */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Session ID..."
              value={manualJoinId}
              onChange={(e) => setManualJoinId(e.target.value)}
              className="w-36 px-3 py-2 text-sm bg-white/5 border border-white/20 rounded-lg focus:border-blue-500 focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && handleManualJoin()}
            />
            <button
              onClick={handleManualJoin}
              disabled={!manualJoinId.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Join ID
            </button>
            <button
              onClick={refreshSessions}
              className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh available games"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="animate-spin text-2xl mb-2">⚡</div>
            <div>Loading available games...</div>
          </div>
        ) : !Array.isArray(publicSessions) || publicSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-4">🎮</div>
            <div className="mb-2">No public games available right now.</div>
            <div className="text-sm">Create one on the Play page!</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {publicSessions.map((session) => (
              <div key={session.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-white">
                      {session.rounds} Round{session.rounds > 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-400">
                      {session.stakePerRound.toLocaleString()} RPS per round
                    </div>
                  </div>
                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium">
                    OPEN
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <div>Creator: {session.creator}</div>
                  {session.age && <div>Created: {session.age}</div>}
                  <div className="font-mono text-gray-600">
                    ID: {session.id.slice(0, 6)}...
                  </div>
                </div>

                <div className="text-sm space-y-1 mb-4 bg-white/5 rounded p-2">
                  <div className="flex justify-between">
                    <span>Total Pot:</span>
                    <span className="font-mono font-bold">{(session.totalStake * 2).toLocaleString()} RPS</span>
                  </div>
                  <div className="flex justify-between text-green-400">
                    <span>Winner Gets:</span>
                    <span className="font-mono font-bold">
                      {Math.floor(session.totalStake * 2 * 0.95).toLocaleString()} RPS
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Your Risk:</span>
                    <span className="font-mono">
                      {session.totalStake.toLocaleString()} RPS
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinPublicGame(session)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Modal */}
      {selectedSession && !gameResult && (
        <JoinGameModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onGameComplete={(result) => {
            setGameResult(result);
            setSelectedSession(null);
            // Manual refresh after game completion instead of auto-refresh
          }}
        />
      )}

      {/* Game Results Modal */}
      {gameResult && (
        <GameResultsModal
          result={gameResult}
          onClose={() => {
            setGameResult(null);
            // Refresh after viewing results
            setTimeout(refreshSessions, 1000);
          }}
        />
      )}
    </div>
  );
}

// Join Game Modal Component - Same as before but with better error handling
function JoinGameModal({ 
  session, 
  onClose, 
  onGameComplete 
}: { 
  session: SessionData; 
  onClose: () => void; 
  onGameComplete: (result: GameResult) => void;
}) {
  const wallet = useWallet();
  const [selectedMoves, setSelectedMoves] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const getMoveEmoji = (move: string) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move as keyof typeof emojis] || '?';
  };

  const moves = ['R', 'P', 'S'];
  const canJoin = selectedMoves.filter(Boolean).length === session.rounds && 
                 (wallet.balance || 0) >= session.totalStake;

  const handleMoveSelect = (roundIndex: number, move: string) => {
    if (isSubmitting) return;
    
    const newMoves = [...selectedMoves];
    newMoves[roundIndex] = move;
    setSelectedMoves(newMoves);
    setError('');
  };

  const handleJoinGame = async () => {
    if (!canJoin || isSubmitting) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Generate salt and create commit hash
      const salt = Math.random().toString(36).substring(2, 15);
      const movesString = selectedMoves.join(',');
      const preimage = `${movesString}|${salt}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(preimage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const commitHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Store in localStorage for reveal
      localStorage.setItem(`game_${session.id}_moves`, movesString);
      localStorage.setItem(`game_${session.id}_salt`, salt);
      
      const response = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: movesString,
          salt: salt,
          commitHash: commitHash
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Join game result:', result);
        
        // Update wallet balance
        wallet.setBalance(result.newBalance || wallet.balance);
        
        // Prepare game result data
        const gameResult: GameResult = {
          didWin: result.didWin || false,
          isDraw: result.isDraw || false,
          didLose: result.didLose || false,
          myMoves: selectedMoves,
          opponentMoves: result.opponentMoves || [],
          myWins: result.myWins || 0,
          opponentWins: result.opponentWins || 0,
          draws: result.draws || 0,
          stakeAmount: session.totalStake,
          balanceChange: result.balanceChange || 0,
          newBalance: result.newBalance || wallet.balance || 0,
          pot: session.totalStake * 2,
          opponent: session.creator,
          rounds: session.rounds
        };
        
        onGameComplete(gameResult);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to join game');
      }
    } catch (error: any) {
      console.error('Join game error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">Join Game</h2>
          <div className="text-sm text-gray-400">
            vs {session.creator} • {session.rounds} Round{session.rounds > 1 ? 's' : ''}
          </div>
          <div className="text-lg font-mono mt-1">
            {session.totalStake.toLocaleString()} RPS at stake
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4">
            <div className="text-sm text-red-200">{error}</div>
          </div>
        )}

        {/* Move Selection */}
        <div className="mb-6">
          <div className="text-sm font-medium mb-3">Select your moves:</div>
          <div className="space-y-3">
            {Array.from({ length: session.rounds }, (_, roundIndex) => (
              <div key={roundIndex} className="flex items-center gap-3">
                <div className="text-sm font-medium min-w-[70px]">
                  Round {roundIndex + 1}:
                </div>
                
                <div className="flex gap-2">
                  {moves.map((move) => {
                    const isSelected = selectedMoves[roundIndex] === move;
                    return (
                      <button
                        key={move}
                        onClick={() => handleMoveSelect(roundIndex, move)}
                        disabled={isSubmitting}
                        className={`w-10 h-10 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/20 scale-110'
                            : 'border-white/20 bg-white/5 hover:bg-white/10'
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
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
            ))}
          </div>
        </div>

        {/* Balance Check */}
        <div className="bg-white/5 rounded-lg p-3 mb-6">
          <div className="flex justify-between text-sm">
            <span>Your Balance:</span>
            <span className={`font-mono ${(wallet.balance || 0) >= session.totalStake ? 'text-green-400' : 'text-red-400'}`}>
              {(wallet.balance || 0).toLocaleString()} RPS
            </span>
          </div>
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
      </div>
    </div>
  );
}

// Game Results Modal - Same as before
function GameResultsModal({ 
  result, 
  onClose 
}: { 
  result: GameResult; 
  onClose: () => void;
}) {
  const getMoveEmoji = (move: string) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move as keyof typeof emojis] || '?';
  };

  const getResultColor = () => {
    if (result.isDraw) return 'text-yellow-400';
    return result.didWin ? 'text-green-400' : 'text-red-400';
  };

  const getResultText = () => {
    if (result.isDraw) return 'DRAW';
    return result.didWin ? 'YOU WIN!' : 'YOU LOSE';
  };

  const getTokenChangeDisplay = () => {
    if (result.isDraw) return '+0';
    const change = result.balanceChange;
    return change >= 0 ? `+${change.toLocaleString()}` : change.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6">
        {/* Result Header */}
        <div className="text-center mb-6">
          <div className={`text-4xl font-bold mb-2 ${getResultColor()}`}>
            {getResultText()}
          </div>
          <div className={`text-2xl font-mono ${getResultColor()}`}>
            {getTokenChangeDisplay()} RPS
          </div>
          <div className="text-sm text-gray-400 mt-1">
            New Balance: {result.newBalance.toLocaleString()} RPS
          </div>
        </div>

        {/* Score Summary */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="text-center mb-4">
            <div className="text-xl font-bold">
              {result.myWins} - {result.opponentWins}
            </div>
            <div className="text-sm text-gray-400">
              You vs {result.opponent}
            </div>
            {result.draws > 0 && (
              <div className="text-xs text-gray-500">
                {result.draws} draw{result.draws > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Round-by-round breakdown */}
          <div className="space-y-2">
            {result.myMoves.map((myMove, index) => {
              const opponentMove = result.opponentMoves[index];
              const roundResult = 
                myMove === opponentMove ? 'draw' :
                (myMove === 'R' && opponentMove === 'S') ||
                (myMove === 'P' && opponentMove === 'R') ||
                (myMove === 'S' && opponentMove === 'P') ? 'win' : 'lose';
              
              return (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded">
                  <div className="text-sm">Round {index + 1}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getMoveEmoji(myMove)}</span>
                    <span className="text-xs text-gray-400">vs</span>
                    <span className="text-lg">{getMoveEmoji(opponentMove)}</span>
                    <span className={`text-xs font-medium ml-2 ${
                      roundResult === 'win' ? 'text-green-400' :
                      roundResult === 'lose' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {roundResult.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Pot:</span>
              <span className="font-mono">{result.pot.toLocaleString()} RPS</span>
            </div>
            <div className="flex justify-between">
              <span>Your Stake:</span>
              <span className="font-mono text-red-400">-{result.stakeAmount.toLocaleString()} RPS</span>
            </div>
            {!result.isDraw && (
              <div className="flex justify-between">
                <span>Fees (5%):</span>
                <span className="font-mono text-gray-400">
                  -{Math.floor(result.pot * 0.05).toLocaleString()} RPS
                </span>
              </div>
            )}
            <hr className="border-white/20" />
            <div className="flex justify-between font-bold">
              <span>Net Change:</span>
              <span className={`font-mono ${getResultColor()}`}>
                {getTokenChangeDisplay()} RPS
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
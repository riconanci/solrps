// app/lobby/page.tsx - COMPLETE REWRITE WITH ZUSTAND WALLET
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

export default function LobbyPage() {
  const wallet = useWallet();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // Initialize wallet on mount
  useEffect(() => {
    const initializeWallet = async () => {
      if (!wallet.isConnected) {
        // Determine user from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user') || 'alice';
        const userId = userParam === 'alice' ? 'seed_alice' : 'seed_bob';
        
        try {
          await wallet.switchUser(userId);
        } catch (error) {
          console.error('Failed to initialize wallet:', error);
          setError('Failed to load wallet');
        }
      }
    };

    initializeWallet();
  }, [wallet]);

  // Load sessions when wallet is connected
  useEffect(() => {
    if (wallet.isConnected) {
      loadSessions();
    }
  }, [wallet.isConnected]);

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
      
      if (data.success && data.items) {
        // Filter to only open sessions that aren't created by current user
        const availableSessions = data.items.filter((session: Session) => 
          session.status === 'OPEN' && session.creatorId !== wallet.userId
        );
        
        console.log('Available sessions for', wallet.displayName, ':', availableSessions);
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              Available Games ({sessions.length})
            </h2>
            <button
              onClick={loadSessions}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? '⟳' : '🔄'} 
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Games List */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-2xl mb-4">⚡</div>
              <div className="text-lg">Loading available games...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-2xl mb-4">🎮</div>
              <div className="text-lg mb-2">No games available to join</div>
              <div className="text-sm">Create a game to get started!</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
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
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          canAfford
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-red-600/50 text-red-300 cursor-not-allowed'
        }`}
      >
        {canAfford ? 'Join Game' : 'Insufficient Balance'}
      </button>
    </div>
  );
}

// Join Game Modal Component
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
      
      const response = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          challengerMoves: moves
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
          <div className="text-sm text-gray-400 mt-2">
            New Balance: {result.newBalance.toLocaleString()} tokens
          </div>
        </div>

        {/* Score Summary */}
        <div className="bg-white/5 rounded-lg p-4 mb-6 text-center">
          <div className="text-sm text-gray-400 mb-2">Final Score</div>
          <div className="text-lg">
            <span className="text-blue-400">You {result.matchResult.challengerWins}</span>
            <span className="text-gray-400 mx-2">-</span>
            <span className="text-orange-400">{result.matchResult.creatorWins} Opponent</span>
            {result.matchResult.draws > 0 && (
              <span className="text-yellow-400"> ({result.matchResult.draws} draws)</span>
            )}
          </div>
        </div>

        {/* Round Details */}
        {result.challengerMoves && result.creatorMoves && result.challengerMoves.length > 0 && (
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="text-sm font-medium mb-3">Round by Round</div>
            <div className="space-y-2">
              {result.challengerMoves.map((myMove, index) => {
                const oppMove = result.creatorMoves[index];
                const roundResult = 
                  myMove === oppMove ? 'Draw' :
                  (myMove === 'R' && oppMove === 'S') || 
                  (myMove === 'P' && oppMove === 'R') || 
                  (myMove === 'S' && oppMove === 'P') ? 'Win' : 'Loss';
                
                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Round {index + 1}:</span>
                    <div className="flex items-center gap-2">
                      <span>{moveEmojis[myMove]}</span>
                      <span className="text-gray-400">vs</span>
                      <span>{moveEmojis[oppMove]}</span>
                      <span className={`ml-2 font-medium ${
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
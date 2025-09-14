// app/my/page.tsx - EXACT ORIGINAL GITHUB FORMAT with 9 match limit
"use client";
import { useEffect, useState } from "react";
import { useWallet } from "../../src/state/wallet";
import { RevealModal } from "../../src/components/RevealModal";

type MatchData = {
  id: string;
  createdAt: string;
  status: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  isCreator: boolean;
  myRole: string;
  opponent: {
    id: string;
    displayName: string;
  } | null;
  myMoves: string[];
  opponentMoves: string[];
  result: {
    id: string;
    createdAt: string;
    roundsOutcome: any[];
    creatorWins: number;
    challengerWins: number;
    draws: number;
    overall: string;
    pot: number;
    feesTreasury: number;
    feesBurn: number;
    payoutWinner: number;
    didIWin: boolean;
    isDraw: boolean;
    myWins: number;
    opponentWins: number;
  } | null;
};

type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
  winPercentage: number;
  totalEarned: number;
  totalLost: number;
  netAmount: number;
  currentStreak: number;
  longestWinStreak: number;
};

export default function MyMatchesPage() {
  const wallet = useWallet();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [stats, setStats] = useState<UserStats>({
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    winPercentage: 0,
    totalEarned: 0,
    totalLost: 0,
    netAmount: 0,
    currentStreak: 0,
    longestWinStreak: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealModal, setRevealModal] = useState<{
    open: boolean;
    sessionId: string | null;
  }>({ open: false, sessionId: null });

  useEffect(() => {
    if (!wallet.userId) {
      wallet.connect('seed_alice', 500000, 'Alice');
    } else {
      fetchMatches();
    }
  }, [wallet.userId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/me/matches?userId=${wallet.userId}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches || []);
      calculateStats(data.matches || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (matchData: MatchData[]) => {
    if (matchData.length === 0) return;

    let gamesWon = 0, gamesLost = 0, gamesDraw = 0;
    let totalEarned = 0, totalLost = 0;
    let streaks: number[] = [];
    let currentStreak = 0;

    matchData.forEach((match, index) => {
      if (!match.result) return;

      const isWin = match.result.didIWin;
      const isDraw = match.result.isDraw;
      
      if (isWin) {
        gamesWon++;
        totalEarned += (match.result.payoutWinner - match.totalStake);
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else if (isDraw) {
        gamesDraw++;
        currentStreak = 0;
      } else {
        gamesLost++;
        totalLost += match.totalStake;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }

      streaks.push(currentStreak);
    });

    const gamesPlayed = gamesWon + gamesLost + gamesDraw;
    const winPercentage = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const longestWinStreak = Math.max(...streaks.filter(s => s > 0), 0);

    setStats({
      gamesPlayed,
      gamesWon,
      gamesLost,
      gamesDraw,
      winPercentage,
      totalEarned,
      totalLost,
      netAmount: totalEarned - totalLost,
      currentStreak,
      longestWinStreak
    });
  };

  const getMoveEmoji = (move: string) => {
    const emojis = { R: '🪨', P: '📄', S: '✂️' };
    return emojis[move as keyof typeof emojis] || '?';
  };

  const getCardBackground = (match: MatchData) => {
    if (!match.result) return 'bg-slate-800 border-slate-700';
    
    if (match.result.isDraw) {
      return 'bg-yellow-900/20 border-yellow-500/30';
    }
    
    return match.result.didIWin 
      ? 'bg-green-900/20 border-green-500/30'
      : 'bg-red-900/20 border-red-500/30';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return {
        date: 'Today',
        time: date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      };
    } else if (diffDays === 2) {
      return {
        date: 'Yesterday',
        time: date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      };
    } else {
      return {
        date: date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      };
    }
  };

  // Match card component - ORIGINAL EMOJI GRID FORMAT
  const MatchCard = ({ match, isRecent }: { match: MatchData; isRecent: boolean }) => {
    const [currentRoundStart, setCurrentRoundStart] = useState(0);
    const maxVisibleRounds = 3; // Show max 3 rounds at a time
    const totalRounds = match.myMoves?.length || 0;
    const hasMoreRounds = totalRounds > maxVisibleRounds;
    const visibleMoves = match.myMoves?.slice(currentRoundStart, currentRoundStart + maxVisibleRounds) || [];
    const visibleOpponentMoves = match.opponentMoves?.slice(currentRoundStart, currentRoundStart + maxVisibleRounds) || [];

    const canScrollLeft = currentRoundStart > 0;
    const canScrollRight = currentRoundStart + maxVisibleRounds < totalRounds;

    const scrollLeft = () => {
      setCurrentRoundStart(Math.max(0, currentRoundStart - maxVisibleRounds));
    };

    const scrollRight = () => {
      setCurrentRoundStart(Math.min(totalRounds - maxVisibleRounds, currentRoundStart + maxVisibleRounds));
    };

    const { date, time } = formatDateTime(match.createdAt);

    return (
      <div className={`border rounded-xl p-4 transition-all hover:scale-[1.02] relative ${getCardBackground(match)}`}>
        {/* Recent badge */}
        {isRecent && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            NEW
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold text-white">
              vs {match.opponent?.displayName || "Unknown"}
            </div>
            <div className="text-xs text-gray-300">
              {date} • {time}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">{match.rounds}R • {match.myRole}</div>
          </div>
        </div>

        {/* Moves display - ORIGINAL EMOJI GRID FORMAT */}
        {match.result && match.myMoves && match.opponentMoves && (
          <div className="bg-white/5 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">Moves</div>
              {hasMoreRounds && (
                <div className="flex gap-1">
                  <button
                    onClick={scrollLeft}
                    disabled={!canScrollLeft}
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                      canScrollLeft 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                        : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    ←
                  </button>
                  <button
                    onClick={scrollRight}
                    disabled={!canScrollRight}
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                      canScrollRight 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                        : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
            
            {/* ORIGINAL FORMAT: Two rows of emoji grids */}
            <div className="space-y-2">
              {/* You row */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-blue-400 font-medium w-8">You:</div>
                <div className="flex gap-1">
                  {visibleMoves.map((myMove, idx) => (
                    <div key={idx} className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center text-lg">
                      {getMoveEmoji(myMove)}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Opponent row */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-red-400 font-medium w-8">Opp:</div>
                <div className="flex gap-1">
                  {visibleOpponentMoves.map((opponentMove, idx) => (
                    <div key={idx} className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center text-lg">
                      {getMoveEmoji(opponentMove)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Score display - ORIGINAL FORMAT */}
            <div className="flex justify-center mt-3">
              <div className="text-sm text-gray-300">
                Score: {match.result.myWins}-{match.result.opponentWins}
                {match.result.draws > 0 && ` (${match.result.draws} draws)`}
              </div>
            </div>

            {hasMoreRounds && (
              <div className="text-xs text-gray-500 text-center mt-2">
                Showing rounds {currentRoundStart + 1}-{Math.min(currentRoundStart + maxVisibleRounds, totalRounds)} of {totalRounds}
              </div>
            )}
          </div>
        )}

        {/* Result section - ORIGINAL FORMAT */}
        <div className="text-center">
          {match.result ? (
            <>
              <div className="font-mono text-lg font-bold">
                {match.result.isDraw ? '±0' : match.result.didIWin ? 
                  `+${(match.result.payoutWinner - match.totalStake).toLocaleString()}` :
                  `-${match.totalStake.toLocaleString()}`
                } RPS
              </div>
              <div className="text-xs text-gray-400">
                Pot: {match.result.pot.toLocaleString()} • 
                {match.result.isDraw ? ' Draw' : match.result.didIWin ? ' Victory' : ' Defeat'}
              </div>
            </>
          ) : (
            <div className="text-yellow-400 font-medium">
              {match.status === 'AWAITING_REVEAL' ? 'Awaiting Reveal' : match.status}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {match.status === "AWAITING_REVEAL" && match.isCreator && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <button
              onClick={() => setRevealModal({ open: true, sessionId: match.id })}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
            >
              🔓 Reveal Moves
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-lg text-gray-400">Loading matches...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-red-400 text-lg">Error: {error}</div>
          <button 
            onClick={fetchMatches}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">My Matches</h1>
        <p className="text-gray-400">Your Rock Paper Scissors battle history</p>
      </div>

      {/* Stats Section */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">📊 Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.gamesPlayed}</div>
            <div className="text-xs text-gray-400">Games Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.gamesWon}</div>
            <div className="text-xs text-gray-400">Games Won</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.gamesDraw}</div>
            <div className="text-xs text-gray-400">Draws</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{stats.winPercentage}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.netAmount >= 0 ? 
              'text-green-400' : 'text-red-400'}`}>
              {stats.netAmount >= 0 ? '+' : ''}{stats.netAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">Net RPS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{stats.currentStreak}</div>
            <div className="text-xs text-gray-400">Current Streak</div>
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">🎮 Recent Matches</h2>
        
        {matches.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-4">🎯</div>
            <div className="text-lg mb-2">No matches found</div>
            <p className="text-sm">Play your first game to see matches here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match, index) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isRecent={index === 0} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Reveal Modal */}
      <RevealModal
        open={revealModal.open}
        onClose={() => setRevealModal({ open: false, sessionId: null })}
        sessionId={revealModal.sessionId}
        onRevealed={() => {
          setRevealModal({ open: false, sessionId: null });
          fetchMatches();
        }}
      />
    </div>
  );
}
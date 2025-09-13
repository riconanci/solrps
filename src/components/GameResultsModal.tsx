// src/components/GameResultsModal.tsx
"use client";

interface GameResult {
  didWin: boolean;
  isDraw: boolean;
  didLose: boolean;
  outcomes: string[];
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
  matchId: string;
}

interface GameResultsModalProps {
  open: boolean;
  onClose: () => void;
  result: GameResult | null;
}

export function GameResultsModal({ open, onClose, result }: GameResultsModalProps) {
  if (!open || !result) {
    return null;
  }

  const getMoveEmoji = (move: string): string => {
    switch (move) {
      case "R": return "🪨";
      case "P": return "📄";
      case "S": return "✂️";
      default: return "❓";
    }
  };

  const getOutcomeEmoji = (outcome: string): string => {
    switch (outcome) {
      case "A": return "✅"; // You won this round
      case "B": return "❌"; // You lost this round
      case "DRAW": return "🟨"; // Tie
      default: return "❓";
    }
  };

  const getResultColor = () => {
    if (result.didWin) return "text-green-400";
    if (result.isDraw) return "text-yellow-400";
    return "text-red-400";
  };

  const getResultBgColor = () => {
    if (result.didWin) return "bg-green-900/20 border-green-500/30";
    if (result.isDraw) return "bg-yellow-900/20 border-yellow-500/30";
    return "bg-red-900/20 border-red-500/30";
  };

  const getResultMessage = () => {
    if (result.didWin) return "🎉 You Won!";
    if (result.isDraw) return "🤝 It's a Draw!";
    return "😔 You Lost!";
  };

  const getBalanceChangeText = () => {
    if (result.balanceChange > 0) {
      return `+${result.balanceChange.toLocaleString()}`;
    } else if (result.balanceChange < 0) {
      return `${result.balanceChange.toLocaleString()}`;
    }
    return "±0";
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl max-w-lg w-full">
        
        {/* Header with Result */}
        <div className={`rounded-t-2xl border-2 p-6 text-center ${getResultBgColor()}`}>
          <h2 className={`text-3xl font-bold mb-2 ${getResultColor()}`}>
            {getResultMessage()}
          </h2>
          <p className="text-gray-300">
            vs <span className="font-semibold">{result.opponent}</span>
          </p>
          
          {/* Balance Change */}
          <div className="mt-4 flex justify-center">
            <div className={`px-4 py-2 rounded-xl font-mono text-xl font-bold ${getResultColor()}`}>
              {getBalanceChangeText()} tokens
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Round by Round Results */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Round Results</h3>
            
            <div className="space-y-2">
              {result.outcomes.map((outcome, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">Round {index + 1}</span>
                    
                    <div className="flex items-center gap-4">
                      {/* Your move */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">You:</span>
                        <span className="text-lg">{getMoveEmoji(result.myMoves[index])}</span>
                      </div>
                      
                      {/* VS */}
                      <span className="text-gray-500 text-xs">VS</span>
                      
                      {/* Opponent move */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{result.opponent}:</span>
                        <span className="text-lg">{getMoveEmoji(result.opponentMoves[index])}</span>
                      </div>
                    </div>
                    
                    {/* Outcome */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getOutcomeEmoji(outcome)}</span>
                      <span className="text-xs text-gray-400">
                        {outcome === "A" ? "Win" : outcome === "B" ? "Lose" : "Draw"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Summary */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3">Game Summary</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Your wins</div>
                <div className="text-green-400 font-bold">{result.myWins}</div>
              </div>
              <div>
                <div className="text-gray-400">Opponent wins</div>
                <div className="text-red-400 font-bold">{result.opponentWins}</div>
              </div>
              <div>
                <div className="text-gray-400">Draws</div>
                <div className="text-yellow-400 font-bold">{result.draws}</div>
              </div>
              <div>
                <div className="text-gray-400">Total rounds</div>
                <div className="text-white font-bold">{result.rounds}</div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3">Financial Summary</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Your stake:</span>
                <span className="text-red-400 font-mono">-{result.stakeAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total pot:</span>
                <span className="text-white font-mono">{result.pot.toLocaleString()}</span>
              </div>
              {result.didWin && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Winner payout:</span>
                  <span className="text-green-400 font-mono">+{(result.balanceChange + result.stakeAmount).toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span className="text-gray-400">Net change:</span>
                <span className={`font-mono ${getResultColor()}`}>
                  {getBalanceChangeText()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">New balance:</span>
                <span className="text-green-400 font-mono">{result.newBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="
                flex-1 px-4 py-3 rounded-xl
                bg-blue-600 hover:bg-blue-700 
                text-white font-medium
                transition-all flex items-center justify-center gap-2
              "
            >
              ✨ View Match History
            </button>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-white/10">
            Match ID: <span className="font-mono">{result.matchId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
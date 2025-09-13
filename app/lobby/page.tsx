// app/lobby/page.tsx
"use client";
import { useEffect, useState } from "react";
import { JoinSessionModal } from "@/components/JoinSessionModal";

type SessionCard = {
  id: string;
  creator: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  age: string;
};

export default function LobbyPage() {
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [sessionIdInput, setSessionIdInput] = useState("");
  
  // Join Modal State
  const [joinModal, setJoinModal] = useState<{
    open: boolean;
    session: SessionCard | null;
  }>({ open: false, session: null });

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      setLoading(true);
      const res = await fetch("/api/lobby");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualJoin() {
    if (!sessionIdInput.trim()) {
      alert("Please enter a session ID");
      return;
    }

    try {
      // Fetch session details by ID
      const res = await fetch(`/api/session/${sessionIdInput.trim()}`);
      if (!res.ok) {
        throw new Error("Session not found or invalid");
      }
      
      const sessionData = await res.json();
      
      // Convert to expected format and open join modal
      const session: SessionCard = {
        id: sessionData.id,
        creator: sessionData.creator?.displayName || "Unknown",
        rounds: sessionData.rounds,
        stakePerRound: sessionData.stakePerRound,
        totalStake: sessionData.totalStake,
        age: "Private invite"
      };

      setJoinModal({ open: true, session });
      setShowManualJoin(false);
      setSessionIdInput("");
      
    } catch (error: any) {
      alert(error.message || "Failed to find session");
    }
  }

  function openJoinModal(session: SessionCard) {
    setJoinModal({ open: true, session });
  }

  function closeJoinModal() {
    setJoinModal({ open: false, session: null });
  }

  function onSessionJoined() {
    closeJoinModal();
    fetchSessions(); // Refresh to remove joined session
  }

  return (
    <>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🕹️ Game Lobby</h1>
          <p className="text-neutral-400">Join available game sessions and challenge other players</p>
        </div>

        {/* Manual Join Input */}
        {showManualJoin && (
          <div className="mb-6 p-4 bg-white/5 border border-white/20 rounded-xl">
            <h3 className="text-lg font-semibold mb-3">Join Game by Session ID</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                placeholder="Enter session ID (e.g., clm1a2b3c4d5...)"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleManualJoin}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                Join Game
              </button>
              <button
                onClick={() => {
                  setShowManualJoin(false);
                  setSessionIdInput("");
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              💡 Get a session ID from someone who created a game, or copy it from your created sessions.
            </p>
          </div>
        )}

        {/* Sessions Grid */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-neutral-400">Loading available sessions...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg text-neutral-400 mb-2">No sessions available</div>
              <p className="text-sm text-neutral-500">
                Be the first to{" "}
                <a href="/play" className="text-blue-400 hover:text-blue-300">
                  create a session
                </a>{" "}
                for others to join!
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Available Sessions ({sessions.length})</h2>
                <div className="flex items-center gap-3">
                  {/* Manual Join Button */}
                  <button
                    onClick={() => setShowManualJoin(!showManualJoin)}
                    className="text-sm px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    🔑 Manual Join
                  </button>
                  
                  {/* Refresh Button */}
                  <button 
                    onClick={fetchSessions}
                    className="text-sm px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
              
              <div className="grid gap-4">
                {sessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onJoin={() => openJoinModal(session)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 p-6 bg-white/5 rounded-xl">
          <h3 className="text-lg font-semibold mb-3">How to Play</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-neutral-300">
            <div>
              <div className="font-medium text-white mb-1">1. Choose a Session</div>
              <div>Pick a game that matches your preferred stakes and rounds.</div>
            </div>
            <div>
              <div className="font-medium text-white mb-1">2. Submit Your Moves</div>
              <div>Enter your Rock, Paper, Scissors moves for each round.</div>
            </div>
            <div>
              <div className="font-medium text-white mb-1">3. Instant Results</div>
              <div>Game resolves immediately with win/lose/draw outcome.</div>
            </div>
            <div>
              <div className="font-medium text-white mb-1">4. Collect Winnings</div>
              <div>Winner takes ~90% of the pot, loser pays stake, draws refund.</div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Use "Manual Join" to join private games by session ID, or browse public sessions below!
            </p>
          </div>
        </div>
      </div>

      {/* Join Session Modal */}
      <JoinSessionModal
        open={joinModal.open}
        onClose={closeJoinModal}
        session={joinModal.session}
        onJoined={onSessionJoined}
      />
    </>
  );
}

function SessionCard({ 
  session, 
  onJoin 
}: { 
  session: SessionCard; 
  onJoin: () => void;
}) {
  return (
    <div className="border border-white/20 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">vs {session.creator}</h3>
            <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">
              OPEN
            </span>
          </div>
          
          <div className="text-sm text-gray-400 space-y-1">
            <div>{session.rounds} rounds • {session.stakePerRound} tokens/round</div>
            <div>Total stake: {session.totalStake} tokens each</div>
            <div>Created: {session.age}</div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-mono text-green-400 font-bold mb-2">
            {session.totalStake * 2} pot
          </div>
          <button
            onClick={onJoin}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            🎯 Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
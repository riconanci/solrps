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
                <button 
                  onClick={fetchSessions}
                  className="text-sm px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  🔄 Refresh
                </button>
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
              <div className="font-medium text-white mb-1">3. Wait for Reveal</div>
              <div>The creator will reveal their moves to determine the winner.</div>
            </div>
            <div>
              <div className="font-medium text-white mb-1">4. Collect Winnings</div>
              <div>Winner takes ~90% of the pot (10% goes to fees).</div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Modal */}
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
  const totalPot = session.totalStake * 2;
  const winnerGets = Math.floor(totalPot * 0.9);

  return (
    <div className="rounded-xl border border-white/10 p-6 bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">vs {session.creator}</h3>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-medium">
              OPEN
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-neutral-400">Rounds</div>
              <div className="font-medium">{session.rounds}</div>
            </div>
            <div>
              <div className="text-neutral-400">Stake/Round</div>
              <div className="font-medium">{session.stakePerRound}</div>
            </div>
            <div>
              <div className="text-neutral-400">Total Pot</div>
              <div className="font-medium text-green-400">{totalPot.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-neutral-400">Winner Gets</div>
              <div className="font-medium text-blue-400">{winnerGets.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-neutral-400">
            Created {session.age}
          </div>
        </div>
        
        <div className="ml-6">
          <button
            onClick={onJoin}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Join Game
          </button>
          <div className="text-xs text-neutral-400 text-center mt-1">
            Stake: {session.totalStake}
          </div>
        </div>
      </div>
    </div>
  );
}
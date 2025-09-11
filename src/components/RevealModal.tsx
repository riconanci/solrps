// components/RevealModal.tsx
"use client";
import { useEffect, useState } from "react";

// Type for the secret stored in localStorage
type StoredSecret = {
  salt: string;
  moves: string[];
};

export function RevealModal({
  open, 
  onClose, 
  sessionId, 
  onRevealed,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  onRevealed: () => void;
}) {
  const [salt, setSalt] = useState("");
  const [movesCsv, setMovesCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) {
      // Reset state when modal closes
      setSalt("");
      setMovesCsv("");
      setError(null);
      setSuccess(false);
      return;
    }

    // Try to load saved secret from localStorage
    const secret = loadSecret(sessionId);
    if (secret) {
      setSalt(secret.salt);
      setMovesCsv(secret.moves.join(","));
    } else {
      setSalt("");
      setMovesCsv("");
    }
  }, [open, sessionId]);

  if (!open || !sessionId) return null;

  async function doReveal() {
    if (!sessionId) return;
    
    setBusy(true); 
    setError(null);
    
    try {
      const moves = movesCsv.split(",").map((x) => x.trim()).filter(Boolean);
      
      if (moves.length === 0) {
        throw new Error("Please enter your moves");
      }
      
      if (!salt.trim()) {
        throw new Error("Please enter your salt");
      }

      const res = await fetch("/api/session/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, moves, salt }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.error || "Reveal failed");
      }

      // Remove the secret from localStorage since it's no longer needed
      removeSecret(sessionId);
      
      setSuccess(true);
      
      // Close modal and refresh parent after a brief delay
      setTimeout(() => {
        onRevealed();
      }, 1500);
      
    } catch (error: any) {
      console.error("Reveal error:", error);
      setError(error.message || "Failed to reveal");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 p-6 rounded-xl border border-green-500/20 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-green-400 text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Reveal Successful!</h3>
            <p className="text-gray-300">
              Your moves have been revealed and the match has been resolved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-xl border border-white/20 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Reveal Your Moves</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Your Moves (comma separated, e.g., R,P,S)
            </label>
            <input
              type="text"
              value={movesCsv}
              onChange={(e) => setMovesCsv(e.target.value)}
              placeholder="R,P,S"
              className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={busy}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Salt
            </label>
            <input
              type="text"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              placeholder="Your secret salt"
              className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={doReveal}
              disabled={busy || !movesCsv.trim() || !salt.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {busy ? "Revealing..." : "Reveal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions for localStorage management
function loadSecret(sessionId: string): StoredSecret | null {
  try {
    const key = `solrps_secret_${sessionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    if (parsed && parsed.salt && Array.isArray(parsed.moves)) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.error("Error loading secret:", e);
    return null;
  }
}

function removeSecret(sessionId: string): void {
  try {
    const key = `solrps_secret_${sessionId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Error removing secret:", e);
  }
}
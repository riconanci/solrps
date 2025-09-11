"use client";
import { useEffect, useState } from "react";
import { loadSecret, removeSecret } from "@/lib/secret";

export function RevealModal({
  open, onClose, sessionId, onRevealed,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  onRevealed: () => void;
}) {
  const [salt, setSalt] = useState("");
  const [movesCsv, setMovesCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    const s = loadSecret(sessionId);
    if (s) {
      setSalt(s.salt);
      setMovesCsv(s.moves.join(","));
    } else {
      setSalt("");
      setMovesCsv("");
    }
  }, [open, sessionId]);

  if (!open || !sessionId) return null;

  async function doReveal() {
    if (!sessionId) return; // Extra safety check
    
    setBusy(true); 
    setErr(null);
    
    try {
      const moves = movesCsv.split(",").map((x) => x.trim()).filter(Boolean);
      const res = await fetch("/api/session/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, moves, salt }),
      });
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Reveal failed");
      }
      
      removeSecret(sessionId);
      onRevealed();
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-4">
        <div className="mb-3 text-lg font-semibold">Reveal Moves</div>
        <div className="space-y-2 text-sm">
          <label className="block">
            <span className="text-neutral-300">Salt</span>
            <input 
              className="mt-1 w-full rounded bg-white/10 p-2"
              value={salt} 
              onChange={(e) => setSalt(e.target.value)} 
              placeholder="auto-loaded if available" 
            />
          </label>
          <label className="block">
            <span className="text-neutral-300">Moves (CSV)</span>
            <input 
              className="mt-1 w-full rounded bg-white/10 p-2"
              value={movesCsv} 
              onChange={(e) => setMovesCsv(e.target.value)} 
              placeholder="R,P,S (for 3 rounds)" 
            />
          </label>
          {err && (
            <div className="rounded border border-red-400/30 bg-red-500/10 p-2 text-red-300">
              {err}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button 
            className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20" 
            onClick={onClose} 
            disabled={busy}
          >
            Cancel
          </button>
          <button 
            className="rounded-lg bg-white/20 px-3 py-1 hover:bg-white/30" 
            onClick={doReveal} 
            disabled={busy}
          >
            {busy ? "Revealing..." : "Reveal"}
          </button>
        </div>
      </div>
    </div>
  );
}
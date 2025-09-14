// app/layout.tsx - QUICK PHASE 2 FIX
import "./globals.css";
import { ReactNode } from "react";
import { Navigation } from "../src/components/Navigation";

export const metadata = {
  title: "SolRPS - Rock Paper Scissors on Solana",
  description: "Play-to-earn Rock Paper Scissors on Solana blockchain with weekly competitions",
};

// Quick Phase 2 config check
const isPhase2Enabled = () => {
  return process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';
};

const isBlockchainEnabled = () => {
  return process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Navigation */}
          <Navigation />
          
          {/* Main Content */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-8">
              {/* Phase 2 Development Banner */}
              {isPhase2Enabled() && process.env.NODE_ENV === 'development' && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Phase 2 Development Mode</h3>
                      <p className="text-sm text-gray-300">
                        {isBlockchainEnabled()
                          ? "🔥 BLOCKCHAIN MODE ACTIVE - Real Solana wallet integration needed!"
                          : "Mock wallets active - Set USE_BLOCKCHAIN=true for real wallets"
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Configuration Status */}
                  <div className="flex gap-4 text-xs">
                    <div className={`px-2 py-1 rounded ${isBlockchainEnabled() ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      Blockchain: {isBlockchainEnabled() ? 'ENABLED' : 'DISABLED'}
                    </div>
                    <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                      Cluster: DEVNET
                    </div>
                    <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                      Phase 2: {isPhase2Enabled() ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                  </div>
                  
                  {isBlockchainEnabled() && (
                    <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm">
                      <strong>⚠️ Next Step:</strong> Install Phantom or Solflare wallet extension to test real wallet connections!
                    </div>
                  )}
                </div>
              )}

              {/* Page Content */}
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-white/10 py-6 mt-auto">
            <div className="mx-auto max-w-6xl px-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>⚔️ SolRPS - Rock Paper Scissors on Solana</span>
                  <span>•</span>
                  <span>
                    {isPhase2Enabled() && isBlockchainEnabled()
                      ? "Phase 2 - Blockchain Mode"
                      : isPhase2Enabled() 
                      ? "Phase 2 - Mock Mode"
                      : 'Phase 1 - Mock Escrow'
                    }
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <a 
                    href="https://github.com/riconanci/solrps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    GitHub
                  </a>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">
                    Version {isPhase2Enabled() ? '2.0' : '1.0'}
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
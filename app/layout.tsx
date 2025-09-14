// app/layout.tsx - PHASE 2 STEP 2: Real Solana Wallet Integration
import "./globals.css";
import { ReactNode } from "react";
import { Navigation } from "../src/components/Navigation";
import { SolanaWalletProvider } from "../src/components/SolanaWalletProvider";

export const metadata = {
  title: "SolRPS - Rock Paper Scissors on Solana",
  description: "Play-to-earn Rock Paper Scissors on Solana blockchain with weekly competitions",
};

// Phase 2 configuration checks
const isPhase2Enabled = () => {
  return process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';
};

const isBlockchainEnabled = () => {
  return process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const enablePhase2 = isPhase2Enabled();
  const enableBlockchain = isBlockchainEnabled();

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {/* PHASE 2 STEP 2: Conditionally wrap with SolanaWalletProvider */}
        {enablePhase2 && enableBlockchain ? (
          // BLOCKCHAIN MODE: Real Solana Wallet Integration
          <SolanaWalletProvider>
            <AppContent 
              enablePhase2={enablePhase2} 
              enableBlockchain={enableBlockchain}
            >
              {children}
            </AppContent>
          </SolanaWalletProvider>
        ) : (
          // MOCK MODE: Traditional mock wallet system
          <AppContent 
            enablePhase2={enablePhase2} 
            enableBlockchain={enableBlockchain}
          >
            {children}
          </AppContent>
        )}
      </body>
    </html>
  );
}

// Separated component to avoid duplication
function AppContent({ 
  children, 
  enablePhase2, 
  enableBlockchain 
}: { 
  children: ReactNode;
  enablePhase2: boolean;
  enableBlockchain: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Phase 2 Development Banner */}
          {enablePhase2 && process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Phase 2 Step 2 - Real Wallet Integration</h3>
                  <p className="text-sm text-gray-300">
                    {enableBlockchain
                      ? "🔥 BLOCKCHAIN MODE ACTIVE - Real Solana wallets enabled!"
                      : "Mock wallets active - Set USE_BLOCKCHAIN=true for real wallets"
                    }
                  </p>
                </div>
              </div>
              
              {/* Configuration Status */}
              <div className="flex gap-4 text-xs flex-wrap">
                <div className={`px-2 py-1 rounded ${
                  enableBlockchain 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  Blockchain: {enableBlockchain ? 'ENABLED ✅' : 'DISABLED'}
                </div>
                <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                  Cluster: {process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'DEVNET'}
                </div>
                <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                  Phase 2: {enablePhase2 ? 'ACTIVE' : 'INACTIVE'}
                </div>
                {enableBlockchain && (
                  <div className="px-2 py-1 rounded bg-green-500/20 text-green-400 animate-pulse">
                    Real Wallets: LIVE 🔗
                  </div>
                )}
              </div>
              
              {enableBlockchain ? (
                <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-300 text-sm">
                  <strong>✅ Phase 2 Step 2 Active:</strong> Real Solana wallet connections enabled! 
                  Connect Phantom or Solflare to play with real wallets.
                </div>
              ) : (
                <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-300 text-sm">
                  <strong>⏳ Mock Mode:</strong> Set <code className="bg-black/20 px-1 rounded">USE_BLOCKCHAIN=true</code> to enable real wallet connections.
                </div>
              )}
            </div>
          )}
          
          {children}
        </div>
      </main>
    </div>
  );
}
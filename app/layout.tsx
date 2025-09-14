// app/layout.tsx - COMPLETE REWRITE: Fixed Wallet Connection (ORIGINAL: ~23 lines → ENHANCED: ~130+ lines)
import "./globals.css";
import { ReactNode } from "react";
import { Navigation } from "../src/components/Navigation";
import { ClientWalletProvider } from "../src/components/ClientWalletProvider";

export const metadata = {
  title: "SolRPS - Rock Paper Scissors on Solana",
  description: "Play-to-earn Rock Paper Scissors on Solana blockchain with weekly competitions and anti-sybil protection",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {/* 
          CLIENT-SIDE WALLET PROVIDER - Handles both mock and blockchain modes
          This wrapper automatically detects environment variables and loads the appropriate provider
        */}
        <ClientWalletProvider>
          <AppStructure>
            {children}
          </AppStructure>
        </ClientWalletProvider>
      </body>
    </html>
  );
}

// Main app structure component
function AppStructure({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Navigation Header */}
      <Navigation />
      
      {/* Main Content Area */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Phase 2 Development Banner */}
          <DevelopmentBanner />
          
          {/* Page Content */}
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}

// Development banner component (client-side only)
function DevelopmentBanner() {
  // Only render on client-side in development
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return null;
  }

  const isPhase2Enabled = process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';
  const isBlockchainEnabled = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';

  if (!isPhase2Enabled) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl animate-pulse">🚀</span>
        <div>
          <h3 className="text-lg font-bold text-white">
            Phase 2 Step 2 - Real Wallet Integration
          </h3>
          <p className="text-sm text-gray-300">
            {isBlockchainEnabled
              ? "🔥 BLOCKCHAIN MODE ACTIVE - Real Solana wallets enabled!"
              : "Mock wallets active - Set USE_BLOCKCHAIN=true for real wallets"
            }
          </p>
        </div>
      </div>
      
      {/* Configuration Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
        <div className={`px-2 py-1 rounded text-center font-medium ${
          isBlockchainEnabled 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
        }`}>
          <div className="font-bold">Blockchain</div>
          <div>{isBlockchainEnabled ? 'ENABLED ✅' : 'DISABLED'}</div>
        </div>
        
        <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-center">
          <div className="font-bold">Cluster</div>
          <div>{process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.toUpperCase() || 'DEVNET'}</div>
        </div>
        
        <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-center">
          <div className="font-bold">Phase 2</div>
          <div>{isPhase2Enabled ? 'ACTIVE' : 'INACTIVE'}</div>
        </div>
        
        {isBlockchainEnabled && (
          <div className="px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-center animate-pulse">
            <div className="font-bold">Status</div>
            <div>LIVE 🔗</div>
          </div>
        )}
      </div>
      
      {/* Status Message */}
      {isBlockchainEnabled ? (
        <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-green-300 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <strong>Phase 2 Step 2 Active:</strong>
          </div>
          <div className="mt-1 text-green-200">
            Real Solana wallet connections enabled! Connect Phantom or Solflare to play with real wallets.
          </div>
        </div>
      ) : (
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-300 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">⏳</span>
            <strong>Mock Mode Active:</strong>
          </div>
          <div className="mt-1 text-yellow-200">
            Set <code className="bg-black/30 px-1 rounded">USE_BLOCKCHAIN=true</code> in .env.local to enable real wallet connections.
          </div>
        </div>
      )}
    </div>
  );
}

// Simple footer component
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-900/50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <span className="font-medium">SolRPS</span>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
              Phase 2 Step 2
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <span>Rock Paper Scissors on Solana</span>
            <span className="hidden md:inline">•</span>
            <span>Play-to-Earn Gaming</span>
            <span className="hidden md:inline">•</span>
            <span>Weekly Competitions</span>
          </div>
          
          <div className="text-xs text-gray-500">
            Built with Next.js + Solana Web3
          </div>
        </div>
      </div>
    </footer>
  );
}
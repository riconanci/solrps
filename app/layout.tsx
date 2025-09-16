// app/layout.tsx - COMPLETE REWRITE: Proper Wallet Provider Setup
import "./globals.css";
import { ReactNode } from "react";
import { Navigation } from "../src/components/Navigation";
import { SolanaWalletProvider } from "../src/components/SolanaWalletProvider";

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
      <body className="min-h-screen bg-slate-900 text-white antialiased">
        {/* 
          COMPLETE REWRITE: Clean wallet provider setup
          This provides: ConnectionProvider > WalletProvider > WalletModalProvider
          All in the correct order with proper configuration
        */}
        <SolanaWalletProvider>
          <AppContent>
            {children}
          </AppContent>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}

// Main app content component
function AppContent({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <Navigation />
      
      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Development Status Banner */}
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

// Development banner showing current configuration
function DevelopmentBanner() {
  // Only show in development on client-side
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return null;
  }

  const isPhase2Enabled = process.env.NEXT_PUBLIC_ENABLE_PHASE2 === 'true';
  const isBlockchainEnabled = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
  const hasTokenMint = !!process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl animate-pulse">🚀</span>
        <div>
          <h3 className="text-lg font-bold text-white">
            SolRPS - Phase 2 Development Mode
          </h3>
          <p className="text-sm text-gray-300">
            Real Solana wallet integration with SPL token support
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={isPhase2Enabled ? "text-green-400" : "text-red-400"}>
            {isPhase2Enabled ? "✅" : "❌"}
          </span>
          <span>Phase 2 UI</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={isBlockchainEnabled ? "text-green-400" : "text-red-400"}>
            {isBlockchainEnabled ? "✅" : "❌"}
          </span>
          <span>Blockchain Mode</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={hasTokenMint ? "text-green-400" : "text-yellow-400"}>
            {hasTokenMint ? "✅" : "⚠️"}
          </span>
          <span>Token Configuration</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-blue-400">🌐</span>
          <span>{process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet'}</span>
        </div>
      </div>
      
      <div className="mt-3 p-2 bg-black/20 rounded text-xs text-gray-400">
        <div><strong>Current Configuration:</strong></div>
        <div>• Wallet Provider: {isBlockchainEnabled ? 'Solana (Real Wallets)' : 'Mock (URL Switching)'}</div>
        <div>• Balance Source: {hasTokenMint && isBlockchainEnabled ? 'SPL Token' : 'Database'}</div>
        <div>• Network: {process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet'}</div>
        {!hasTokenMint && isBlockchainEnabled && (
          <div className="text-yellow-400 mt-1">⚠️ Add NEXT_PUBLIC_TOKEN_MINT_ADDRESS to .env for token mode</div>
        )}
      </div>
    </div>
  );
}

// Simple footer component
function Footer() {
  return (
    <footer className="border-t border-slate-700 bg-slate-800/50 py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-4">
          <span>SolRPS - Rock Paper Scissors on Solana</span>
          <span>•</span>
          <span>Phase 2: Real Wallet Integration</span>
          <span>•</span>
          <span>Built with Next.js & Solana</span>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {process.env.NODE_ENV === 'development' && (
            <>Development Mode • {new Date().getFullYear()}</>
          )}
        </div>
      </div>
    </footer>
  );
}
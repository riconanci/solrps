// src/components/WalletGuard.tsx
import { ReactNode } from 'react';
import { useGameWallet } from '../hooks/useGameWallet';

interface WalletGuardProps {
  children: ReactNode;
  message?: string;
}

export const WalletGuard = ({ 
  children, 
  message = "Connect your wallet to play SolRPS" 
}: WalletGuardProps) => {
  const gameWallet = useGameWallet();

  if (!gameWallet.connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">User Required</h2>
          <p className="text-gray-400 mb-6">{message}</p>
        </div>
        
        <div className="text-sm text-gray-400">
          Connecting to mock wallet...
        </div>
        
        {gameWallet.connecting && (
          <div className="text-sm text-gray-400">
            Connecting...
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
// src/hooks/useGameWallet.ts
import { useWallet as useMockWallet } from '../state/wallet';

export interface GameWallet {
  connected: boolean;
  connecting: boolean;
  balance: number;
  userId: string | null;
  disconnect: () => void | Promise<void>;
  refreshBalance: () => void | Promise<void>;
}

export const useGameWallet = (): GameWallet => {
  const mockWallet = useMockWallet();

  // For now, always use mock wallet
  // Later we'll add logic to switch between mock and Solana wallet
  return {
    connected: !!mockWallet.userId,
    connecting: false,
    balance: mockWallet.balance || 0,
    userId: mockWallet.userId || null,
    disconnect: () => {
      // Mock disconnect - for testing only
      mockWallet.connect('', 0, '');
    },
    refreshBalance: async () => {
      // Mock refresh - could fetch from API if needed
      if (mockWallet.userId) {
        try {
          const response = await fetch(`/api/user/${mockWallet.userId}`);
          if (response.ok) {
            const data = await response.json();
            mockWallet.setBalance(data.balance);
          }
        } catch (error) {
          console.warn('Failed to refresh balance:', error);
        }
      }
    },
  };
};
// src/state/wallet.ts
import { create } from "zustand";

type WalletState = {
  userId?: string;
  balance: number;
  displayName?: string;
  isConnected: boolean;
  connect: (userId: string, balance: number, displayName?: string) => void;
  disconnect: () => void;
  setBalance: (balance: number) => void;
  updateBalance: (change: number) => void;
};

export const useWallet = create<WalletState>((set, get) => ({
  userId: undefined,
  balance: 0,
  displayName: undefined,
  isConnected: false,
  
  connect: (userId, balance, displayName) => 
    set({ 
      userId, 
      balance, 
      displayName, 
      isConnected: true 
    }),
  
  disconnect: () => 
    set({ 
      userId: undefined, 
      balance: 0, 
      displayName: undefined, 
      isConnected: false 
    }),
  
  setBalance: (balance) => 
    set({ balance }),
  
  updateBalance: (change) => 
    set((state) => ({ 
      balance: state.balance + change 
    })),
}));

// Auto-connect to seed_alice for demo purposes
if (typeof window !== "undefined") {
  const store = useWallet.getState();
  if (!store.isConnected) {
    store.connect("seed_alice", 500000, "Alice");
  }
}
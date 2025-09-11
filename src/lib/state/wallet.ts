import { create } from "zustand";

type WalletState = {
  userId?: string;
  balance: number;
  connect: (userId: string, balance: number) => void;
  setBalance: (n: number) => void;
};

export const useWallet = create<WalletState>((set) => ({
  userId: undefined,
  balance: 0,
  connect: (userId, balance) => set({ userId, balance }),
  setBalance: (n) => set({ balance: n }),
}));

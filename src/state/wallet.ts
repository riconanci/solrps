// src/state/wallet.ts - Complete Clean Implementation
"use client";
import { create } from "zustand";

interface WalletState {
  userId: string | null;
  balance: number;
  displayName: string | null;
  isConnected: boolean;
  
  connect: (userId: string, balance: number, displayName?: string) => void;
  disconnect: () => void;
  setBalance: (balance: number) => void;
  updateBalance: (change: number) => void;
  switchUser: (userId: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

interface SeedUser {
  name: string;
  displayName: string;
  defaultBalance: number;
  description: string;
}

const SEED_USERS: Record<string, SeedUser> = {
  seed_alice: { 
    name: "Alice", 
    displayName: "Alice",
    defaultBalance: 500000,
    description: "Creator/Host player for testing game creation flow"
  },
  seed_bob: { 
    name: "Bob", 
    displayName: "Bob",
    defaultBalance: 500000,
    description: "Challenger player for testing game joining flow"
  }
};

export const useWallet = create<WalletState>((set, get) => ({
  userId: null,
  balance: 0,
  displayName: null,
  isConnected: false,
  
  connect: (userId: string, balance: number, displayName?: string) => {
    console.log(`Connecting wallet: ${userId} with balance: ${balance}`);
    const seedUser = SEED_USERS[userId];
    
    set({ 
      userId, 
      balance, 
      displayName: displayName || seedUser?.displayName || userId,
      isConnected: true 
    });
    
    console.log(`Connected as: ${displayName || seedUser?.displayName || userId}`);
  },
  
  disconnect: () => {
    console.log('Disconnecting wallet');
    set({ 
      userId: null, 
      balance: 0, 
      displayName: null, 
      isConnected: false 
    });
  },
  
  setBalance: (balance: number) => {
    console.log(`Setting balance to: ${balance.toLocaleString()}`);
    set({ balance });
  },
  
  updateBalance: (change: number) => {
    const currentState = get();
    const newBalance = currentState.balance + change;
    console.log(`Balance change: ${change > 0 ? '+' : ''}${change.toLocaleString()}`);
    set({ balance: newBalance });
  },

  switchUser: async (userId: string) => {
    console.log(`Switching to user: ${userId}`);
    
    try {
      console.log(`Fetching user data from /api/user/${userId}...`);
      const res = await fetch(`/api/user/${userId}`);
      
      if (res.ok) {
        const userData = await res.json();
        const seedUser = SEED_USERS[userId];
        
        console.log(`API response:`, userData);
        
        const defaultBalance = seedUser?.defaultBalance || 500000;
        const fallbackDisplayName = seedUser?.displayName || `User ${userId.slice(0, 8)}`;
        
        get().connect(
          userId, 
          userData.mockBalance || userData.balance || defaultBalance, 
          userData.displayName || fallbackDisplayName
        );
      } else {
        throw new Error(`API responded with ${res.status}: ${res.statusText}`);
      }
    } catch (error) {
      console.warn("Failed to fetch user from API, using fallback:", error);
      
      const seedUser = SEED_USERS[userId];
      if (seedUser) {
        console.log(`Using seed data for ${userId}:`, seedUser);
        get().connect(userId, seedUser.defaultBalance, seedUser.displayName);
      } else {
        console.error(`Unknown user: ${userId}`);
        get().connect(userId, 500000, `User ${userId.slice(0, 8)}`);
      }
    }
  },

  refreshBalance: async () => {
    const { userId } = get();
    if (!userId) {
      console.warn('Cannot refresh balance: no user connected');
      return;
    }
    
    try {
      console.log(`Refreshing balance for: ${userId}`);
      const response = await fetch(`/api/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        const newBalance = data.mockBalance || data.balance || 0;
        console.log(`Balance refreshed: ${newBalance.toLocaleString()}`);
        set({ balance: newBalance });
      } else {
        console.warn(`Failed to refresh balance: ${response.status}`);
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  },
}));

// Auto-connect logic
if (typeof window !== "undefined") {
  const store = useWallet.getState();
  
  if (!store.isConnected) {
    console.log('Auto-connecting wallet...');
    
    function determineUser(): string {
      console.log('Determining user...');
      
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      
      console.log(`URL parameter: ${userParam}`);
      
      if (userParam === 'alice' || userParam === 'seed_alice') {
        console.log('User determined from URL: Alice');
        return 'seed_alice';
      }
      if (userParam === 'bob' || userParam === 'seed_bob') {
        console.log('User determined from URL: Bob');
        return 'seed_bob';
      }
      
      try {
        const savedUser = localStorage.getItem('solrps-preferred-user');
        console.log(`localStorage preference: ${savedUser}`);
        
        if (savedUser === 'seed_alice' || savedUser === 'alice') {
          console.log('User determined from localStorage: Alice');
          return 'seed_alice';
        }
        if (savedUser === 'seed_bob' || savedUser === 'bob') {
          console.log('User determined from localStorage: Bob');
          return 'seed_bob';
        }
      } catch (error) {
        console.warn('localStorage not available:', error);
      }
      
      try {
        const isIncognito = !window.localStorage || 
                           window.navigator.userAgent.includes('Headless') ||
                           window.outerHeight === 0;
        
        console.log(`Browser context - Incognito: ${isIncognito}`);
        
        if (isIncognito) {
          console.log('Incognito mode detected, defaulting to Bob for testing');
          return 'seed_bob';
        }
      } catch (error) {
        console.warn('Browser fingerprinting failed:', error);
      }
      
      console.log('No preferences found, defaulting to Alice');
      return 'seed_alice';
    }
    
    const targetUser = determineUser();
    console.log(`Target user: ${targetUser}`);
    
    try {
      localStorage.setItem('solrps-preferred-user', targetUser);
      console.log('Saved user preference to localStorage');
    } catch (error) {
      console.warn('Failed to save preference:', error);
    }
    
    store.switchUser(targetUser);
  }
}

export const useMockWalletInitialization = () => {
  const switchUser = useWallet(state => state.switchUser);
  
  return {
    switchToAlice: () => {
      console.log('Switching to Alice...');
      window.location.href = '?user=alice';
    },
    
    switchToBob: () => {
      console.log('Switching to Bob...');
      window.location.href = '?user=bob';
    },
    
    switchUser: async (userId: string) => {
      console.log(`Manual switch to: ${userId}`);
      await switchUser(userId);
      
      const url = new URL(window.location.href);
      const userParam = userId.replace('seed_', '');
      url.searchParams.set('user', userParam);
      window.history.replaceState({}, '', url.toString());
    }
  };
};

// Console helpers for development
if (typeof window !== "undefined") {
  (window as any).switchToAlice = () => {
    console.log('Console command: Switching to Alice');
    window.location.href = '?user=alice';
  };
  
  (window as any).switchToBob = () => {
    console.log('Console command: Switching to Bob');
    window.location.href = '?user=bob';
  };
  
  (window as any).refreshBalance = () => {
    console.log('Console command: Refreshing balance');
    useWallet.getState().refreshBalance();
  };
  
  (window as any).getWalletState = () => {
    const state = useWallet.getState();
    console.log('Current wallet state:', {
      userId: state.userId,
      balance: state.balance,
      displayName: state.displayName,
      isConnected: state.isConnected
    });
    return state;
  };
  
  console.log('Console helpers available:');
  console.log('- switchToAlice() - Switch to Alice');
  console.log('- switchToBob() - Switch to Bob');
  console.log('- refreshBalance() - Refresh current balance');
  console.log('- getWalletState() - Show current state');
}
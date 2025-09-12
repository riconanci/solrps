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
  switchUser: (userId: string) => Promise<void>;
};

// Seed user data
const SEED_USERS = {
  seed_alice: { name: "Alice", defaultBalance: 500000 },
  seed_bob: { name: "Bob", defaultBalance: 500000 }
} as const;

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

  switchUser: async (userId: string) => {
    try {
      // Try to fetch real balance from API
      const res = await fetch(`/api/user/${userId}`);
      if (res.ok) {
        const userData = await res.json();
        const seedUser = SEED_USERS[userId as keyof typeof SEED_USERS];
        get().connect(userId, userData.balance, seedUser?.name || userData.displayName);
      } else {
        throw new Error("API fetch failed");
      }
    } catch (error) {
      console.warn("Failed to fetch user from API, using fallback:", error);
      // Fallback to seed data
      const seedUser = SEED_USERS[userId as keyof typeof SEED_USERS];
      if (seedUser) {
        get().connect(userId, seedUser.defaultBalance, seedUser.name);
      }
    }
  }
}));

/**
 * Auto-connect logic with user detection
 * Priority order:
 * 1. URL parameter: ?user=alice or ?user=bob
 * 2. localStorage preference (for persistence across page loads)
 * 3. Browser fingerprinting (incognito vs regular)
 * 4. Default to Alice
 */
if (typeof window !== "undefined") {
  const store = useWallet.getState();
  
  if (!store.isConnected) {
    // Function to determine which user to connect as
    function determineUser(): keyof typeof SEED_USERS {
      // 1. Check URL parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      
      if (userParam === 'alice' || userParam === 'seed_alice') {
        return 'seed_alice';
      }
      if (userParam === 'bob' || userParam === 'seed_bob') {
        return 'seed_bob';
      }
      
      // 2. Check localStorage preference
      try {
        const savedUser = localStorage.getItem('solrps_test_user');
        if (savedUser === 'seed_alice' || savedUser === 'seed_bob') {
          return savedUser as keyof typeof SEED_USERS;
        }
      } catch (error) {
        // localStorage might not be available
      }
      
      // 3. Try to detect incognito/private mode
      // In private mode, various storage APIs behave differently
      try {
        // Test if we can use localStorage (fails in some private modes)
        localStorage.setItem('_test', '1');
        localStorage.removeItem('_test');
        
        // Test sessionStorage behavior (also limited in private mode)
        const isPrivateMode = !window.indexedDB || 
                            window.navigator.webdriver === true ||
                            window.navigator.userAgent.includes('HeadlessChrome');
        
        if (isPrivateMode) {
          return 'seed_bob'; // Use Bob in private/incognito
        }
      } catch (e) {
        // Likely private mode
        return 'seed_bob';
      }
      
      // 4. Default to Alice
      return 'seed_alice';
    }
    
    const selectedUser = determineUser();
    const userData = SEED_USERS[selectedUser];
    
    // Save preference for consistency
    try {
      localStorage.setItem('solrps_test_user', selectedUser);
    } catch (error) {
      // Private mode or storage disabled
    }
    
    // Auto-connect
    store.connect(selectedUser, userData.defaultBalance, userData.name);
    
    // Log for developer convenience
    console.log(`🎮 SolRPS: Auto-connected as ${userData.name} (${selectedUser})`);
    console.log(`💡 To switch users:
    - Regular window: ?user=alice or ?user=bob
    - Incognito window: automatically uses Bob
    - Console: useWallet.getState().switchUser('seed_bob')`);
  }
}

// Helper function for manual user switching from console
if (typeof window !== "undefined") {
  (window as any).switchToAlice = () => useWallet.getState().switchUser('seed_alice');
  (window as any).switchToBob = () => useWallet.getState().switchUser('seed_bob');
}
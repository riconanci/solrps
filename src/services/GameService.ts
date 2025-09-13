// src/services/GameService.ts
export interface GameSessionData {
  id: string;
  creator: string;
  challenger?: string;
  rounds: number;
  stakePerRound: number;
  totalStake: number;
  status: 'OPEN' | 'LOCKED' | 'AWAITING_REVEAL' | 'RESOLVED' | 'FORFEITED';
  createdAt: Date;
  isPrivate?: boolean;
  privateCode?: string;
}

export interface CreateGameParams {
  rounds: 1 | 3 | 5;
  stakePerRound: 100 | 500 | 1000;
  moves: string[]; // ['R', 'P', 'S']
  isPrivate?: boolean;
}

export interface JoinGameParams {
  sessionId: string;
  moves: string[];
}

export interface GameResult {
  sessionId: string;
  winner?: string;
  creatorWins: number;
  challengerWins: number;
  draws: number;
  pot: number;
  fees: number;
  payout: number;
  roundResults: Array<{
    creatorMove: string;
    challengerMove: string;
    winner: 'creator' | 'challenger' | 'draw';
  }>;
}

export interface IGameService {
  createGame(params: CreateGameParams): Promise<{ sessionId: string; privateCode?: string }>;
  joinGame(params: JoinGameParams): Promise<GameResult>;
  getGame(sessionId: string): Promise<GameSessionData | null>;
  getOpenGames(): Promise<GameSessionData[]>;
  getUserGames(userId: string): Promise<GameSessionData[]>;
  getUserBalance(userId: string): Promise<number>;
  updateUserBalance(userId: string, change: number): Promise<void>;
}

// Mock service implementation (uses existing API)
export class MockGameService implements IGameService {
  async createGame(params: CreateGameParams): Promise<{ sessionId: string; privateCode?: string }> {
    // Use existing API route
    const response = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rounds: params.rounds,
        stakePerRound: params.stakePerRound,
        moves: params.moves,
        isPrivate: params.isPrivate,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create game');
    }

    const data = await response.json();
    return {
      sessionId: data.sessionId,
      privateCode: data.privateCode,
    };
  }

  async joinGame(params: JoinGameParams): Promise<GameResult> {
    const response = await fetch('/api/session/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: params.sessionId,
        challengerMoves: params.moves,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to join game');
    }

    return await response.json();
  }

  async getGame(sessionId: string): Promise<GameSessionData | null> {
    const response = await fetch(`/api/session/${sessionId}`);
    if (!response.ok) return null;
    return await response.json();
  }

  async getOpenGames(): Promise<GameSessionData[]> {
    const response = await fetch('/api/lobby');
    if (!response.ok) return [];
    return await response.json();
  }

  async getUserGames(userId: string): Promise<GameSessionData[]> {
    const response = await fetch(`/api/me/matches?userId=${userId}`);
    if (!response.ok) return [];
    return await response.json();
  }

  async getUserBalance(userId: string): Promise<number> {
    const response = await fetch(`/api/user/${userId}`);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.balance;
  }

  async updateUserBalance(userId: string, change: number): Promise<void> {
    // This would be handled by the API in mock mode
    // No direct balance updates needed
  }
}

// Factory function to get the appropriate service
export function createGameService(): IGameService {
  // For now, always return mock service
  // Later we'll add blockchain service when ready
  return new MockGameService();
}
// src/hooks/useGameService.ts - Simplified version without dependencies
import { useState, useCallback } from 'react';
import { useWallet } from '../state/wallet';

interface CreateGameParams {
  rounds: 1 | 3 | 5;
  stakePerRound: 100 | 500 | 1000;
  moves: string[];
  isPrivate?: boolean;
}

interface JoinGameParams {
  sessionId: string;
  moves: string[];
}

export const useGameService = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  const createGame = useCallback(async (params: CreateGameParams) => {
    if (!wallet.userId) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create game';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const joinGame = useCallback(async (params: JoinGameParams) => {
    if (!wallet.userId) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join game';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const getOpenGames = useCallback(async () => {
    try {
      const response = await fetch('/api/lobby');
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch open games:', err);
      return [];
    }
  }, []);

  const getUserGames = useCallback(async () => {
    if (!wallet.userId) return [];
    
    try {
      const response = await fetch(`/api/me/matches?userId=${wallet.userId}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch user games:', err);
      return [];
    }
  }, [wallet.userId]);

  return {
    createGame,
    joinGame,
    getOpenGames,
    getUserGames,
    loading,
    error,
    clearError: () => setError(null),
  };
};
// src/components/GameModeIndicator.tsx
import { APP_CONFIG } from '../config/constants';

export const GameModeIndicator = () => {
  return (
    <div className="bg-slate-800 border border-white/10 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {APP_CONFIG.USE_BLOCKCHAIN ? '🔗 Blockchain Mode' : '🔧 Mock Mode'}
          </h3>
          <p className="text-gray-400 text-sm">
            {APP_CONFIG.USE_BLOCKCHAIN 
              ? `Games run on Solana ${APP_CONFIG.SOLANA_CLUSTER}. Real transactions and fees.`
              : 'Games use mock escrow. No real transactions.'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            APP_CONFIG.USE_BLOCKCHAIN 
              ? 'bg-green-600 text-white' 
              : 'bg-yellow-600 text-black'
          }`}>
            {APP_CONFIG.USE_BLOCKCHAIN ? 'LIVE' : 'MOCK'}
          </span>
          
          {APP_CONFIG.ENABLE_PHASE2 && (
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
              PHASE 2
            </span>
          )}
        </div>
      </div>
      
      {APP_CONFIG.USE_BLOCKCHAIN && APP_CONFIG.PROGRAM_ID && (
        <div className="mt-2 text-xs text-gray-500">
          Program: {APP_CONFIG.PROGRAM_ID.slice(0, 8)}...{APP_CONFIG.PROGRAM_ID.slice(-8)}
        </div>
      )}
    </div>
  );
};
// src/lib/secret.ts
export type RevealSecret = { 
  salt: string; 
  moves: string[] 
};

const key = (sessionId: string) => `solrps:secret:${sessionId}`;

export function saveSecret(sessionId: string, secret: RevealSecret) {
  try { 
    localStorage.setItem(key(sessionId), JSON.stringify(secret)); 
  } catch {
    // Ignore localStorage errors in SSR or private browsing
  }
}

export function loadSecret(sessionId: string): RevealSecret | null {
  try { 
    const s = localStorage.getItem(key(sessionId)); 
    return s ? JSON.parse(s) : null; 
  } catch { 
    return null; 
  }
}

export function removeSecret(sessionId: string) {
  try { 
    localStorage.removeItem(key(sessionId)); 
  } catch {
    // Ignore localStorage errors
  }
}
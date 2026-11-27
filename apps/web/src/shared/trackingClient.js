import { api, getToken } from './api.js';
import { StompClient } from './stomp.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
/** https://host/api/v1 -> wss://host/ws/tracking (always TLS in production). */
export const wsUrl = () => `${API_BASE.replace(/\/api\/v1\/?$/, '').replace(/^http/i, 'ws')}/ws/tracking`;

let client = null; let users = 0; const stateListeners = new Set(); let lastState = 'idle';

/**
 * One shared STOMP connection per tab (customer tracking screen and partner sharing both use it). Reference counted:
 * the socket closes when the last screen stops using it. getToken first makes a cheap authenticated call so an expired access
 * token is refreshed by the normal API client before the CONNECT frame is sent.
 */
export function acquireStomp(onState) {
  if (onState) { stateListeners.add(onState); onState(lastState); }
  users += 1;
  if (!client) {
    client = new StompClient({
      url: wsUrl(),
      getToken: async () => { try { await api('/tracking/config'); } catch { /* offline: try with what we have */ } return getToken(); },
      onState: (s) => { lastState = s; stateListeners.forEach((f) => f(s)); },
    });
    client.activate();
  }
  return {
    client,
    release() { if (onState) stateListeners.delete(onState); users = Math.max(0, users - 1); if (users === 0 && client) { client.deactivate(); client = null; lastState = 'idle'; } },
  };
}

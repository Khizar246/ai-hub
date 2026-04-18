// Generates and persists a UUID session_id in localStorage; returns it as a stable string.

import { useState } from 'react';

const SESSION_KEY = 'ai_hub_session_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Returns a stable session ID for the lifetime of the browser session.
 * The ID is created once, stored in localStorage, and reused on every reload.
 */
export function useSession(): string {
  const [sessionId] = useState<string>(getOrCreateSessionId);
  return sessionId;
}

/** Imperatively read the current session ID without a hook (for use outside React). */
export function getSessionId(): string {
  return getOrCreateSessionId();
}

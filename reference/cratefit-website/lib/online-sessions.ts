import { randomUUID } from 'crypto';
import { OnlinePacker, type BinSpec, type ItemSpec } from '@cratefit/pack';

interface Session {
  packer: OnlinePacker;
  bin: BinSpec;
  createdAt: number;
  lastAccess: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes (reduced from 30 for better memory management)
const MAX_SESSIONS = 1000; // Limit to prevent memory issues
const CLEANUP_THRESHOLD = 0.8; // Trigger aggressive cleanup at 80% capacity
const CLEANUP_TARGET = 0.5; // Clean down to 50% capacity when threshold exceeded
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute between cleanups
let lastCleanupTime = 0;

export function generateSessionId(): string {
  return randomUUID();
}

// Safely dispose a session's packer resources
function disposeSession(session: Session) {
  try {
    // OnlinePacker may have resources that need cleanup
    const packer = session.packer as unknown as { dispose?: () => void };
    if (packer && typeof packer.dispose === 'function') {
      packer.dispose();
    }
  } catch {
    // Ignore disposal errors
  }
}

// Clean up expired sessions
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL) {
      disposeSession(session);
      sessions.delete(sessionId);
    }
  }
}

// Deterministic cleanup strategy with time-based throttling
// This ensures consistent memory management without excessive overhead
export function maintainSessions() {
  const now = Date.now();
  const currentSize = sessions.size;

  // Always cleanup if approaching capacity threshold (regardless of time)
  if (currentSize >= MAX_SESSIONS * CLEANUP_THRESHOLD) {
    cleanupExpiredSessions();

    // If still above target after TTL cleanup, force remove oldest sessions
    if (sessions.size >= MAX_SESSIONS * CLEANUP_TARGET) {
      forceCleanupOldestSessions(Math.floor(MAX_SESSIONS * CLEANUP_TARGET));
    }
    lastCleanupTime = now;
    return;
  }

  // Time-based cleanup: run every CLEANUP_INTERVAL instead of random probability
  // This provides deterministic behavior while limiting overhead
  if (now - lastCleanupTime > CLEANUP_INTERVAL) {
    cleanupExpiredSessions();
    lastCleanupTime = now;
  }
}

// Force cleanup to target size by removing oldest sessions
function forceCleanupOldestSessions(targetSize: number) {
  if (sessions.size <= targetSize) return;

  const sortedSessions = [...sessions.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess
  );

  const toRemoveCount = sessions.size - targetSize;
  for (let i = 0; i < toRemoveCount && i < sortedSessions.length; i++) {
    const [id, session] = sortedSessions[i]!;
    disposeSession(session);
    sessions.delete(id);
  }
}

export function createSession(bin: BinSpec): string {
  // Use maintainSessions for consistent cleanup strategy
  maintainSessions();

  // Hard limit check - should rarely trigger due to maintainSessions
  if (sessions.size >= MAX_SESSIONS) {
    forceCleanupOldestSessions(Math.floor(MAX_SESSIONS * CLEANUP_TARGET));
  }

  const sessionId = generateSessionId();
  const packer = new OnlinePacker({ bins: [bin] });

  sessions.set(sessionId, {
    packer,
    bin,
    createdAt: Date.now(),
    lastAccess: Date.now(),
  });

  return sessionId;
}

export function getSession(sessionId: string): OnlinePacker | null {
  // Probabilistic cleanup on access
  maintainSessions();

  const session = sessions.get(sessionId);
  if (!session) return null;

  session.lastAccess = Date.now();
  return session.packer;
}

export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    disposeSession(session);
  }
  return sessions.delete(sessionId);
}

/**
 * Reset a session's packer and re-add the original bin.
 * This properly handles the reset by clearing the packer state
 * and re-initializing it with the session's bin.
 *
 * @returns true if reset successful, false if session not found
 */
export function resetSession(sessionId: string): boolean {
  maintainSessions();

  const session = sessions.get(sessionId);
  if (!session) return false;

  // Update lastAccess
  session.lastAccess = Date.now();

  // Reset the packer (clears all bins and items)
  session.packer.reset();

  // Re-add the original bin to restore working state
  session.packer.addBin(session.bin);

  return true;
}

export function getSessionState(sessionId: string) {
  // Call maintainSessions for probabilistic cleanup
  maintainSessions();

  const session = sessions.get(sessionId);
  if (!session) return null;

  // Update lastAccess to prevent expiration during use
  session.lastAccess = Date.now();

  const { packer, bin } = session;

  // Try to get bin state - if missing or error, the session is in an invalid state
  // This can happen due to concurrent reset operations or race conditions
  let binState;
  try {
    binState = packer.getBinState(bin.id);
    // Consolidate both error cases with consistent logging level
    if (!binState) {
      console.error(`Session ${sessionId}: bin ${bin.id} not found in packer (invalid state), cleaning up`);
      disposeSession(session);
      sessions.delete(sessionId);
      return null;
    }
  } catch (error) {
    console.error(`Session ${sessionId}: error getting bin state:`, error);
    disposeSession(session);
    sessions.delete(sessionId);
    return null;
  }

  return {
    bin,
    items: binState.items,
    utilization: binState.utilization,
    stats: packer.getStats(),
  };
}

// Note: Session cleanup is now done on each createSession call
// This is more reliable in serverless environments than setInterval

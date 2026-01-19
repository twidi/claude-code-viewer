import type {
  PublicSessionProcess,
  SessionProcessStatus,
} from "../types/session-process";

interface SessionWithDateAndId {
  id: string;
  lastModifiedAt: Date | string;
}

/**
 * Gets the priority of a session for sorting.
 * Lower values have higher priority (appear first).
 *
 * - Priority 0: Active sessions (starting, pending, running) - agent is working
 * - Priority 1: Paused sessions - recent, waiting for user input (auto-aborted after timeout)
 * - Priority 2: Starred sessions - user's favorites
 * - Priority 3: Other sessions - history
 *
 * Note: With auto-abort enabled, paused sessions are automatically cleaned up
 * after the configured timeout, keeping this tier small and relevant.
 */
export const getSessionPriority = (
  status: SessionProcessStatus | undefined,
  isStarred: boolean,
): number => {
  if (status === "starting" || status === "pending" || status === "running") {
    return 0;
  }
  if (status === "paused") {
    return 1;
  }
  if (isStarred) {
    return 2;
  }
  return 3;
};

/**
 * @deprecated Use getSessionPriority instead. This function is kept for backward compatibility.
 */
export const getStatusPriority = (
  status: SessionProcessStatus | undefined,
): number => {
  return getSessionPriority(status, false);
};

/**
 * Sorts sessions by their process status, starred state, and date.
 * Order: active first, then paused, then starred, then others.
 * Within each group, sorted by lastModifiedAt (newest first).
 *
 * This function is used on both backend (for pagination) and frontend (for real-time updates).
 */
export const sortSessionsByStatusAndDate = <T extends SessionWithDateAndId>(
  sessions: T[],
  sessionProcesses: PublicSessionProcess[],
  starredSessionIds: Set<string> = new Set(),
): T[] => {
  return [...sessions].sort((a, b) => {
    const aProcess = sessionProcesses.find(
      (process) => process.sessionId === a.id,
    );
    const bProcess = sessionProcesses.find(
      (process) => process.sessionId === b.id,
    );

    const aPriority = getSessionPriority(
      aProcess?.status,
      starredSessionIds.has(a.id),
    );
    const bPriority = getSessionPriority(
      bProcess?.status,
      starredSessionIds.has(b.id),
    );

    // First sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then sort by lastModifiedAt (newest first)
    const aTime = a.lastModifiedAt ? new Date(a.lastModifiedAt).getTime() : 0;
    const bTime = b.lastModifiedAt ? new Date(b.lastModifiedAt).getTime() : 0;
    return bTime - aTime;
  });
};

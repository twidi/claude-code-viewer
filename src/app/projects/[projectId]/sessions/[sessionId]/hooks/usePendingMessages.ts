import { useCallback, useMemo, useSyncExternalStore } from "react";

export type PendingMessage = {
  text: string;
  queuedAt: string; // ISO timestamp
};

const STORAGE_KEY_PREFIX = "ccv-pending-messages-";

const getStorageKey = (sessionId: string) =>
  `${STORAGE_KEY_PREFIX}${sessionId}`;

/**
 * Get pending messages for a session from localStorage (pure function, not a hook).
 * Used by global session transition handler.
 */
export const getPendingMessagesForSession = (
  sessionId: string,
): PendingMessage[] => {
  if (typeof window === "undefined") return [];
  const value = localStorage.getItem(getStorageKey(sessionId));
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Clear pending messages for a session and return them (pure function, not a hook).
 * Used by global session transition handler.
 */
export const clearPendingMessagesForSession = (
  sessionId: string,
): PendingMessage[] => {
  const messages = getPendingMessagesForSession(sessionId);
  if (messages.length > 0) {
    localStorage.removeItem(getStorageKey(sessionId));
    // Dispatch custom event for same-tab reactivity
    window.dispatchEvent(
      new CustomEvent("pending-messages-change", {
        detail: { sessionId },
      }),
    );
  }
  return messages;
};

// Cache for getSnapshot to avoid infinite loops with useSyncExternalStore
// useSyncExternalStore requires referentially stable results when data hasn't changed
const snapshotCache = new Map<
  string,
  { json: string; value: PendingMessage[] }
>();
const EMPTY_ARRAY: PendingMessage[] = [];

const getSnapshot = (sessionId: string): PendingMessage[] => {
  if (typeof window === "undefined") return EMPTY_ARRAY;
  const value = localStorage.getItem(getStorageKey(sessionId));
  if (!value) {
    snapshotCache.delete(sessionId);
    return EMPTY_ARRAY;
  }

  // Check cache - return same reference if JSON hasn't changed
  const cached = snapshotCache.get(sessionId);
  if (cached && cached.json === value) {
    return cached.value;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      // Cache the result
      snapshotCache.set(sessionId, { json: value, value: parsed });
      return parsed;
    }
    snapshotCache.delete(sessionId);
    return EMPTY_ARRAY;
  } catch {
    snapshotCache.delete(sessionId);
    return EMPTY_ARRAY;
  }
};

const subscribe = (sessionId: string) => (callback: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === getStorageKey(sessionId)) {
      callback();
    }
  };

  // Custom event for same-tab updates
  const handleCustom = (event: Event) => {
    const customEvent = event as CustomEvent<{ sessionId: string }>;
    if (customEvent.detail.sessionId === sessionId) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    "pending-messages-change",
    handleCustom as EventListener,
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      "pending-messages-change",
      handleCustom as EventListener,
    );
  };
};

/**
 * Hook to manage pending messages stored in localStorage.
 *
 * When a user sends a message while Claude is processing,
 * we queue it in localStorage. The messages are auto-sent when
 * the session transitions from running to paused.
 */
// Stable empty subscribe function for when sessionId is undefined
const emptySubscribe = () => () => {};

export const usePendingMessages = (sessionId: string | undefined) => {
  // Memoize the snapshot getter to maintain referential stability
  const getSnapshotMemo = useMemo(
    () => (sessionId ? () => getSnapshot(sessionId) : () => EMPTY_ARRAY),
    [sessionId],
  );

  const pendingMessages = useSyncExternalStore(
    sessionId ? subscribe(sessionId) : emptySubscribe,
    getSnapshotMemo,
    () => EMPTY_ARRAY, // Server snapshot - stable reference
  );

  const addPendingMessage = useCallback(
    (text: string) => {
      if (!sessionId) return;

      const newMessage: PendingMessage = {
        text,
        queuedAt: new Date().toISOString(),
      };

      const currentMessages = getSnapshot(sessionId);
      const updatedMessages = [...currentMessages, newMessage];

      localStorage.setItem(
        getStorageKey(sessionId),
        JSON.stringify(updatedMessages),
      );

      // Dispatch custom event for same-tab reactivity
      window.dispatchEvent(
        new CustomEvent("pending-messages-change", {
          detail: { sessionId },
        }),
      );
    },
    [sessionId],
  );

  const clearPendingMessages = useCallback((): PendingMessage[] => {
    if (!sessionId) return [];

    const currentMessages = getSnapshot(sessionId);
    localStorage.removeItem(getStorageKey(sessionId));

    // Dispatch custom event for same-tab reactivity
    window.dispatchEvent(
      new CustomEvent("pending-messages-change", {
        detail: { sessionId },
      }),
    );

    return currentMessages;
  }, [sessionId]);

  const updatePendingMessage = useCallback(
    (index: number, text: string) => {
      if (!sessionId) return;

      const currentMessages = getSnapshot(sessionId);
      if (index < 0 || index >= currentMessages.length) return;

      const updatedMessages = currentMessages.map((msg, i) =>
        i === index ? { ...msg, text } : msg,
      );

      localStorage.setItem(
        getStorageKey(sessionId),
        JSON.stringify(updatedMessages),
      );

      // Dispatch custom event for same-tab reactivity
      window.dispatchEvent(
        new CustomEvent("pending-messages-change", {
          detail: { sessionId },
        }),
      );
    },
    [sessionId],
  );

  const removePendingMessage = useCallback(
    (index: number) => {
      if (!sessionId) return;

      const currentMessages = getSnapshot(sessionId);
      if (index < 0 || index >= currentMessages.length) return;

      const updatedMessages = currentMessages.filter((_, i) => i !== index);

      if (updatedMessages.length === 0) {
        localStorage.removeItem(getStorageKey(sessionId));
      } else {
        localStorage.setItem(
          getStorageKey(sessionId),
          JSON.stringify(updatedMessages),
        );
      }

      // Dispatch custom event for same-tab reactivity
      window.dispatchEvent(
        new CustomEvent("pending-messages-change", {
          detail: { sessionId },
        }),
      );
    },
    [sessionId],
  );

  const hasPendingMessages = pendingMessages.length > 0;
  const pendingCount = pendingMessages.length;

  return {
    pendingMessages,
    addPendingMessage,
    clearPendingMessages,
    updatePendingMessage,
    removePendingMessage,
    hasPendingMessages,
    pendingCount,
  };
};

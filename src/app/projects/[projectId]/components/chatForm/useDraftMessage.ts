import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY_PREFIX = "ccv-draft-";
const DEBOUNCE_MS = 300;

const getStorageKey = (
  projectId: string,
  sessionId: string | null | undefined,
) => `${STORAGE_KEY_PREFIX}${projectId}-${sessionId ?? "new"}`;

// Cache for getSnapshot to avoid infinite loops with useSyncExternalStore
// useSyncExternalStore requires referentially stable results when data hasn't changed
const snapshotCache = new Map<string, { json: string | null; value: string }>();
const EMPTY_STRING = "";

const getSnapshot = (
  projectId: string,
  sessionId: string | null | undefined,
): string => {
  if (typeof window === "undefined") return EMPTY_STRING;

  const key = getStorageKey(projectId, sessionId);
  const value = localStorage.getItem(key);

  if (!value) {
    snapshotCache.delete(key);
    return EMPTY_STRING;
  }

  // Check cache - return same reference if value hasn't changed
  const cached = snapshotCache.get(key);
  if (cached && cached.json === value) {
    return cached.value;
  }

  // Cache the result
  snapshotCache.set(key, { json: value, value });
  return value;
};

const subscribe =
  (projectId: string, sessionId: string | null | undefined) =>
  (callback: () => void) => {
    const storageKey = getStorageKey(projectId, sessionId);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        callback();
      }
    };

    // Custom event for same-tab updates
    const handleCustom = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId: string;
        sessionId: string | null | undefined;
      }>;
      if (
        customEvent.detail.projectId === projectId &&
        customEvent.detail.sessionId === sessionId
      ) {
        callback();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "draft-message-change",
      handleCustom as EventListener,
    );

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "draft-message-change",
        handleCustom as EventListener,
      );
    };
  };

/**
 * Hook to manage draft message stored in localStorage.
 *
 * Automatically saves the message being typed so it persists across
 * page reloads and navigation between sessions/projects.
 * The draft is cleared when the message is sent.
 */
export const useDraftMessage = (
  projectId: string,
  sessionId?: string | null,
) => {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize the snapshot getter to maintain referential stability
  const getSnapshotMemo = useMemo(
    () => () => getSnapshot(projectId, sessionId),
    [projectId, sessionId],
  );

  // Memoize the subscribe function
  const subscribeMemo = useMemo(
    () => subscribe(projectId, sessionId),
    [projectId, sessionId],
  );

  const draft = useSyncExternalStore(
    subscribeMemo,
    getSnapshotMemo,
    () => EMPTY_STRING, // Server snapshot
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const setDraft = useCallback(
    (text: string) => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the localStorage write
      debounceTimerRef.current = setTimeout(() => {
        const key = getStorageKey(projectId, sessionId);

        if (text === "") {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, text);
        }

        // Dispatch custom event for same-tab reactivity
        window.dispatchEvent(
          new CustomEvent("draft-message-change", {
            detail: { projectId, sessionId },
          }),
        );
      }, DEBOUNCE_MS);
    },
    [projectId, sessionId],
  );

  const clearDraft = useCallback(() => {
    // Clear any pending debounce to prevent stale writes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const key = getStorageKey(projectId, sessionId);
    localStorage.removeItem(key);

    // Dispatch custom event for same-tab reactivity
    window.dispatchEvent(
      new CustomEvent("draft-message-change", {
        detail: { projectId, sessionId },
      }),
    );
  }, [projectId, sessionId]);

  return {
    draft,
    setDraft,
    clearDraft,
  };
};

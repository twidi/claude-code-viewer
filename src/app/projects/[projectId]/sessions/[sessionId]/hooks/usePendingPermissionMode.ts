import { useCallback, useSyncExternalStore } from "react";
import type { PermissionMode } from "@/types/session-process";

const STORAGE_KEY_PREFIX = "ccv-pending-permission-";

const getStorageKey = (sessionId: string) =>
  `${STORAGE_KEY_PREFIX}${sessionId}`;

const getSnapshot = (sessionId: string): PermissionMode | null => {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(getStorageKey(sessionId));
  if (
    value === "default" ||
    value === "acceptEdits" ||
    value === "bypassPermissions" ||
    value === "plan"
  ) {
    return value;
  }
  return null;
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
    "pending-permission-change",
    handleCustom as EventListener,
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      "pending-permission-change",
      handleCustom as EventListener,
    );
  };
};

/**
 * Hook to manage pending permission mode changes stored in localStorage.
 *
 * When a user selects a new permission mode for a session that isn't running,
 * we store it in localStorage. The change is applied when the user sends
 * their next message (resume or continue).
 */
export const usePendingPermissionMode = (sessionId: string | undefined) => {
  const pendingMode = useSyncExternalStore(
    sessionId ? subscribe(sessionId) : () => () => {},
    () => (sessionId ? getSnapshot(sessionId) : null),
    () => null, // Server snapshot
  );

  const setPendingMode = useCallback(
    (mode: PermissionMode | null) => {
      if (!sessionId) return;

      const key = getStorageKey(sessionId);
      if (mode === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, mode);
      }

      // Dispatch custom event for same-tab reactivity
      window.dispatchEvent(
        new CustomEvent("pending-permission-change", {
          detail: { sessionId },
        }),
      );
    },
    [sessionId],
  );

  const clearPendingMode = useCallback(() => {
    setPendingMode(null);
  }, [setPendingMode]);

  return {
    pendingMode,
    setPendingMode,
    clearPendingMode,
  };
};

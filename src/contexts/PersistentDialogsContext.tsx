import type { LucideIcon } from "lucide-react";
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface PersistentDialog {
  id: string;
  icon: LucideIcon;
  label: ReactNode;
  /** Additional context shown in tooltip (e.g., project name) */
  description?: ReactNode;
  /** Badge count displayed on the sidebar icon (e.g., unsent comment count) */
  badgeCount?: number;
}

interface PersistentDialogsContextValue {
  /** Currently registered dialogs */
  dialogs: Map<string, PersistentDialog>;

  /** Register a dialog type (called when dialog component mounts) */
  register: (dialog: PersistentDialog) => void;

  /** Unregister (called when dialog component unmounts) */
  unregister: (id: string) => void;

  /** Currently visible dialog ID (only one at a time), null if all hidden */
  visibleDialogId: string | null;

  /** Show a dialog by ID */
  show: (id: string) => void;

  /** Hide the currently visible dialog */
  hide: () => void;

  /** Toggle visibility of a dialog */
  toggle: (id: string) => void;

  /** Check if a specific dialog is visible */
  isVisible: (id: string) => boolean;
}

const PersistentDialogsContext =
  createContext<PersistentDialogsContextValue | null>(null);

interface PersistentDialogsProviderProps {
  children: ReactNode;
}

export const PersistentDialogsProvider: FC<PersistentDialogsProviderProps> = ({
  children,
}) => {
  const [dialogs, setDialogs] = useState<Map<string, PersistentDialog>>(
    () => new Map(),
  );
  const [visibleDialogId, setVisibleDialogId] = useState<string | null>(null);

  const register = useCallback((dialog: PersistentDialog) => {
    setDialogs((prev) => {
      const next = new Map(prev);
      next.set(dialog.id, dialog);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setDialogs((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setVisibleDialogId((prev) => (prev === id ? null : prev));
  }, []);

  const show = useCallback((id: string) => {
    setVisibleDialogId(id);
  }, []);

  const hide = useCallback(() => {
    setVisibleDialogId(null);
  }, []);

  const toggle = useCallback((id: string) => {
    setVisibleDialogId((prev) => (prev === id ? null : id));
  }, []);

  const isVisible = useCallback(
    (id: string) => visibleDialogId === id,
    [visibleDialogId],
  );

  const value = useMemo(
    () => ({
      dialogs,
      register,
      unregister,
      visibleDialogId,
      show,
      hide,
      toggle,
      isVisible,
    }),
    [
      dialogs,
      register,
      unregister,
      visibleDialogId,
      show,
      hide,
      toggle,
      isVisible,
    ],
  );

  return (
    <PersistentDialogsContext.Provider value={value}>
      {children}
    </PersistentDialogsContext.Provider>
  );
};

/**
 * Hook to access the persistent dialogs context.
 * Returns null when used outside a PersistentDialogsProvider (safe fallback).
 */
export function usePersistentDialogs(): PersistentDialogsContextValue | null {
  return useContext(PersistentDialogsContext);
}

/**
 * Hook to register a persistent dialog and get its visibility state.
 * The dialog is automatically registered on mount and unregistered on unmount.
 * Throws if used outside a PersistentDialogsProvider.
 */
export function usePersistentDialog(dialog: PersistentDialog): {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
} {
  const context = usePersistentDialogs();

  if (!context) {
    throw new Error(
      "usePersistentDialog must be used within a PersistentDialogsProvider",
    );
  }

  const { register, unregister, visibleDialogId, show, hide, toggle } = context;

  // Store dialog.id in a ref so we can access it in cleanup without adding
  // dialog to the dependency array (which would cause unregister on every config change)
  const dialogIdRef = useRef(dialog.id);
  dialogIdRef.current = dialog.id;

  // Unregister only on unmount (not on config changes)
  useEffect(() => {
    return () => unregister(dialogIdRef.current);
  }, [unregister]);

  // Register on mount and re-register when dialog config changes (for dynamic badgeCount)
  useEffect(() => {
    register(dialog);
  }, [register, dialog]);

  return {
    isVisible: visibleDialogId === dialog.id,
    show: () => show(dialog.id),
    hide,
    toggle: () => toggle(dialog.id),
  };
}

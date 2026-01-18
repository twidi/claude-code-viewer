"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
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
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePersistentDialog } from "@/contexts/PersistentDialogsContext";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface CloseConfirmationConfig {
  shouldConfirm: () => boolean;
  title: ReactNode;
  description: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
}

interface PersistentDialogShellProps {
  /** Unique dialog identifier */
  dialogId: string;

  /** Configuration for sidebar icon and tooltip */
  config: {
    icon: LucideIcon;
    label: ReactNode;
    description?: ReactNode;
    badgeCount?: number;
  };

  /**
   * Reset key - when this string changes, the dialog content is remounted.
   * Uses React's native `key` mechanism internally.
   */
  resetKey?: string;

  /**
   * Close confirmation configuration.
   * If provided, closing will show a confirmation dialog.
   */
  closeConfirmation?: CloseConfirmationConfig;

  /**
   * When true, the dialog uses full viewport width (95vw) without max-width constraint.
   * When false (default), the dialog is limited to max-w-7xl (1280px).
   */
  fullWidth?: boolean;

  /** Custom className for the content container */
  className?: string;

  /** Dialog content */
  children: ReactNode;
}

// ============================================================================
// Context for compound components
// ============================================================================

interface ShellContextValue {
  requestClose: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

function useShellContext(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error(
      "PersistentDialogShell compound components must be used within PersistentDialogShell",
    );
  }
  return context;
}

// ============================================================================
// Header compound component
// ============================================================================

interface HeaderProps {
  children: ReactNode;
}

const Header: FC<HeaderProps> = ({ children }) => {
  const { requestClose } = useShellContext();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-background shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
      <Button
        variant="ghost"
        size="icon"
        onClick={requestClose}
        className="ml-2 shrink-0"
        aria-label="Close dialog"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

// ============================================================================
// Content compound component
// ============================================================================

interface ContentProps {
  children: ReactNode;
  className?: string;
}

const Content: FC<ContentProps> = ({ children, className }) => {
  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
};

// ============================================================================
// Main Shell component
// ============================================================================

const PersistentDialogShellBase: FC<PersistentDialogShellProps> = ({
  dialogId,
  config,
  resetKey,
  closeConfirmation,
  fullWidth,
  className,
  children,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Track which resetKey we've mounted content for (lazy mounting)
  // null = never mounted, string = mounted for that key
  const mountedForKeyRef = useRef<string | null>(null);

  // Register with persistent dialogs context
  const dialogConfig = useMemo(
    () => ({
      id: dialogId,
      icon: config.icon,
      label: config.label,
      description: config.description,
      badgeCount: config.badgeCount,
    }),
    [
      dialogId,
      config.icon,
      config.label,
      config.description,
      config.badgeCount,
    ],
  );

  const { isVisible, hide } = usePersistentDialog(dialogConfig);

  // Lazy mounting logic:
  // - Content is only mounted when dialog becomes visible for the first time
  // - When resetKey changes, we unmount and wait for next visibility
  // - Content stays mounted when hidden (for state preservation)
  const currentKey = resetKey ?? "";

  // Determine if we should mount content BEFORE any state updates
  // This must be computed synchronously during render to avoid race conditions
  // where useEffect updates happen after render causes unmount
  let shouldMountContent: boolean;

  if (isVisible) {
    // Dialog is visible - always mount and remember this key
    shouldMountContent = true;
    if (mountedForKeyRef.current !== currentKey) {
      mountedForKeyRef.current = currentKey;
    }
  } else if (mountedForKeyRef.current === currentKey) {
    // Dialog hidden but we mounted for this key - keep mounted
    shouldMountContent = true;
  } else if (
    mountedForKeyRef.current !== null &&
    mountedForKeyRef.current !== currentKey
  ) {
    // Key changed while hidden - unmount (will remount when visible again)
    shouldMountContent = false;
    mountedForKeyRef.current = null;
  } else {
    // Never mounted for any key yet - don't mount until visible
    shouldMountContent = false;
  }

  // Request close - may show confirmation or close directly
  const requestClose = useCallback(() => {
    if (closeConfirmation?.shouldConfirm()) {
      setShowConfirmDialog(true);
    } else {
      hide();
    }
  }, [closeConfirmation, hide]);

  // Force close after confirmation
  const handleForceClose = useCallback(() => {
    setShowConfirmDialog(false);
    hide();
  }, [hide]);

  // Cancel confirmation
  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // Escape key handling
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isVisible, requestClose]);

  // Click outside handler
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        requestClose();
      }
    },
    [requestClose],
  );

  // Context value for compound components
  const contextValue = useMemo(() => ({ requestClose }), [requestClose]);

  return createPortal(
    <ShellContext.Provider value={contextValue}>
      {/* Main dialog container */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center",
          isVisible ? "visible" : "invisible pointer-events-none",
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Overlay/backdrop - Escape key handled via document.addEventListener above */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled globally via document event listener */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            isVisible ? "opacity-100" : "opacity-0",
          )}
          onClick={handleOverlayClick}
        />

        {/* Dialog content */}
        <div
          className={cn(
            "relative z-10 bg-background rounded-lg shadow-lg border",
            "w-[95vw] h-[90vh] overflow-hidden flex flex-col",
            !fullWidth && "max-w-7xl",
            "transition-all duration-200",
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
            className,
          )}
        >
          {/* Key wrapper for reset functionality - only mount when needed */}
          {shouldMountContent && (
            <div key={currentKey} className="flex flex-col h-full">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Close confirmation dialog */}
      {closeConfirmation && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{closeConfirmation.title}</DialogTitle>
              <DialogDescription>
                {closeConfirmation.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelConfirm}>
                {closeConfirmation.cancelLabel}
              </Button>
              <Button variant="destructive" onClick={handleForceClose}>
                {closeConfirmation.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ShellContext.Provider>,
    document.body,
  );
};

// ============================================================================
// Export with compound components attached
// ============================================================================

export const PersistentDialogShell = Object.assign(PersistentDialogShellBase, {
  Header,
  Content,
});

export type { PersistentDialogShellProps, CloseConfirmationConfig };

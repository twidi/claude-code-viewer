"use client";

import { Trans, useLingui } from "@lingui/react";
import { CheckIcon, ClockIcon } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PermissionMode } from "@/types/session-process";
import { usePendingPermissionMode } from "../../hooks/usePendingPermissionMode";
import { PermissionModeBadge } from "./PermissionModeBadge";

const PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "bypassPermissions",
  "plan",
];

export interface PermissionModeSelectorProps {
  sessionId: string;
  /** The current active mode (from process or config) */
  currentMode: PermissionMode;
  /** Session status */
  sessionStatus: "starting" | "pending" | "paused" | "running" | "none";
  /** Callback when user wants to interrupt running process */
  onInterruptAndChange?: (newMode: PermissionMode) => void;
}

export const PermissionModeSelector: FC<PermissionModeSelectorProps> = ({
  sessionId,
  currentMode,
  sessionStatus,
  onInterruptAndChange,
}) => {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const [runningConfirmDialogOpen, setRunningConfirmDialogOpen] =
    useState(false);
  const [pendingModeForConfirm, setPendingModeForConfirm] =
    useState<PermissionMode | null>(null);
  const { pendingMode, setPendingMode } = usePendingPermissionMode(sessionId);

  // Session is active if it's starting, pending, or running
  const isActiveSession =
    sessionStatus === "starting" ||
    sessionStatus === "pending" ||
    sessionStatus === "running";

  // Display mode: pending > current
  const displayMode = pendingMode ?? currentMode;
  const hasPendingChange = pendingMode !== null && pendingMode !== currentMode;

  const handleModeSelect = (mode: PermissionMode) => {
    if (mode === displayMode) {
      setOpen(false);
      return;
    }

    // If selecting the original mode, clear the pending change
    if (mode === currentMode) {
      setPendingMode(null);
      toast.success(i18n._({ id: "permission.mode.change.cancelled" }));
      setOpen(false);
      return;
    }

    // If session is active, show confirmation dialog
    if (isActiveSession) {
      setPendingModeForConfirm(mode);
      setRunningConfirmDialogOpen(true);
      setOpen(false);
      return;
    }

    // Normal case: set pending mode
    setPendingMode(mode);
    toast.success(i18n._({ id: "permission.mode.change.pending" }));
    setOpen(false);
  };

  const handleInterruptNow = () => {
    if (pendingModeForConfirm && onInterruptAndChange) {
      onInterruptAndChange(pendingModeForConfirm);
    }
    setRunningConfirmDialogOpen(false);
    setPendingModeForConfirm(null);
  };

  const handleApplyLater = () => {
    if (pendingModeForConfirm) {
      setPendingMode(pendingModeForConfirm);
      toast.success(i18n._({ id: "permission.mode.change.pending" }));
    }
    setRunningConfirmDialogOpen(false);
    setPendingModeForConfirm(null);
  };

  const badge = (
    <div className="relative cursor-pointer">
      <PermissionModeBadge permissionMode={displayMode} />
      {hasPendingChange && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
          <ClockIcon className="w-2 h-2 text-white" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{badge}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {hasPendingChange ? (
              <Trans id="permission.mode.change.pending.tooltip" />
            ) : (
              <Trans id="permission.mode.change.tooltip" />
            )}
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-80 p-2">
          <div className="space-y-1">
            <div className="px-2 py-1.5 text-sm font-medium">
              <Trans id="permission.mode.select.title" />
            </div>
            {hasPendingChange && (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                <Trans id="permission.mode.change.pending.hint" />
              </div>
            )}
            {PERMISSION_MODES.map((mode) => {
              const isCurrentMode = mode === currentMode && !hasPendingChange;
              const isPendingMode = mode === pendingMode;

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeSelect(mode)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2">
                    <PermissionModeBadge permissionMode={mode} />
                  </div>
                  {isCurrentMode && (
                    <CheckIcon className="w-4 h-4 text-primary" />
                  )}
                  {isPendingMode && (
                    <ClockIcon className="w-4 h-4 text-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={runningConfirmDialogOpen}
        onOpenChange={setRunningConfirmDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Trans id="permission.mode.running.dialog.title" />
            </DialogTitle>
            <DialogDescription>
              <Trans id="permission.mode.running.dialog.description" />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleApplyLater}>
              <Trans id="permission.mode.running.dialog.apply_later" />
            </Button>
            <Button variant="destructive" onClick={handleInterruptNow}>
              <Trans id="permission.mode.running.dialog.interrupt_now" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

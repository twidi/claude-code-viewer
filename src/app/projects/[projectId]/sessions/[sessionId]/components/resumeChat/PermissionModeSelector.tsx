"use client";

import { Trans, useLingui } from "@lingui/react";
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
import type { PermissionMode } from "@/types/session-process";
import { usePendingPermissionMode } from "../../hooks/usePendingPermissionMode";
import { PermissionModePopover } from "./PermissionModePopover";

export interface PermissionModeSelectorProps {
  sessionId: string;
  /** The current active mode (from process or config) */
  currentMode: PermissionMode;
  /** Session status */
  sessionStatus: "paused" | "running" | "none";
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

  const isRunning = sessionStatus === "running";

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

    // If running, show confirmation dialog
    if (isRunning) {
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

  const tooltipContent = hasPendingChange ? (
    <Trans id="permission.mode.change.pending.tooltip" />
  ) : (
    <Trans id="permission.mode.change.tooltip" />
  );

  const hintText = hasPendingChange ? (
    <Trans id="permission.mode.change.pending.hint" />
  ) : undefined;

  return (
    <>
      <PermissionModePopover
        displayMode={displayMode}
        currentMode={currentMode}
        pendingMode={pendingMode}
        open={open}
        onOpenChange={setOpen}
        onModeSelect={handleModeSelect}
        tooltipContent={tooltipContent}
        hintText={hintText}
      />

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

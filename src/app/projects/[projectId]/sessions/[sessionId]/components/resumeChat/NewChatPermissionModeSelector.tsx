"use client";

import { Trans } from "@lingui/react";
import type { FC } from "react";
import { useState } from "react";
import type { PermissionMode } from "@/types/session-process";
import { PermissionModePopover } from "./PermissionModePopover";

export interface NewChatPermissionModeSelectorProps {
  /** The current selected mode */
  currentMode: PermissionMode;
  /** Callback when mode changes */
  onChange: (mode: PermissionMode) => void;
}

export const NewChatPermissionModeSelector: FC<
  NewChatPermissionModeSelectorProps
> = ({ currentMode, onChange }) => {
  const [open, setOpen] = useState(false);

  const handleModeSelect = (mode: PermissionMode) => {
    if (mode !== currentMode) {
      onChange(mode);
    }
    setOpen(false);
  };

  return (
    <PermissionModePopover
      displayMode={currentMode}
      currentMode={currentMode}
      pendingMode={null}
      open={open}
      onOpenChange={setOpen}
      onModeSelect={handleModeSelect}
      tooltipContent={<Trans id="permission.mode.change.tooltip" />}
    />
  );
};

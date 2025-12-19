"use client";

import { Trans } from "@lingui/react";
import { CheckIcon, ClockIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
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
import { PermissionModeBadge } from "./PermissionModeBadge";

const PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "bypassPermissions",
  "plan",
];

export interface PermissionModePopoverProps {
  /** The mode to display on the badge */
  displayMode: PermissionMode;
  /** The current active mode (to show checkmark) */
  currentMode: PermissionMode;
  /** Optional pending mode (to show clock icon) */
  pendingMode?: PermissionMode | null;
  /** Whether the popover is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a mode is selected */
  onModeSelect: (mode: PermissionMode) => void;
  /** Tooltip content */
  tooltipContent: ReactNode;
  /** Optional hint text shown below title */
  hintText?: ReactNode;
}

export const PermissionModePopover: FC<PermissionModePopoverProps> = ({
  displayMode,
  currentMode,
  pendingMode,
  open,
  onOpenChange,
  onModeSelect,
  tooltipContent,
  hintText,
}) => {
  const hasPendingChange = pendingMode != null && pendingMode !== currentMode;

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
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{badge}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 p-2">
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-sm font-medium">
            <Trans id="permission.mode.select.title" />
          </div>
          {hintText && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {hintText}
            </div>
          )}
          {PERMISSION_MODES.map((mode) => {
            const isCurrentMode = mode === currentMode && !hasPendingChange;
            const isPendingMode = mode === pendingMode;

            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeSelect(mode)}
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
  );
};

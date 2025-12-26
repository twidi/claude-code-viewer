import { Trans } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import {
  CoinsIcon,
  FolderIcon,
  MessageSquareIcon,
  PencilIcon,
} from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { SupportedLocale } from "@/lib/i18n/schema";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "../../../../../../../lib/date/formatLocaleDate";
import { firstUserMessageToTitle } from "../../../../services/firstCommandToTitle";
import type { Tab } from "./schema";

interface SessionData {
  id: string;
  lastModifiedAt: Date | string;
  meta: {
    firstUserMessage: Parameters<typeof firstUserMessageToTitle>[0] | null;
    messageCount: number;
    cost: {
      totalUsd: number;
    };
  };
}

export const SessionListItem: FC<{
  session: SessionData;
  projectId: string;
  projectName?: string | null;
  currentTab: Tab;
  isActive: boolean;
  isRunning: boolean;
  isPaused: boolean;
  locale: SupportedLocale;
  customName?: string | null;
  onRename?: (newName: string) => void;
}> = ({
  session,
  projectId,
  projectName,
  currentTab,
  isActive,
  isRunning,
  isPaused,
  locale,
  customName,
  onRename,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const autoTitle =
    session.meta.firstUserMessage !== null
      ? firstUserMessageToTitle(session.meta.firstUserMessage)
      : session.id;

  const displayTitle = customName ?? autoTitle;

  const startEditing = useCallback(() => {
    if (!onRename) return;
    setEditValue(displayTitle);
    setIsEditing(true);
  }, [onRename, displayTitle]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
  }, []);

  const saveEditing = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== displayTitle && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
    setEditValue("");
  }, [editValue, displayTitle, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    },
    [saveEditing, cancelEditing],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startEditing();
    },
    [startEditing],
  );

  const handlePencilClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startEditing();
    },
    [startEditing],
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div
        className={cn(
          "block rounded-lg p-2.5 border border-blue-400 dark:border-blue-600 bg-sidebar/30",
        )}
      >
        <div className="space-y-1.5">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEditing}
            className="h-7 text-sm"
            maxLength={200}
          />
          {projectName !== undefined && (
            <div className="flex items-center gap-1 text-xs text-sidebar-foreground/60">
              <FolderIcon className="w-3 h-3" />
              <span className="truncate">{projectName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-sidebar-foreground/70">
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="w-3 h-3" />
                <span>{session.meta.messageCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <CoinsIcon className="w-3 h-3" />
                <span>${session.meta.cost.totalUsd.toFixed(2)}</span>
              </div>
            </div>
            {session.lastModifiedAt && (
              <span className="text-xs text-sidebar-foreground/60">
                {formatLocaleDate(session.lastModifiedAt, {
                  locale,
                  target: "time",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/projects/$projectId/session"
      params={{ projectId }}
      search={{ tab: currentTab, sessionId: session.id }}
      className={cn(
        "group block rounded-lg p-2.5 transition-all duration-200 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:border-blue-300/60 dark:hover:border-blue-700/60 hover:shadow-sm border border-sidebar-border/40 bg-sidebar/30",
        isActive &&
          "bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 shadow-md ring-1 ring-blue-200/50 dark:ring-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600",
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-medium line-clamp-2 leading-tight text-sidebar-foreground flex-1"
            onDoubleClick={onRename ? handleDoubleClick : undefined}
          >
            {displayTitle}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {onRename && (
              <button
                type="button"
                onClick={handlePencilClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-sidebar-accent"
                title="Rename session"
              >
                <PencilIcon className="w-3.5 h-3.5 text-sidebar-foreground/60" />
              </button>
            )}
            {(isRunning || isPaused) && (
              <Badge
                variant={isRunning ? "default" : "secondary"}
                className={cn(
                  "text-xs",
                  isRunning && "bg-green-500 text-white",
                  isPaused && "bg-yellow-500 text-white",
                )}
              >
                {isRunning ? (
                  <Trans id="session.status.running" />
                ) : (
                  <Trans id="session.status.paused" />
                )}
              </Badge>
            )}
          </div>
        </div>
        {projectName !== undefined && (
          <div className="flex items-center gap-1 text-xs text-sidebar-foreground/60">
            <FolderIcon className="w-3 h-3" />
            <span className="truncate">{projectName}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-sidebar-foreground/70">
            <div className="flex items-center gap-1">
              <MessageSquareIcon className="w-3 h-3" />
              <span>{session.meta.messageCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <CoinsIcon className="w-3 h-3" />
              <span>${session.meta.cost.totalUsd.toFixed(2)}</span>
            </div>
          </div>
          {session.lastModifiedAt && (
            <span className="text-xs text-sidebar-foreground/60">
              {formatLocaleDate(session.lastModifiedAt, {
                locale,
                target: "time",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

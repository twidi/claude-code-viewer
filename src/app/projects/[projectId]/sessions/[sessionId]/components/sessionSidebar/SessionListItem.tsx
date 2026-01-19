import { Trans } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import {
  CoinsIcon,
  FolderIcon,
  MessageSquareIcon,
  StarIcon,
} from "lucide-react";
import type { FC, MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import type { SupportedLocale } from "@/lib/i18n/schema";
import { cn } from "@/lib/utils";
import type { SessionProcessStatus } from "@/types/session-process";
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

const getStatusColorClass = (status: SessionProcessStatus): string => {
  switch (status) {
    case "starting":
    case "pending":
      return "bg-blue-500 text-white";
    case "running":
      return "bg-green-500 text-white";
    case "paused":
      return "bg-yellow-500 text-white";
  }
};

const StatusLabel: FC<{ status: SessionProcessStatus }> = ({ status }) => {
  switch (status) {
    case "starting":
      return <Trans id="session.status.starting" />;
    case "pending":
      return <Trans id="session.status.pending" />;
    case "running":
      return <Trans id="session.status.running" />;
    case "paused":
      return <Trans id="session.status.paused" />;
  }
};

export const SessionListItem: FC<{
  session: SessionData;
  projectId: string;
  projectName?: string | null;
  currentTab: Tab;
  isActive: boolean;
  status: SessionProcessStatus | undefined;
  locale: SupportedLocale;
  isStarred: boolean;
  onToggleStar: (sessionId: string) => void;
}> = ({
  session,
  projectId,
  projectName,
  currentTab,
  isActive,
  status,
  locale,
  isStarred,
  onToggleStar,
}) => {
  const title =
    session.meta.firstUserMessage !== null
      ? firstUserMessageToTitle(session.meta.firstUserMessage)
      : session.id;

  const handleStarClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar(session.id);
  };

  return (
    <Link
      to="/projects/$projectId/session"
      params={{ projectId }}
      search={{ tab: currentTab, sessionId: session.id }}
      className={cn(
        "block rounded-lg p-2.5 transition-all duration-200 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:border-blue-300/60 dark:hover:border-blue-700/60 hover:shadow-sm border border-sidebar-border/40 bg-sidebar/30",
        isActive &&
          "bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 shadow-md ring-1 ring-blue-200/50 dark:ring-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600",
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={handleStarClick}
              className={cn(
                "flex-shrink-0 mt-0.5 transition-colors hover:text-yellow-500",
                isStarred && "text-yellow-500",
              )}
              aria-label={isStarred ? "Unstar session" : "Star session"}
            >
              <StarIcon
                className={cn("w-3.5 h-3.5", isStarred && "fill-current")}
              />
            </button>
            <h3 className="text-sm font-medium line-clamp-2 leading-tight text-sidebar-foreground">
              {title}
            </h3>
          </div>
          {status !== undefined && (
            <Badge
              variant="default"
              className={cn(
                "text-xs flex-shrink-0",
                getStatusColorClass(status),
              )}
            >
              <StatusLabel status={status} />
            </Badge>
          )}
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

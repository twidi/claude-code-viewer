import { Trans } from "@lingui/react";
import { Link, useSearch } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { PlusIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
  useStarredSessionsSet,
  useToggleStarredSession,
} from "@/hooks/useStarredSessions";
import { sortSessionsByStatusAndDate } from "@/lib/session-sorting";
import { cn } from "@/lib/utils";
import { useConfig } from "../../../../../../hooks/useConfig";
import { useProject } from "../../../../hooks/useProject";
import { sessionProcessesAtom } from "../../store/sessionProcessesAtom";
import { SessionListItem } from "./SessionListItem";

export const SessionsTab: FC<{
  currentSessionId: string;
  projectId: string;
  isMobile?: boolean;
}> = ({ currentSessionId, projectId }) => {
  const {
    data: projectData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProject(projectId);
  const sessions = projectData.pages.flatMap((page) => page.sessions);

  const sessionProcesses = useAtomValue(sessionProcessesAtom);
  const { config } = useConfig();
  const search = useSearch({
    from: "/projects/$projectId/session",
  });
  const starredSessionIds = useStarredSessionsSet();
  const toggleStar = useToggleStarredSession();

  // Preserve current tab state or default to "sessions"
  const currentTab = search.tab ?? "sessions";

  const isNewChatActive = currentSessionId === "";

  const sortedSessions = sortSessionsByStatusAndDate(
    sessions,
    sessionProcesses,
    starredSessionIds,
  );

  const handleToggleStar = (sessionId: string) => {
    toggleStar.mutate(sessionId);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg">
            <Trans id="sessions.title" />
          </h2>
        </div>
        <p className="text-xs text-sidebar-foreground/70">
          {sessions.length} <Trans id="sessions.total" />
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          to="/projects/$projectId/session"
          params={{ projectId }}
          search={{ tab: currentTab }}
          className={cn(
            "block rounded-lg p-2.5 transition-all duration-200 border-2 border-dashed border-sidebar-border/60 hover:border-blue-400/80 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 bg-sidebar/10",
            isNewChatActive &&
              "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 shadow-sm",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PlusIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-sidebar-foreground">
                <Trans id="chat.modal.title" />
              </p>
            </div>
          </div>
        </Link>
        {sortedSessions.map((session) => {
          const sessionProcess = sessionProcesses.find(
            (task) => task.sessionId === session.id,
          );

          return (
            <SessionListItem
              key={session.id}
              session={session}
              projectId={projectId}
              currentTab={currentTab}
              isActive={session.id === currentSessionId}
              status={sessionProcess?.status}
              locale={config.locale}
              isStarred={starredSessionIds.has(session.id)}
              onToggleStar={handleToggleStar}
            />
          );
        })}

        {/* Load More Button */}
        {hasNextPage && fetchNextPage && (
          <div className="p-2">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isFetchingNextPage ? (
                <Trans id="common.loading" />
              ) : (
                <Trans id="sessions.load.more" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

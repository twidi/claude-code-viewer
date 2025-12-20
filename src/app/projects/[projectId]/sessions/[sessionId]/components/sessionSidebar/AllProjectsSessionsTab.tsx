import { Trans } from "@lingui/react";
import { useSearch } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { useConfig } from "../../../../../../hooks/useConfig";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { sessionProcessesAtom } from "../../store/sessionProcessesAtom";
import { SessionListItem } from "./SessionListItem";
import { sortSessionsByStatusAndDate } from "./sortSessions";

export const AllProjectsSessionsTab: FC<{
  currentSessionId: string;
}> = ({ currentSessionId }) => {
  const {
    data: sessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentSessions();

  const sessions = sessionsData.pages.flatMap((page) => page.sessions);
  const sessionProcesses = useAtomValue(sessionProcessesAtom);
  const { config } = useConfig();
  const search = useSearch({
    from: "/projects/$projectId/session",
  });

  // Preserve current tab state
  const currentTab = search.tab ?? "all-sessions";

  const sortedSessions = sortSessionsByStatusAndDate(
    sessions,
    sessionProcesses,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg">
            <Trans id="sessions.all_projects.title" />
          </h2>
        </div>
        <p className="text-xs text-sidebar-foreground/70">
          {sessions.length} <Trans id="sessions.total" />
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sortedSessions.map((session) => {
          const sessionProcess = sessionProcesses.find(
            (task) => task.sessionId === session.id,
          );

          return (
            <SessionListItem
              key={session.id}
              session={session}
              projectId={session.projectId}
              projectName={session.projectName}
              currentTab={currentTab}
              isActive={session.id === currentSessionId}
              isRunning={sessionProcess?.status === "running"}
              isPaused={sessionProcess?.status === "paused"}
              locale={config.locale}
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

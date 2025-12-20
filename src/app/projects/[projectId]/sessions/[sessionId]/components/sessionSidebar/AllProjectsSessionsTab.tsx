import { Trans } from "@lingui/react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { PlusIcon } from "lucide-react";
import { type FC, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfig } from "../../../../../../hooks/useConfig";
import { useProjects } from "../../../../../hooks/useProjects";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { sessionProcessesAtom } from "../../store/sessionProcessesAtom";
import { SessionListItem } from "./SessionListItem";
import { sortSessionsByStatusAndDate } from "./sortSessions";

const ProjectSelector: FC<{
  onSelectProject: (projectId: string) => void;
}> = ({ onSelectProject }) => {
  const { data } = useProjects();
  const [selectedValue, setSelectedValue] = useState<string>("");

  const handleValueChange = (value: string) => {
    onSelectProject(value);
    // Reset after a short delay to allow re-selection of the same project
    setTimeout(() => setSelectedValue(""), 100);
  };

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger
        className={cn(
          "w-full border-2 border-dashed border-sidebar-border/60 hover:border-blue-400/80 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 bg-sidebar/10",
          "h-auto p-2.5",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <PlusIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-sidebar-foreground">
              <Trans id="chat.modal.title" />
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              <SelectValue
                placeholder={<Trans id="sessions.select_project" />}
              />
            </p>
          </div>
        </div>
      </SelectTrigger>
      <SelectContent>
        {data.projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.meta.projectName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ProjectSelectorFallback: FC = () => (
  <div
    className={cn(
      "w-full border-2 border-dashed border-sidebar-border/60 bg-sidebar/10 rounded-md",
      "p-2.5 opacity-50",
    )}
  >
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <PlusIcon className="w-4 h-4" />
      </div>
      <div className="text-left">
        <p className="text-sm font-semibold text-sidebar-foreground">
          <Trans id="chat.modal.title" />
        </p>
        <p className="text-xs text-sidebar-foreground/70">
          <Trans id="common.loading" />
        </p>
      </div>
    </div>
  </div>
);

export const AllProjectsSessionsTab: FC<{
  currentSessionId?: string;
}> = ({ currentSessionId }) => {
  const {
    data: sessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentSessions();

  const navigate = useNavigate();
  const sessions = sessionsData.pages.flatMap((page) => page.sessions);
  const sessionProcesses = useAtomValue(sessionProcessesAtom);
  const { config } = useConfig();

  // Default tab for navigation
  const currentTab = "all-sessions";

  const sortedSessions = sortSessionsByStatusAndDate(
    sessions,
    sessionProcesses,
  );

  const handleSelectProject = (projectId: string) => {
    navigate({
      to: "/projects/$projectId/session",
      params: { projectId },
      search: { tab: currentTab },
    });
  };

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
        <Suspense fallback={<ProjectSelectorFallback />}>
          <ProjectSelector onSelectProject={handleSelectProject} />
        </Suspense>

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

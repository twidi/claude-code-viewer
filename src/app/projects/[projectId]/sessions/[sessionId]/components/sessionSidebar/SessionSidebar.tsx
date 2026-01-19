import { Trans } from "@lingui/react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  LayersIcon,
  MessageSquareIcon,
  PlugIcon,
} from "lucide-react";
import { type FC, Suspense, useCallback, useMemo } from "react";
import type { SidebarTab } from "@/components/GlobalSidebar";
import { GlobalSidebar } from "@/components/GlobalSidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Loading } from "../../../../../../../components/Loading";
import { AllProjectsSessionsTab } from "./AllProjectsSessionsTab";
import { McpTab } from "./McpTab";
import { MobileSidebar } from "./MobileSidebar";
import { SchedulerTab } from "./SchedulerTab";
import { SessionsTab } from "./SessionsTab";
import { type Tab, tabSchema } from "./schema";

export const SessionSidebar: FC<{
  currentSessionId?: string;
  projectId: string;
  projectName: string;
  className?: string;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  initialTab: Tab;
}> = ({
  currentSessionId,
  projectId,
  projectName,
  className,
  isMobileOpen = false,
  onMobileOpenChange,
  initialTab,
}) => {
  const activeSessionId = currentSessionId ?? "";
  const navigate = useNavigate();
  const search = useSearch({
    from: "/projects/$projectId/session",
  });

  const handleTabChange = useCallback(
    (tabId: string) => {
      const parsed = tabSchema.safeParse(tabId);
      if (!parsed.success) return;

      navigate({
        to: "/projects/$projectId/session",
        params: { projectId },
        search: { ...search, tab: parsed.data },
        replace: true,
      });
    },
    [navigate, projectId, search],
  );

  const additionalTabs: SidebarTab[] = useMemo(
    () => [
      {
        id: "sessions",
        icon: MessageSquareIcon,
        title: <Trans id="sidebar.show.session.list" />,
        content: (
          <Suspense fallback={<Loading />}>
            <SessionsTab
              currentSessionId={activeSessionId}
              projectId={projectId}
            />
          </Suspense>
        ),
      },
      {
        id: "all-sessions",
        icon: LayersIcon,
        title: <Trans id="sidebar.show.all.projects.session.list" />,
        content: (
          <Suspense fallback={<Loading />}>
            <AllProjectsSessionsTab currentSessionId={activeSessionId} />
          </Suspense>
        ),
      },
      {
        id: "mcp",
        icon: PlugIcon,
        title: <Trans id="sidebar.show.mcp.settings" />,
        content: <McpTab projectId={projectId} />,
      },
      {
        id: "scheduler",
        icon: CalendarClockIcon,
        title: <Trans id="sidebar.show.scheduler.jobs" />,
        content: (
          <SchedulerTab
            projectId={projectId}
            sessionId={activeSessionId}
            projectName={projectName}
          />
        ),
      },
    ],
    [activeSessionId, projectId, projectName],
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className={cn("hidden md:flex h-full", className)}>
        <GlobalSidebar
          projectId={projectId}
          additionalTabs={additionalTabs}
          defaultActiveTab={initialTab}
          onTabChange={handleTabChange}
          headerButton={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/projects"
                    className="w-12 h-12 flex items-center justify-center hover:bg-sidebar-accent transition-colors"
                  >
                    <ArrowLeftIcon className="w-4 h-4 text-sidebar-foreground/70" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>
                    <Trans id="sidebar.back.to.projects" />
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar
        currentSessionId={activeSessionId}
        projectId={projectId}
        projectName={projectName}
        isOpen={isMobileOpen}
        onClose={() => onMobileOpenChange?.(false)}
        initialTab={initialTab}
        onTabChange={handleTabChange}
      />
    </>
  );
};

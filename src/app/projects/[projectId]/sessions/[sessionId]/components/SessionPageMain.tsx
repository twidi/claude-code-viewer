import { Trans } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  BotIcon,
  BrainIcon,
  DownloadIcon,
  GitBranchIcon,
  InfoIcon,
  LoaderIcon,
  MenuIcon,
  MessageSquareIcon,
  PauseIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useConfig } from "@/app/hooks/useConfig";

/**
 * Formats a model name to a short display version.
 * Removes "claude-" prefix and strips version suffix (e.g., "-4-5-20251101").
 * Example: "claude-opus-4-5-20251101" -> "opus"
 */
function formatShortModelName(modelName: string): string {
  return modelName
    .replace(/^claude-/, "") // Remove "claude-" prefix
    .replace(/-\d.*$/, ""); // Remove "-" followed by digit and everything after
}

import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PermissionDialog } from "@/components/PermissionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { usePermissionRequests } from "@/hooks/usePermissionRequests";
import { useSchedulerJobs } from "@/hooks/useScheduler";
import {
  useStarredSessionsSet,
  useToggleStarredSession,
} from "@/hooks/useStarredSessions";
import { honoClient } from "@/lib/api/client";
import { sessionDetailQuery, sessionProcessesQuery } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import type { PermissionMode } from "@/types/session-process";
import { firstUserMessageToTitle } from "../../../services/firstCommandToTitle";
import { useExportSession } from "../hooks/useExportSession";
import type { useGitCurrentRevisions } from "../hooks/useGit";
import { useInterruptAndChangePermissionMutation } from "../hooks/useInterruptAndChangePermissionMutation";
import { useSession } from "../hooks/useSession";
import { useSessionProcess } from "../hooks/useSessionProcess";
import { ConversationList } from "./conversationList/ConversationList";
import { ChatActionMenu } from "./resumeChat/ChatActionMenu";
import { ContinueChat } from "./resumeChat/ContinueChat";
import { PermissionModeSelector } from "./resumeChat/PermissionModeSelector";
import { ResumeChat } from "./resumeChat/ResumeChat";
import { StartNewChat } from "./resumeChat/StartNewChat";
import { SessionIdDropdown } from "./SessionIdDropdown";

type SessionPageMainProps = {
  projectId: string;
  sessionId?: string;
  setIsMobileSidebarOpen: (open: boolean) => void;
  projectPath?: string;
  currentBranch?: string;
  revisionsData?: ReturnType<typeof useGitCurrentRevisions>["data"];
  projectName: string;
};

type SessionData = ReturnType<typeof useSession>;

export const SessionPageMain: FC<SessionPageMainProps> = (props) => {
  if (!props.sessionId) {
    return <SessionPageMainContent {...props} sessionData={null} />;
  }

  return <SessionPageMainWithData {...props} sessionId={props.sessionId} />;
};

const SessionPageMainWithData: FC<
  SessionPageMainProps & { sessionId: string }
> = (props) => {
  const sessionData = useSession(props.projectId, props.sessionId);
  return (
    <SessionPageMainContent
      {...props}
      sessionId={props.sessionId}
      sessionData={sessionData}
    />
  );
};

const SessionPageMainContent: FC<
  SessionPageMainProps & {
    sessionId?: string;
    sessionData: SessionData | null;
  }
> = ({
  projectId,
  sessionId,
  setIsMobileSidebarOpen,
  projectPath,
  currentBranch,
  revisionsData: _revisionsData,
  projectName,
  sessionData,
}) => {
  const conversations = sessionData?.conversations ?? [];
  const emptyToolResult: SessionData["getToolResult"] = () => undefined;
  const getToolResult = sessionData?.getToolResult ?? emptyToolResult;
  const isExistingSession =
    Boolean(sessionId) && sessionData !== null && sessionData !== undefined;
  const { currentPermissionRequest, isDialogOpen, onPermissionResponse } =
    usePermissionRequests();
  const exportSession = useExportSession();
  const { data: allSchedulerJobs } = useSchedulerJobs();
  const search = useSearch({
    from: "/projects/$projectId/session",
  });
  const isAllSessionsTab = search.tab === "all-sessions";
  const starredSessionIds = useStarredSessionsSet();
  const toggleStar = useToggleStarredSession();
  const isStarred = sessionId ? starredSessionIds.has(sessionId) : false;
  const { isFlagEnabled } = useFeatureFlags();
  const isToolApprovalAvailable = isFlagEnabled("tool-approval");
  const { config } = useConfig();

  const handleToggleStar = () => {
    if (sessionId) {
      toggleStar.mutate(sessionId);
    }
  };

  const sessionProcess = useSessionProcess();
  const relatedSessionProcess = useMemo(() => {
    if (!sessionId) return undefined;
    return sessionProcess.getSessionProcess(sessionId);
  }, [sessionProcess, sessionId]);

  // Use session process permission mode if available, otherwise fall back to global config
  const permissionMode =
    relatedSessionProcess?.permissionMode ??
    config?.permissionMode ??
    "default";

  // Filter scheduler jobs related to this session
  const sessionScheduledJobs = useMemo(() => {
    if (!sessionId || !allSchedulerJobs) return [];
    return allSchedulerJobs.filter((job) => {
      // Only show jobs that haven't been executed yet
      if (job.lastRunStatus !== null) return false;

      // Reserved jobs: match by baseSessionId
      if (job.schedule.type === "reserved") {
        return (
          job.message.baseSessionId === sessionId &&
          job.message.projectId === projectId
        );
      }

      // Queued jobs: match by targetSessionId
      if (job.schedule.type === "queued") {
        return (
          job.schedule.targetSessionId === sessionId &&
          job.message.projectId === projectId
        );
      }

      return false;
    });
  }, [allSchedulerJobs, sessionId, projectId]);

  const [previousConversationLength, setPreviousConversationLength] =
    useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Track if user is near bottom - initialized to true so first messages auto-scroll
  const isNearBottomRef = useRef(true);
  const queryClient = useQueryClient();

  const abortTask = useMutation({
    mutationFn: async (sessionProcessId: string) => {
      const response = await honoClient.api.cc["session-processes"][
        ":sessionProcessId"
      ].abort.$post({
        param: { sessionProcessId },
        json: { projectId },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
  });

  const interruptAndChangePermission =
    useInterruptAndChangePermissionMutation(projectId);

  const handleInterruptAndChangePermission = useCallback(
    (newMode: PermissionMode) => {
      if (!relatedSessionProcess || !sessionId) return;
      interruptAndChangePermission.mutate({
        sessionProcessId: relatedSessionProcess.id,
        sessionId,
        newPermissionMode: newMode,
      });
    },
    [relatedSessionProcess, sessionId, interruptAndChangePermission],
  );

  // Track scroll position to update isNearBottomRef
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const distanceFromBottom =
        scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 150;
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isExistingSession) return;
    if (conversations.length === previousConversationLength) return;

    setPreviousConversationLength(conversations.length);

    // Only auto-scroll if user is near the bottom
    if (isNearBottomRef.current) {
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [conversations, isExistingSession, previousConversationLength]);

  const handleScrollToTop = () => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleForceReload = useCallback(async () => {
    if (!sessionId) return;
    setIsReloading(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sessionDetailQuery(projectId, sessionId).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: sessionProcessesQuery.queryKey,
        }),
      ]);
    } finally {
      setIsReloading(false);
    }
  }, [queryClient, projectId, sessionId]);

  let headerTitle: ReactNode = projectName ?? projectId;
  if (!isExistingSession) {
    headerTitle = <Trans id="chat.modal.title" />;
  } else if (sessionData && sessionId) {
    headerTitle =
      sessionData.session.meta.firstUserMessage !== null
        ? firstUserMessageToTitle(sessionData.session.meta.firstUserMessage)
        : sessionId;
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="px-2 sm:px-3 py-2 sm:py-3 sticky top-0 z-10 bg-background w-full flex-shrink-0 min-w-0 border-b space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden flex-shrink-0"
              onClick={() => setIsMobileSidebarOpen(true)}
              data-testid="mobile-sidebar-toggle-button"
            >
              <MenuIcon className="w-4 h-4" />
            </Button>
            {isExistingSession && (
              <button
                type="button"
                onClick={handleToggleStar}
                className={cn(
                  "flex-shrink-0 transition-colors hover:text-yellow-500",
                  isStarred && "text-yellow-500",
                )}
                aria-label={isStarred ? "Unstar session" : "Star session"}
              >
                <StarIcon
                  className={cn(
                    "w-5 h-5 sm:w-6 sm:h-6",
                    isStarred && "fill-current",
                  )}
                />
              </button>
            )}
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold break-all overflow-ellipsis line-clamp-1 min-w-0">
              {headerTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-1 flex-wrap">
              {projectPath && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {isAllSessionsTab ? (
                      <Link
                        to="/projects/$projectId/session"
                        params={{ projectId }}
                        search={{ tab: "sessions", sessionId }}
                      >
                        <Badge
                          variant="secondary"
                          className="h-6 text-xs flex items-center max-w-full cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <span className="truncate">
                            {projectPath.split("/").pop()}
                          </span>
                        </Badge>
                      </Link>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="h-6 text-xs flex items-center max-w-full cursor-help"
                      >
                        <span className="truncate">
                          {projectPath.split("/").pop()}
                        </span>
                      </Badge>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAllSessionsTab ? (
                      <>
                        <Trans id="sessions.switch_to_project" />
                        <br />
                        <span className="text-muted-foreground">
                          {projectPath}
                        </span>
                      </>
                    ) : (
                      projectPath
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              {currentBranch && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="h-6 text-xs flex items-center gap-1 max-w-full cursor-help"
                    >
                      <GitBranchIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{currentBranch}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <Trans id="control.branch" />
                  </TooltipContent>
                </Tooltip>
              )}
              {isExistingSession && sessionId && sessionData && (
                <SessionIdDropdown
                  sessionId={sessionId}
                  jsonlFilePath={sessionData.session.jsonlFilePath}
                  runningPermissionMode={relatedSessionProcess?.permissionMode}
                />
              )}
              {isExistingSession &&
                sessionData?.session.meta.currentContextUsage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={`h-6 text-xs flex items-center gap-1 max-w-full cursor-help ${
                          sessionData.session.meta.currentContextUsage
                            .percentage >= 70
                            ? "bg-red-500/10 text-red-900 dark:text-red-200 border-red-500/20"
                            : sessionData.session.meta.currentContextUsage
                                  .percentage >= 50
                              ? "bg-orange-500/10 text-orange-900 dark:text-orange-200 border-orange-500/20"
                              : ""
                        }`}
                      >
                        <BrainIcon className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {sessionData.session.meta.currentContextUsage.percentage.toFixed(
                            0,
                          )}
                          %
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Trans id="session.context.tooltip" />:{" "}
                      {sessionData.session.meta.currentContextUsage.tokens.toLocaleString()}{" "}
                      /{" "}
                      {sessionData.session.meta.currentContextUsage.maxTokens.toLocaleString()}{" "}
                      tokens
                    </TooltipContent>
                  </Tooltip>
                )}
              {isExistingSession && sessionData?.session.meta.modelName && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="h-6 text-xs flex items-center gap-1 max-w-full cursor-help"
                    >
                      <BotIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {formatShortModelName(
                          sessionData.session.meta.modelName,
                        )}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {sessionData.session.meta.modelName}
                  </TooltipContent>
                </Tooltip>
              )}
              {isToolApprovalAvailable && isExistingSession && sessionId && (
                <PermissionModeSelector
                  sessionId={sessionId}
                  currentMode={permissionMode}
                  sessionStatus={relatedSessionProcess?.status ?? "none"}
                  onInterruptAndChange={handleInterruptAndChangePermission}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {relatedSessionProcess?.status === "starting" && (
                <Badge
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-900 dark:text-blue-200 border-blue-500/20 flex-shrink-0 h-6 text-xs"
                >
                  <LoaderIcon className="w-3 h-3 mr-1 animate-spin" />
                  <Trans id="session.conversation.starting" />
                </Badge>
              )}
              {relatedSessionProcess?.status === "pending" && (
                <Badge
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-900 dark:text-blue-200 border-blue-500/20 flex-shrink-0 h-6 text-xs"
                >
                  <LoaderIcon className="w-3 h-3 mr-1 animate-spin" />
                  <Trans id="session.conversation.pending" />
                </Badge>
              )}
              {relatedSessionProcess?.status === "running" && (
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-900 dark:text-green-200 border-green-500/20 flex-shrink-0 h-6 text-xs"
                >
                  <LoaderIcon className="w-3 h-3 mr-1 animate-spin" />
                  <Trans id="session.conversation.running" />
                </Badge>
              )}
              {relatedSessionProcess?.status === "paused" && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-500/10 text-yellow-900 dark:text-yellow-200 border-yellow-500/20 flex-shrink-0 h-6 text-xs"
                >
                  <PauseIcon className="w-3 h-3 mr-1" />
                  <Trans id="session.conversation.paused" />
                </Badge>
              )}
              {relatedSessionProcess &&
                (relatedSessionProcess.status === "running" ||
                  relatedSessionProcess.status === "paused") && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          abortTask.mutate(relatedSessionProcess.id);
                        }}
                        disabled={abortTask.isPending}
                        className="flex-shrink-0 h-6 w-6"
                      >
                        {abortTask.isPending ? (
                          <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XIcon className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Trans id="session.conversation.abort" />
                    </TooltipContent>
                  </Tooltip>
                )}
              {sessionId !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-6 w-6"
                      onClick={() =>
                        exportSession.mutate({ projectId, sessionId })
                      }
                      disabled={exportSession.isPending}
                      aria-label="Export session to HTML"
                    >
                      <DownloadIcon
                        className={`w-3.5 h-3.5 ${exportSession.isPending ? "animate-pulse" : ""}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export to HTML</TooltipContent>
                </Tooltip>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 h-6 w-6"
                    aria-label="Session metadata"
                  >
                    <InfoIcon className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm mb-2">
                        <Trans id="control.metadata" />
                      </h3>
                      <div className="space-y-2">
                        {projectPath && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              <Trans id="control.project_path" />
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="h-7 text-xs flex items-center w-fit cursor-help"
                                >
                                  {projectPath.split("/").pop()}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{projectPath}</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                        {sessionId && isExistingSession && sessionData && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              <Trans id="control.session_id" />
                            </span>
                            <SessionIdDropdown
                              sessionId={sessionId}
                              jsonlFilePath={sessionData.session.jsonlFilePath}
                              runningPermissionMode={
                                relatedSessionProcess?.permissionMode
                              }
                            />
                          </div>
                        )}
                        {currentBranch && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              <Trans id="control.branch" />
                            </span>
                            <Badge
                              variant="secondary"
                              className="h-7 text-xs flex items-center gap-1 w-fit"
                            >
                              <GitBranchIcon className="w-3 h-3" />
                              {currentBranch}
                            </Badge>
                          </div>
                        )}
                        {isExistingSession &&
                          sessionData?.session.meta.modelName && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">
                                <Trans id="session.model.label" />
                              </span>
                              <Badge
                                variant="secondary"
                                className="h-7 text-xs flex items-center gap-1 w-fit"
                              >
                                <BotIcon className="w-3 h-3" />
                                {sessionData.session.meta.modelName}
                              </Badge>
                            </div>
                          )}
                        {isExistingSession && sessionData && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              <Trans id="session.cost.label" />
                            </span>
                            <div className="space-y-1.5">
                              <Badge
                                variant="secondary"
                                className="h-7 text-xs flex items-center w-fit font-semibold"
                              >
                                <Trans id="session.cost.total" />: $
                                {sessionData.session.meta.cost.totalUsd.toFixed(
                                  3,
                                )}
                              </Badge>
                              <div className="text-xs space-y-1 pl-2">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    <Trans id="session.cost.input_tokens" />:
                                  </span>
                                  <span>
                                    $
                                    {sessionData.session.meta.cost.breakdown.inputTokensUsd.toFixed(
                                      3,
                                    )}{" "}
                                    (
                                    {sessionData.session.meta.cost.tokenUsage.inputTokens.toLocaleString()}
                                    )
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    <Trans id="session.cost.output_tokens" />:
                                  </span>
                                  <span>
                                    $
                                    {sessionData.session.meta.cost.breakdown.outputTokensUsd.toFixed(
                                      3,
                                    )}{" "}
                                    (
                                    {sessionData.session.meta.cost.tokenUsage.outputTokens.toLocaleString()}
                                    )
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    <Trans id="session.cost.cache_creation" />:
                                  </span>
                                  <span>
                                    $
                                    {sessionData.session.meta.cost.breakdown.cacheCreationUsd.toFixed(
                                      3,
                                    )}{" "}
                                    (
                                    {sessionData.session.meta.cost.tokenUsage.cacheCreationTokens.toLocaleString()}
                                    )
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    <Trans id="session.cost.cache_read" />:
                                  </span>
                                  <span>
                                    $
                                    {sessionData.session.meta.cost.breakdown.cacheReadUsd.toFixed(
                                      3,
                                    )}{" "}
                                    (
                                    {sessionData.session.meta.cost.tokenUsage.cacheReadTokens.toLocaleString()}
                                    )
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {isExistingSession &&
                          sessionData?.session.meta.currentContextUsage && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">
                                <Trans id="session.context.label" />
                              </span>
                              <div className="space-y-1.5">
                                <Badge
                                  variant="secondary"
                                  className={`h-7 text-xs flex items-center gap-1 w-fit font-semibold ${
                                    sessionData.session.meta.currentContextUsage
                                      .percentage >= 70
                                      ? "bg-red-500/10 text-red-900 dark:text-red-200 border-red-500/20"
                                      : sessionData.session.meta
                                            .currentContextUsage.percentage >=
                                          50
                                        ? "bg-orange-500/10 text-orange-900 dark:text-orange-200 border-orange-500/20"
                                        : ""
                                  }`}
                                >
                                  <BrainIcon className="w-3 h-3" />
                                  {sessionData.session.meta.currentContextUsage.percentage.toFixed(
                                    1,
                                  )}
                                  %
                                </Badge>
                                <div className="text-xs space-y-1 pl-2">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                      <Trans id="session.context.current_tokens" />
                                      :
                                    </span>
                                    <span>
                                      {sessionData.session.meta.currentContextUsage.tokens.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                      <Trans id="session.context.max_tokens" />:
                                    </span>
                                    <span>
                                      {sessionData.session.meta.currentContextUsage.maxTokens.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0 min-w-0"
          data-testid="scrollable-content"
        >
          <main className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 relative min-w-0 pb-4">
            <ConversationList
              conversations={isExistingSession ? conversations : []}
              getToolResult={getToolResult}
              projectId={projectId}
              sessionId={sessionId ?? ""}
              projectName={projectName}
              scheduledJobs={sessionScheduledJobs}
            />
            {!isExistingSession &&
              (isCreatingSession ? (
                <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                    <div className="relative">
                      <LoaderIcon className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold">
                      <Trans id="session.creating.title" />
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed animate-pulse">
                      <Trans id="session.creating.description" />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 p-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                    <MessageSquareIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold">
                      <Trans id="chat.modal.title" />
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <Trans id="session.empty_state.description" />
                    </p>
                  </div>
                </div>
              ))}
            {isExistingSession &&
              (relatedSessionProcess?.status === "running" ||
                relatedSessionProcess?.status === "starting" ||
                relatedSessionProcess?.status === "pending") && (
                <div className="flex justify-start items-center py-8 animate-in fade-in duration-500">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium animate-pulse">
                      <Trans id="session.processing" />
                    </p>
                  </div>
                </div>
              )}
          </main>
        </div>

        <div className="w-full pt-3">
          <ChatActionMenu
            projectId={projectId}
            onScrollToTop={handleScrollToTop}
            onScrollToBottom={handleScrollToBottom}
            onForceReload={isExistingSession ? handleForceReload : undefined}
            isReloading={isReloading}
            isNewChat={!isExistingSession}
          />
        </div>

        <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {isExistingSession && sessionId && relatedSessionProcess ? (
            <ContinueChat
              projectId={projectId}
              sessionId={sessionId}
              sessionProcessId={relatedSessionProcess.id}
              sessionProcessStatus={relatedSessionProcess.status}
              currentPermissionMode={relatedSessionProcess.permissionMode}
            />
          ) : isExistingSession && sessionId ? (
            <ResumeChat projectId={projectId} sessionId={sessionId} />
          ) : (
            <StartNewChat
              projectId={projectId}
              onPendingChange={setIsCreatingSession}
            />
          )}
        </div>
      </div>

      <PermissionDialog
        permissionRequest={currentPermissionRequest}
        isOpen={isDialogOpen}
        onResponse={onPermissionResponse}
      />
    </>
  );
};

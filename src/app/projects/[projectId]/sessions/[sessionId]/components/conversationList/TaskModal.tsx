import { Trans } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, MessageSquare, XCircle } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { agentSessionQuery, findPendingAgentSession } from "@/lib/api/queries";
import type { SidechainConversation } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { UserEntry } from "../../../../../../../lib/conversation-schema/entry/UserEntrySchema";
import { extractFirstUserText } from "../../../../../../../server/core/session/functions/extractFirstUserText";
import { ConversationList } from "./ConversationList";

type TaskModalProps = {
  prompt: string;
  projectId: string;
  sessionId: string;
  /**
   * agentId from toolUseResult.agentId for new Claude Code versions.
   * Used to directly fetch agent-${agentId}.jsonl file.
   */
  agentId: string | undefined;
  /**
   * Timestamp of the tool_use message in the session.
   * Used to find pending agent sessions for foreground tasks.
   */
  toolUseTimestamp: string;
  /**
   * List of agentIds already known/mapped to tool_use IDs.
   * Used to exclude from pending agent search.
   */
  knownAgentIds: string[];
  getSidechainConversationByPrompt: (
    prompt: string,
  ) => SidechainConversation | undefined;
  getSidechainConversations: (rootUuid: string) => SidechainConversation[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
};

/**
 * Task modal component with fallback logic.
 * Always shows the "View Task" button for Task tools.
 *
 * Fallback strategy:
 * 1. First check legacy sidechain data (embedded in same session file)
 * 2. If legacy data exists (length > 0), display it without API request
 * 3. If agentId exists (from tool_result), fetch from agent session API endpoint
 * 4. If agentId is undefined (foreground task in progress), try to find the
 *    pending agent session by matching prompt and timestamp
 *
 * This approach supports:
 * - Old Claude Code versions (embedded sidechain)
 * - New versions with completed tasks (agentId in tool_result)
 * - New versions with foreground tasks in progress (agentId lookup)
 */
export const TaskModal: FC<TaskModalProps> = ({
  prompt,
  projectId,
  sessionId,
  agentId,
  toolUseTimestamp,
  knownAgentIds,
  getSidechainConversationByPrompt,
  getSidechainConversations,
  getToolResult,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // State for resolved agentId when not available from tool_result
  // This is used for foreground tasks where agentId is only known after completion
  const [resolvedAgentId, setResolvedAgentId] = useState<string | null>(null);
  const [isResolvingAgentId, setIsResolvingAgentId] = useState(false);

  // Use provided agentId or fallback to resolved one
  const effectiveAgentId = agentId ?? resolvedAgentId ?? undefined;

  // Check legacy sidechain data first
  const legacyConversation = getSidechainConversationByPrompt(prompt);
  const legacySidechainConversations =
    legacyConversation !== undefined
      ? getSidechainConversations(legacyConversation.uuid)
      : [];
  const hasLegacyData = legacySidechainConversations.length > 0;

  // Try to find pending agent session when modal opens and agentId is not available
  // Uses polling to keep searching until the agent file is created
  useEffect(() => {
    if (
      !isOpen ||
      hasLegacyData ||
      agentId !== undefined ||
      resolvedAgentId !== null
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const POLL_INTERVAL_MS = 1000;

    const resolve = async () => {
      if (cancelled) return;

      setIsResolvingAgentId(true);

      try {
        const result = await findPendingAgentSession({
          projectId,
          sessionId,
          prompt,
          toolUseTimestamp,
          knownAgentIds,
        });

        if (!cancelled) {
          if (result.agentId) {
            setResolvedAgentId(result.agentId);
            setIsResolvingAgentId(false);
          } else {
            // Agent not found yet, keep polling
            setIsResolvingAgentId(false);
            timeoutId = setTimeout(resolve, POLL_INTERVAL_MS);
          }
        }
      } catch (error) {
        console.error("Failed to find pending agent session:", error);
        if (!cancelled) {
          setIsResolvingAgentId(false);
          // Retry on error after a delay
          timeoutId = setTimeout(resolve, POLL_INTERVAL_MS);
        }
      }
    };

    resolve();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    isOpen,
    hasLegacyData,
    agentId,
    resolvedAgentId,
    projectId,
    sessionId,
    prompt,
    toolUseTimestamp,
    knownAgentIds,
  ]);

  // Only fetch from API if:
  // 1. Legacy data is not available
  // 2. effectiveAgentId exists (either from tool_result or resolved)
  // 3. Modal is open
  const shouldFetchFromApi =
    isOpen && !hasLegacyData && effectiveAgentId !== undefined;

  const { data, isLoading, error, refetch } = useQuery({
    ...agentSessionQuery(projectId, sessionId, effectiveAgentId ?? ""),
    enabled: shouldFetchFromApi,
    staleTime: 0,
  });

  // Determine which data source to use
  const conversations = hasLegacyData
    ? legacySidechainConversations.map((original) => ({
        ...original,
        isSidechain: false,
      }))
    : (data?.conversations ?? []);

  const agentSessionId = hasLegacyData ? undefined : data?.agentSessionId;
  const taskId = hasLegacyData ? legacyConversation?.uuid : agentSessionId;

  const title = (() => {
    const firstConversation = conversations.at(0);
    if (!firstConversation) {
      return prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt;
    }
    return extractFirstUserText(firstConversation) ?? prompt;
  })();

  // Determine loading/error states (only applicable when using API)
  const showLoading = isResolvingAgentId || (shouldFetchFromApi && isLoading);
  const showError = shouldFetchFromApi && error !== null;
  // Show conversations area when not loading and no error
  // Even if conversations is empty, we'll show the synthetic prompt
  const showConversations = !showLoading && !showError && isOpen;

  // Build the final conversation list:
  // - If agent has conversations, show them directly (they include the initial prompt)
  // - If agent has no conversations yet (task just started), show a synthetic prompt entry
  const conversationsToDisplay = useMemo(() => {
    if (conversations.length > 0) {
      // Agent has data, display it directly
      return conversations.map((c) => ({
        ...c,
        isSidechain: false,
      }));
    }

    // No agent data yet - show synthetic prompt while waiting for agent to start
    // This provides immediate feedback when the modal opens before the agent writes anything
    const syntheticUserEntry: UserEntry = {
      type: "user",
      message: {
        role: "user",
        content: prompt,
      },
      isSidechain: false,
      userType: "external",
      cwd: "",
      sessionId: sessionId,
      version: "",
      uuid: "synthetic-prompt",
      timestamp: toolUseTimestamp,
      parentUuid: null,
      isMeta: false,
      toolUseResult: undefined,
      gitBranch: "",
      isCompactSummary: false,
    };
    return [syntheticUserEntry];
  }, [conversations, prompt, sessionId, toolUseTimestamp]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-1.5 px-3 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-none flex items-center gap-1"
          data-testid="task-modal-button"
        >
          <Eye className="h-3 w-3" />
          <Trans id="assistant.tool.view_task_details" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-[95vw] md:w-[90vw] lg:w-[85vw] max-w-[1400px] h-[85vh] max-h-[85vh] flex flex-col p-0"
        data-testid="task-modal"
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight mb-1">
                {title.length > 120 ? `${title.slice(0, 120)}...` : title}
              </DialogTitle>
              <DialogDescription className="text-xs flex items-center gap-2 flex-wrap">
                {taskId !== undefined && taskId !== null && (
                  <>
                    <span className="flex items-center gap-1">
                      <Trans id="assistant.tool.task_id" />:{" "}
                      <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                        {taskId.slice(0, 8)}
                      </code>
                    </span>
                    <span className="text-muted-foreground">|</span>
                  </>
                )}
                <span>
                  <Trans
                    id="assistant.tool.message_count"
                    values={{ count: conversations.length }}
                  />
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 py-4">
          {showLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                <Trans id="assistant.tool.loading_task" />
              </p>
            </div>
          )}
          {showError && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">
                <Trans id="assistant.tool.error_loading_task" />
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <Trans id="assistant.tool.retry" />
              </Button>
            </div>
          )}
          {showConversations && (
            <ConversationList
              conversations={conversationsToDisplay}
              getToolResult={getToolResult}
              projectId={projectId}
              sessionId={sessionId}
              projectName=""
              scheduledJobs={[]}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

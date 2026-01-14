import { Trans } from "@lingui/react";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { type FC, useCallback, useMemo } from "react";
import { useConfig } from "@/app/hooks/useConfig";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Conversation } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { AssistantMessageContent } from "@/lib/conversation-schema/message/AssistantMessageSchema";
import type { UserMessageContent } from "@/lib/conversation-schema/message/UserMessageSchema";
import { calculateDuration } from "@/lib/date/formatDuration";
import type { SchedulerJob } from "@/server/core/scheduler/schema";
import type { ErrorJsonl } from "../../../../../../../server/core/types";
import { useSidechain } from "../../hooks/useSidechain";
import { AssistantConversationContent } from "./AssistantConversationContent";
import { CollapsedContents } from "./CollapsedContents";
import { ConversationItem } from "./ConversationItem";
import { ScheduledMessageNotice } from "./ScheduledMessageNotice";

export type AssistantConversation = Extract<
  Conversation,
  { type: "assistant" }
>;

/**
 * A content item with its source conversation UUID for keying
 */
export type ContentWithUuid = {
  content: AssistantMessageContent;
  uuid: string;
  contentIndex: number;
};

/**
 * Check if a user message content array is a tool_result
 */
const isToolResultContent = (
  content: string | UserMessageContent[],
): boolean => {
  if (typeof content === "string") return false;
  const firstItem = content[0];
  return (
    typeof firstItem === "object" &&
    firstItem !== null &&
    "type" in firstItem &&
    firstItem.type === "tool_result"
  );
};

/**
 * Simplified view element types:
 * - user: A user message (not tool_result)
 * - text: A single text content from an assistant message
 * - collapsed: A group of non-text contents from assistant messages
 */
type SimplifiedViewElement =
  | {
      type: "user";
      conversation: Extract<Conversation, { type: "user" }>;
    }
  | {
      type: "text";
      content: AssistantMessageContent;
      uuid: string;
      contentIndex: number;
    }
  | {
      type: "collapsed";
      contents: ContentWithUuid[];
    };

/**
 * Add a non-text content to the last collapsed group if it exists,
 * otherwise create a new collapsed group
 */
const addToOrCreateCollapsedElement = (
  elements: SimplifiedViewElement[],
  content: AssistantMessageContent,
  uuid: string,
  contentIndex: number,
): void => {
  const lastElement = elements[elements.length - 1];
  if (lastElement?.type === "collapsed") {
    // Merge with existing collapsed group
    lastElement.contents.push({ content, uuid, contentIndex });
  } else {
    // Create new collapsed group
    elements.push({
      type: "collapsed",
      contents: [{ content, uuid, contentIndex }],
    });
  }
};

/**
 * Build simplified view elements from filtered conversations.
 * - User messages become "user" elements
 * - Assistant text contents become "text" elements
 * - Assistant non-text contents (tools, thinking) are grouped into "collapsed" elements
 *
 * Non-text contents from messages with text are grouped with non-text contents
 * from subsequent messages, ensuring proper grouping even in live mode.
 */
const buildSimplifiedViewElements = (
  conversations: (Conversation | ErrorJsonl)[],
): SimplifiedViewElement[] => {
  const elements: SimplifiedViewElement[] = [];

  for (const conv of conversations) {
    // Skip errors
    if (conv.type === "x-error") continue;

    // Handle user messages
    if (conv.type === "user") {
      elements.push({ type: "user", conversation: conv });
      continue;
    }

    // Handle assistant messages - split into text and non-text contents
    if (conv.type === "assistant") {
      for (let i = 0; i < conv.message.content.length; i++) {
        const content = conv.message.content[i];
        if (content === undefined) continue;

        if (content.type === "text") {
          // Text content becomes its own element
          elements.push({
            type: "text",
            content,
            uuid: conv.uuid,
            contentIndex: i,
          });
        } else {
          // Non-text content goes into collapsed group
          addToOrCreateCollapsedElement(elements, content, conv.uuid, i);
        }
      }
    }
  }

  return elements;
};

/**
 * Type guard to check if toolUseResult contains agentId.
 * The agentId field is available in newer Claude Code versions
 * where agent sessions are stored in separate agent-*.jsonl files.
 */
const hasAgentId = (
  toolUseResult: unknown,
): toolUseResult is { agentId: string } => {
  return (
    typeof toolUseResult === "object" &&
    toolUseResult !== null &&
    "agentId" in toolUseResult &&
    typeof (toolUseResult as { agentId: unknown }).agentId === "string"
  );
};

const getConversationKey = (conversation: Conversation) => {
  if (conversation.type === "user") {
    return `user_${conversation.uuid}`;
  }

  if (conversation.type === "assistant") {
    return `assistant_${conversation.uuid}`;
  }

  if (conversation.type === "system") {
    return `system_${conversation.uuid}`;
  }

  if (conversation.type === "summary") {
    return `summary_${conversation.leafUuid}`;
  }

  if (conversation.type === "file-history-snapshot") {
    return `file-history-snapshot_${conversation.messageId}`;
  }

  if (conversation.type === "queue-operation") {
    return `queue-operation_${conversation.operation}_${conversation.sessionId}_${conversation.timestamp}`;
  }

  conversation satisfies never;
  throw new Error(`Unknown conversation type: ${conversation}`);
};

const SchemaErrorDisplay: FC<{ errorLine: string }> = ({ errorLine }) => {
  return (
    <li className="w-full flex justify-start">
      <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%] px-2">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2 border-l-2 border-red-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span className="text-xs font-medium text-red-600">
                  <Trans id="conversation.error.schema" />
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-background rounded border border-red-200 p-3 mt-2">
              <div className="space-y-3">
                <Alert
                  variant="destructive"
                  className="border-red-200 bg-red-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-red-800">
                    <Trans id="conversation.error.schema_validation" />
                  </AlertTitle>
                  <AlertDescription className="text-red-700">
                    <Trans id="conversation.error.schema_validation.description" />{" "}
                    <a
                      href="https://github.com/d-kimuson/claude-code-viewer/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 underline underline-offset-4"
                    >
                      <Trans id="conversation.error.report_issue" />
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
                <div className="bg-gray-50 border rounded px-3 py-2">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">
                    <Trans id="conversation.error.raw_content" />
                  </h5>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono text-gray-800">
                    {errorLine}
                  </pre>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </li>
  );
};

type ConversationListProps = {
  conversations: (Conversation | ErrorJsonl)[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  projectId: string;
  sessionId: string;
  projectName: string;
  scheduledJobs: SchedulerJob[];
};

export const ConversationList: FC<ConversationListProps> = ({
  conversations,
  getToolResult,
  projectId,
  sessionId,
  projectName,
  scheduledJobs,
}) => {
  const { config } = useConfig();
  const simplifiedView = config?.simplifiedView ?? false;

  const validConversations = useMemo(
    () =>
      conversations.filter((conversation) => conversation.type !== "x-error"),
    [conversations],
  );

  // In simplified view, only show user messages (without isMeta and not tool_result) and assistant messages
  const filteredConversations = useMemo(() => {
    if (!simplifiedView) {
      return conversations;
    }
    return conversations.filter((conversation) => {
      if (conversation.type === "x-error") {
        return false;
      }
      if (conversation.type === "user") {
        // Filter out meta messages
        if (conversation.isMeta === true) {
          return false;
        }
        // Filter out tool_result messages (they appear between assistant tool_use messages)
        if (isToolResultContent(conversation.message.content)) {
          return false;
        }
        return true;
      }
      if (conversation.type === "assistant") {
        return true;
      }
      // Filter out: system, summary, file-history-snapshot, queue-operation
      return false;
    });
  }, [conversations, simplifiedView]);

  // In simplified view, build elements with proper content grouping
  const simplifiedViewElements = useMemo(() => {
    if (!simplifiedView) {
      return null;
    }
    return buildSimplifiedViewElements(filteredConversations);
  }, [filteredConversations, simplifiedView]);
  const {
    isRootSidechain,
    getSidechainConversations,
    getSidechainConversationByPrompt,
    existsRelatedTaskCall,
  } = useSidechain(validConversations);

  // Build a map of assistant UUID -> turn duration (ms)
  // Turn duration = time from the starting user message to the last assistant message of the turn
  // A turn starts with a real user message and ends when the next real user message arrives
  // Only the LAST assistant message in each turn gets a duration
  const turnDurationMap = useMemo(() => {
    const map = new Map<string, number>();

    // Helper to check if a user message is a real user input (not a tool result)
    const isRealUserMessage = (conv: Conversation): boolean => {
      if (conv.type !== "user" || conv.isSidechain) {
        return false;
      }
      return !isToolResultContent(conv.message.content);
    };

    // First, identify turn boundaries (indices of real user messages)
    const turnStartIndices: number[] = [];
    for (let i = 0; i < validConversations.length; i++) {
      const conv = validConversations[i];
      if (conv !== undefined && isRealUserMessage(conv)) {
        turnStartIndices.push(i);
      }
    }

    // For each turn, find the last assistant message and calculate duration
    for (let turnIdx = 0; turnIdx < turnStartIndices.length; turnIdx++) {
      const turnStartIndex = turnStartIndices[turnIdx];
      if (turnStartIndex === undefined) {
        continue;
      }
      const turnEndIndex =
        turnStartIndices[turnIdx + 1] ?? validConversations.length;
      const turnStartConv = validConversations[turnStartIndex];

      if (turnStartConv === undefined || turnStartConv.type !== "user") {
        continue;
      }

      // Find the last non-sidechain assistant message in this turn
      let lastAssistantInTurn: (typeof validConversations)[number] | null =
        null;
      for (let i = turnStartIndex + 1; i < turnEndIndex; i++) {
        const conv = validConversations[i];
        if (
          conv !== undefined &&
          conv.type === "assistant" &&
          !conv.isSidechain
        ) {
          lastAssistantInTurn = conv;
        }
      }

      // Calculate duration from turn start to last assistant message
      if (lastAssistantInTurn !== null) {
        const duration = calculateDuration(
          turnStartConv.timestamp,
          lastAssistantInTurn.timestamp,
        );
        if (duration !== null && duration >= 0) {
          map.set(lastAssistantInTurn.uuid, duration);
        }
      }
    }

    return map;
  }, [validConversations]);

  const getTurnDuration = useCallback(
    (uuid: string): number | undefined => {
      return turnDurationMap.get(uuid);
    },
    [turnDurationMap],
  );

  // Build a map of tool_use_id -> agentId from user entries with toolUseResult
  const toolUseIdToAgentIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conv of validConversations) {
      if (conv.type !== "user") continue;
      const messageContent = conv.message.content;
      if (typeof messageContent === "string") continue;

      for (const content of messageContent) {
        // content can be string or object - need to check type
        if (typeof content === "string") continue;
        if (content.type === "tool_result") {
          const toolUseResult = conv.toolUseResult;
          if (hasAgentId(toolUseResult)) {
            map.set(content.tool_use_id, toolUseResult.agentId);
          }
        }
      }
    }
    return map;
  }, [validConversations]);

  const getAgentIdForToolUse = useCallback(
    (toolUseId: string): string | undefined => {
      return toolUseIdToAgentIdMap.get(toolUseId);
    },
    [toolUseIdToAgentIdMap],
  );

  const renderConversation = (conversation: Conversation | ErrorJsonl) => {
    if (conversation.type === "x-error") {
      return (
        <SchemaErrorDisplay
          key={`error_${conversation.line}`}
          errorLine={conversation.line}
        />
      );
    }

    const elm = (
      <ConversationItem
        key={getConversationKey(conversation)}
        conversation={conversation}
        getToolResult={getToolResult}
        getAgentIdForToolUse={getAgentIdForToolUse}
        getTurnDuration={getTurnDuration}
        isRootSidechain={isRootSidechain}
        getSidechainConversations={getSidechainConversations}
        getSidechainConversationByPrompt={getSidechainConversationByPrompt}
        existsRelatedTaskCall={existsRelatedTaskCall}
        projectId={projectId}
        sessionId={sessionId}
      />
    );

    const isSidechain =
      conversation.type !== "summary" &&
      conversation.type !== "file-history-snapshot" &&
      conversation.type !== "queue-operation" &&
      conversation.isSidechain;

    if (isSidechain) {
      return null;
    }

    return (
      <li
        className={`w-full flex ${
          isSidechain ||
          conversation.type === "assistant" ||
          conversation.type === "system" ||
          conversation.type === "summary"
            ? "justify-start"
            : "justify-end"
        } animate-in fade-in slide-in-from-bottom-2 duration-300`}
        key={getConversationKey(conversation)}
      >
        <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%]">
          {elm}
        </div>
      </li>
    );
  };

  // Render simplified view with properly grouped elements
  if (simplifiedView && simplifiedViewElements) {
    return (
      <>
        <ul>
          {simplifiedViewElements.map((element, index) => {
            if (element.type === "user") {
              return renderConversation(element.conversation);
            }

            if (element.type === "text") {
              // Render text content directly
              return (
                <li
                  key={`text-${element.uuid}-${element.contentIndex}`}
                  className="w-full flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%]">
                    <ul className="w-full">
                      <li>
                        <AssistantConversationContent
                          content={element.content}
                          getToolResult={getToolResult}
                          getAgentIdForToolUse={getAgentIdForToolUse}
                          getSidechainConversationByPrompt={
                            getSidechainConversationByPrompt
                          }
                          getSidechainConversations={getSidechainConversations}
                          projectId={projectId}
                          sessionId={sessionId}
                        />
                      </li>
                    </ul>
                  </div>
                </li>
              );
            }

            if (element.type === "collapsed") {
              const firstContent = element.contents[0];
              const key =
                firstContent !== undefined
                  ? `collapsed-${firstContent.uuid}-${firstContent.contentIndex}`
                  : `collapsed-${index}`;
              return (
                <li key={key} className="w-full flex justify-start">
                  <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%]">
                    <CollapsedContents
                      contents={element.contents}
                      getToolResult={getToolResult}
                      getAgentIdForToolUse={getAgentIdForToolUse}
                      getSidechainConversations={getSidechainConversations}
                      getSidechainConversationByPrompt={
                        getSidechainConversationByPrompt
                      }
                      projectId={projectId}
                      sessionId={sessionId}
                    />
                  </div>
                </li>
              );
            }

            return null;
          })}
        </ul>
        <ScheduledMessageNotice
          scheduledJobs={scheduledJobs}
          projectId={projectId}
          sessionId={sessionId}
          projectName={projectName}
        />
      </>
    );
  }

  return (
    <>
      <ul>
        {filteredConversations.map((conversation) =>
          renderConversation(conversation),
        )}
      </ul>
      <ScheduledMessageNotice
        scheduledJobs={scheduledJobs}
        projectId={projectId}
        sessionId={sessionId}
        projectName={projectName}
      />
    </>
  );
};

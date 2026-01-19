import type { FC } from "react";
import { useConfig } from "@/app/hooks/useConfig";
import type {
  Conversation,
  SidechainConversation,
} from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { AssistantConversationContent } from "./AssistantConversationContent";
import { FileHistorySnapshotConversationContent } from "./FileHistorySnapshotConversationContent";
import { MetaConversationContent } from "./MetaConversationContent";
// import { QueueOperationConversationContent } from "./QueueOperationConversationContent";
import { SummaryConversationContent } from "./SummaryConversationContent";
// import { SystemConversationContent } from "./SystemConversationContent";
import { TurnDuration } from "./TurnDuration";
import { UserConversationContent } from "./UserConversationContent";

export const ConversationItem: FC<{
  conversation: Conversation;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  getAgentIdForToolUse: (toolUseId: string) => string | undefined;
  getKnownAgentIds: () => string[];
  getTurnDuration: (uuid: string) => number | undefined;
  isRootSidechain: (conversation: Conversation) => boolean;
  getSidechainConversationByPrompt: (
    prompt: string,
  ) => SidechainConversation | undefined;
  getSidechainConversations: (rootUuid: string) => SidechainConversation[];
  existsRelatedTaskCall: (prompt: string) => boolean;
  projectId: string;
  sessionId: string;
}> = ({
  conversation,
  getToolResult,
  getAgentIdForToolUse,
  getKnownAgentIds,
  getTurnDuration,
  getSidechainConversationByPrompt,
  getSidechainConversations,
  projectId,
  sessionId,
}) => {
  const { config } = useConfig();
  const simplifiedView = config?.simplifiedView ?? false;
  if (conversation.type === "summary") {
    return (
      <SummaryConversationContent>
        {conversation.summary}
      </SummaryConversationContent>
    );
  }

  // System messages are technical implementation details (hooks, errors, etc.)
  // Not displayed but code kept for potential future debug mode
  if (conversation.type === "system") {
    // const content =
    //   "content" in conversation && typeof conversation.content === "string"
    //     ? conversation.content
    //     : conversation.subtype === "stop_hook_summary"
    //       ? `Stop hook executed: ${conversation.hookInfos.map((h) => h.command).join(", ")}`
    //       : "System message";
    // return <SystemConversationContent>{content}</SystemConversationContent>;
    return null;
  }

  if (conversation.type === "file-history-snapshot") {
    return (
      <FileHistorySnapshotConversationContent conversation={conversation} />
    );
  }

  // Queue operations are internal mechanisms (enqueue/dequeue)
  // Not displayed but code kept for potential future debug mode
  if (conversation.type === "queue-operation") {
    // return <QueueOperationConversationContent conversation={conversation} />;
    return null;
  }

  if (conversation.type === "user") {
    const userConversationJsx =
      typeof conversation.message.content === "string" ? (
        <UserConversationContent
          content={conversation.message.content}
          id={`message-${conversation.uuid}`}
        />
      ) : (
        <ul className="w-full" id={`message-${conversation.uuid}`}>
          {conversation.message.content.map((content) => (
            <li key={content.toString()}>
              <UserConversationContent content={content} />
            </li>
          ))}
        </ul>
      );

    return conversation.isMeta === true ? (
      // 展開可能にしてデフォで非展開
      <MetaConversationContent>{userConversationJsx}</MetaConversationContent>
    ) : (
      userConversationJsx
    );
  }

  if (conversation.type === "assistant") {
    const turnDuration = getTurnDuration(conversation.uuid);

    // In simplified view, only show text content - tools are handled at ConversationList level
    if (simplifiedView) {
      const textContents = conversation.message.content.filter(
        (c) => c.type === "text",
      );

      // Don't render anything if no text content
      if (textContents.length === 0) {
        return null;
      }

      return (
        <ul className="w-full">
          {textContents.map((content) => (
            <li key={content.toString()}>
              <AssistantConversationContent
                content={content}
                getToolResult={getToolResult}
                getAgentIdForToolUse={getAgentIdForToolUse}
                getKnownAgentIds={getKnownAgentIds}
                getSidechainConversationByPrompt={
                  getSidechainConversationByPrompt
                }
                getSidechainConversations={getSidechainConversations}
                projectId={projectId}
                sessionId={sessionId}
                conversationTimestamp={conversation.timestamp}
              />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="w-full">
        <ul className="w-full">
          {conversation.message.content.map((content) => (
            <li key={content.toString()}>
              <AssistantConversationContent
                content={content}
                getToolResult={getToolResult}
                getAgentIdForToolUse={getAgentIdForToolUse}
                getKnownAgentIds={getKnownAgentIds}
                getSidechainConversationByPrompt={
                  getSidechainConversationByPrompt
                }
                getSidechainConversations={getSidechainConversations}
                projectId={projectId}
                sessionId={sessionId}
                conversationTimestamp={conversation.timestamp}
              />
            </li>
          ))}
        </ul>
        {turnDuration !== undefined && (
          <TurnDuration durationMs={turnDuration} />
        )}
      </div>
    );
  }

  return null;
};

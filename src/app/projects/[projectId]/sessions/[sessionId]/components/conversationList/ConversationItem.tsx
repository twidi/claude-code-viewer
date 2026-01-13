import type { FC } from "react";
import { useConfig } from "@/app/hooks/useConfig";
import type {
  Conversation,
  SidechainConversation,
} from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { AssistantMessageContent } from "@/lib/conversation-schema/message/AssistantMessageSchema";
import { AssistantConversationContent } from "./AssistantConversationContent";
import { CollapsedAssistantContent } from "./CollapsedAssistantContent";
import { FileHistorySnapshotConversationContent } from "./FileHistorySnapshotConversationContent";
import { MetaConversationContent } from "./MetaConversationContent";
import { QueueOperationConversationContent } from "./QueueOperationConversationContent";
import { SummaryConversationContent } from "./SummaryConversationContent";
import { SystemConversationContent } from "./SystemConversationContent";
import { TurnDuration } from "./TurnDuration";
import { UserConversationContent } from "./UserConversationContent";

type ContentGroup = {
  type: "text" | "collapsed";
  contents: AssistantMessageContent[];
};

function groupAssistantContent(
  contents: AssistantMessageContent[],
): ContentGroup[] {
  const groups: ContentGroup[] = [];
  let currentCollapsed: AssistantMessageContent[] = [];

  for (const content of contents) {
    if (content.type === "text") {
      if (currentCollapsed.length > 0) {
        groups.push({ type: "collapsed", contents: currentCollapsed });
        currentCollapsed = [];
      }
      groups.push({ type: "text", contents: [content] });
    } else {
      currentCollapsed.push(content);
    }
  }

  if (currentCollapsed.length > 0) {
    groups.push({ type: "collapsed", contents: currentCollapsed });
  }

  return groups;
}

export const ConversationItem: FC<{
  conversation: Conversation;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  getAgentIdForToolUse: (toolUseId: string) => string | undefined;
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

  if (conversation.type === "system") {
    const content =
      "content" in conversation && typeof conversation.content === "string"
        ? conversation.content
        : conversation.subtype === "stop_hook_summary"
          ? `Stop hook executed: ${conversation.hookInfos.map((h) => h.command).join(", ")}`
          : "System message";
    return <SystemConversationContent>{content}</SystemConversationContent>;
  }

  if (conversation.type === "file-history-snapshot") {
    return (
      <FileHistorySnapshotConversationContent conversation={conversation} />
    );
  }

  if (conversation.type === "queue-operation") {
    return <QueueOperationConversationContent conversation={conversation} />;
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

    // In simplified view, group content: show text directly, collapse others
    if (simplifiedView) {
      const groups = groupAssistantContent(conversation.message.content);

      // Don't render anything if no groups
      if (groups.length === 0) {
        return null;
      }

      return (
        <ul className="w-full">
          {groups.map((group, index) => {
            const firstContent = group.contents[0];
            if (firstContent === undefined) {
              return null;
            }
            return (
              <li key={`group-${index}-${group.type}`}>
                {group.type === "text" ? (
                  <AssistantConversationContent
                    content={firstContent}
                    getToolResult={getToolResult}
                    getAgentIdForToolUse={getAgentIdForToolUse}
                    getSidechainConversationByPrompt={
                      getSidechainConversationByPrompt
                    }
                    getSidechainConversations={getSidechainConversations}
                    projectId={projectId}
                    sessionId={sessionId}
                  />
                ) : (
                  <CollapsedAssistantContent
                    contents={group.contents}
                    getToolResult={getToolResult}
                    getAgentIdForToolUse={getAgentIdForToolUse}
                    getSidechainConversationByPrompt={
                      getSidechainConversationByPrompt
                    }
                    getSidechainConversations={getSidechainConversations}
                    projectId={projectId}
                    sessionId={sessionId}
                  />
                )}
              </li>
            );
          })}
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
                getSidechainConversationByPrompt={
                  getSidechainConversationByPrompt
                }
                getSidechainConversations={getSidechainConversations}
                projectId={projectId}
                sessionId={sessionId}
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

import { type FC, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SidechainConversation } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { AssistantConversationContent } from "./AssistantConversationContent";
import type { AssistantConversation } from "./ConversationList";

type CollapsedConversationsProps = {
  conversations: AssistantConversation[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  getAgentIdForToolUse: (toolUseId: string) => string | undefined;
  getSidechainConversationByPrompt: (
    prompt: string,
  ) => SidechainConversation | undefined;
  getSidechainConversations: (rootUuid: string) => SidechainConversation[];
  projectId: string;
  sessionId: string;
};

export const CollapsedConversations: FC<CollapsedConversationsProps> = ({
  conversations,
  getToolResult,
  getAgentIdForToolUse,
  getSidechainConversationByPrompt,
  getSidechainConversations,
  projectId,
  sessionId,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Flatten all assistant message contents from all conversations
  const allContents = conversations.flatMap((conversation) =>
    conversation.message.content.map((content, contentIndex) => ({
      content,
      key: `${conversation.uuid}-${contentIndex}`,
    })),
  );

  if (allContents.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="px-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          …
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="w-full border-l-2 border-muted ml-1 pl-2 mt-1">
          {allContents.map(({ content, key }) => (
            <li key={key} className="w-full">
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
      </CollapsibleContent>
    </Collapsible>
  );
};

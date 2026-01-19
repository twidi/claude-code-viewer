import { Trans } from "@lingui/react";
import { AlertCircle } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserMessageContent } from "@/lib/conversation-schema/message/UserMessageSchema";
import { AttachedDocument, AttachedImage } from "./AttachedContent";
import { UserTextContent } from "./UserTextContent";

export const UserConversationContent: FC<{
  content: UserMessageContent;
  id?: string;
}> = ({ content, id }) => {
  if (typeof content === "string") {
    return <UserTextContent text={content} id={id} />;
  }

  if (content.type === "text") {
    return <UserTextContent text={content.text} id={id} />;
  }

  if (content.type === "image") {
    if (content.source.type === "base64") {
      return <AttachedImage image={content} id={id} />;
    }

    return (
      <Card
        className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
        id={id}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-sm font-medium">
              <Trans id="user.content.unsupported_media" />
            </CardTitle>
            <Badge variant="destructive">
              <Trans id="common.error" />
            </Badge>
          </div>
          <CardDescription className="text-xs">
            <Trans id="user.content.unsupported_media.description" />
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (content.type === "document") {
    if (content.source.type === "base64" || content.source.type === "text") {
      return <AttachedDocument document={content} id={id} />;
    }

    return (
      <Card
        className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
        id={id}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-sm font-medium">
              <Trans id="user.content.unsupported_document" />
            </CardTitle>
            <Badge variant="destructive">
              <Trans id="common.error" />
            </Badge>
          </div>
          <CardDescription className="text-xs">
            <Trans id="user.content.unsupported_document.description" />
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (content.type === "tool_result") {
    // ツール結果は Assistant の呼び出し側に添えるので
    return null;
  }

  return null;
};

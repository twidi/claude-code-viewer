import { Trans, useLingui } from "@lingui/react";
import { ChevronDown, ChevronUp, Pencil, Send, Trash2, X } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import type { PendingMessage } from "../../hooks/usePendingMessages";

type QueuedMessagesPanelProps = {
  messages: PendingMessage[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateMessage: (index: number, text: string) => void;
  onRemoveMessage: (index: number) => void;
  onClearAll: () => void;
  onSendNow: () => void;
  canSendNow: boolean;
  isSending: boolean;
};

export const QueuedMessagesPanel: FC<QueuedMessagesPanelProps> = ({
  messages,
  isOpen,
  onOpenChange,
  onUpdateMessage,
  onRemoveMessage,
  onClearAll,
  onSendNow,
  canSendNow,
  isSending,
}) => {
  const { i18n } = useLingui();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  if (messages.length === 0) {
    return null;
  }

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditText(text);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      onUpdateMessage(editingIndex, editText);
      setEditingIndex(null);
      setEditText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const truncateText = (text: string, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground w-full group">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <Trans
            id="chat.queue.pending_indicator"
            message="{count} message(s) queued"
            values={{ count: messages.length }}
          />
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
          )}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="border rounded-lg bg-muted/30 overflow-hidden">
          <div className="divide-y">
            {messages.map((message, index) => (
              <div
                key={`${message.queuedAt}-${index}`}
                className="p-3 flex items-start gap-2"
              >
                <span className="text-xs text-muted-foreground font-medium min-w-[1.5rem]">
                  {index + 1}.
                </span>

                {editingIndex === index ? (
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[60px] text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Trans id="common.save" message="Save" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        <Trans id="common.cancel" message="Cancel" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm whitespace-pre-wrap break-words">
                      {truncateText(message.text, 200)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(index, message.text)}
                        title={i18n._({
                          id: "chat.queue.edit",
                          message: "Edit message",
                        })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onRemoveMessage(index)}
                        title={i18n._({
                          id: "chat.queue.remove",
                          message: "Remove message",
                        })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t bg-muted/50 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={onClearAll}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <Trans id="chat.queue.clear_all" message="Clear all" />
            </Button>

            {canSendNow && (
              <Button size="sm" onClick={onSendNow} disabled={isSending}>
                <Send className="w-3.5 h-3.5 mr-1" />
                <Trans id="chat.queue.send_now" message="Send now" />
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

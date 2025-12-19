import { Trans, useLingui } from "@lingui/react";
import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfig } from "../../../../../../hooks/useConfig";
import {
  ChatInput,
  type MessageInput,
  useContinueSessionProcessMutation,
  useCreateSessionProcessMutation,
} from "../../../../components/chatForm";
import { usePendingMessages } from "../../hooks/usePendingMessages";
import { usePendingPermissionMode } from "../../hooks/usePendingPermissionMode";
import { useStopSessionProcessMutation } from "../../hooks/useStopSessionProcessMutation";
import { formatQueuedMessages } from "../../utils/formatQueuedMessages";
import { QueuedMessagesPanel } from "./QueuedMessagesPanel";

export const ContinueChat: FC<{
  projectId: string;
  sessionId: string;
  sessionProcessId: string;
  sessionProcessStatus?: "running" | "paused";
  currentPermissionMode?: string;
}> = ({
  projectId,
  sessionId,
  sessionProcessId,
  sessionProcessStatus,
  currentPermissionMode,
}) => {
  const { i18n } = useLingui();
  const continueSessionProcess = useContinueSessionProcessMutation(
    projectId,
    sessionId,
  );
  const createSessionProcess = useCreateSessionProcessMutation(projectId);
  const stopSessionProcess = useStopSessionProcessMutation(projectId);
  const { config } = useConfig();
  const { pendingMode, clearPendingMode } = usePendingPermissionMode(sessionId);
  const {
    pendingMessages,
    addPendingMessage,
    clearPendingMessages,
    updatePendingMessage,
    removePendingMessage,
    hasPendingMessages,
  } = usePendingMessages(sessionId);

  // Track previous status for transition detection
  const prevStatusRef = useRef<"running" | "paused" | undefined>(undefined);

  // Track if panel is open (blocks auto-send when open)
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const isPanelOpenRef = useRef(isPanelOpen);

  // Keep ref in sync with state
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  // Auto-open panel when we have orphan messages and Claude is not running
  // This happens on page load/reload when messages couldn't be auto-sent
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (
      hasPendingMessages &&
      sessionProcessStatus === "paused" &&
      !hasAutoOpenedRef.current
    ) {
      setIsPanelOpen(true);
      hasAutoOpenedRef.current = true;
    }
  }, [hasPendingMessages, sessionProcessStatus]);

  // Check if we need to change permission mode
  const needsPermissionChange =
    pendingMode !== null && pendingMode !== currentPermissionMode;

  const handleSubmit = async (input: MessageInput) => {
    // If session is running, queue the message instead of sending
    if (isRunning) {
      // Warn if files are attached - they won't be queued
      const hasFiles =
        (input.images && input.images.length > 0) ||
        (input.documents && input.documents.length > 0);
      if (hasFiles) {
        toast.warning(i18n._({ id: "chat.queue.files_not_supported" }));
      }

      // Queue the message
      addPendingMessage(input.text);
      // pendingMessages.length is the count BEFORE adding, so +1 for new total
      const newCount = pendingMessages.length + 1;
      toast.success(
        i18n._({
          id: "chat.queue.message_queued",
          values: { count: newCount },
        }),
      );
      return;
    }

    // Normal send flow when paused
    if (needsPermissionChange && sessionProcessStatus === "paused") {
      // Stop the current process, then resume with new permission mode
      await stopSessionProcess.mutateAsync(sessionProcessId);
      await createSessionProcess.mutateAsync({
        input,
        baseSessionId: sessionId,
        permissionModeOverride: pendingMode,
      });
      clearPendingMode();
    } else {
      // Normal continue flow
      await continueSessionProcess.mutateAsync({ input, sessionProcessId });
    }
  };

  // Send queued messages helper
  const sendQueuedMessages = useCallback(
    (messages: { text: string; queuedAt: string }[]) => {
      // Format the messages
      const formattedText = formatQueuedMessages(messages);

      // Show toast
      toast.info(
        i18n._({
          id: "chat.queue.sending_queued",
          values: { count: messages.length },
        }),
      );

      // Send the formatted message
      const input: MessageInput = {
        text: formattedText,
        images: [],
        documents: [],
      };

      // Call the normal submit flow (not the handleSubmit to avoid queueing logic)
      if (needsPermissionChange) {
        stopSessionProcess
          .mutateAsync(sessionProcessId)
          .then(() =>
            createSessionProcess.mutateAsync({
              input,
              baseSessionId: sessionId,
              permissionModeOverride: pendingMode,
            }),
          )
          .then(() => clearPendingMode())
          .catch((error) => {
            toast.error(
              i18n._({
                id: "chat.queue.send_failed",
                message: "Failed to send queued messages",
              }),
            );
            console.error("Failed to send queued messages:", error);
          });
      } else {
        continueSessionProcess
          .mutateAsync({ input, sessionProcessId })
          .catch((error) => {
            toast.error(
              i18n._({
                id: "chat.queue.send_failed",
                message: "Failed to send queued messages",
              }),
            );
            console.error("Failed to send queued messages:", error);
          });
      }
    },
    [
      i18n,
      needsPermissionChange,
      stopSessionProcess,
      sessionProcessId,
      createSessionProcess,
      sessionId,
      pendingMode,
      clearPendingMode,
      continueSessionProcess,
    ],
  );

  // Auto-send queued messages when session transitions from running to paused
  // BUT only if the panel is NOT open (open panel = user wants to review/edit)
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = sessionProcessStatus;

    // Detect transition from running to paused
    const isTransition = prevStatus === "running" && currentStatus === "paused";

    if (isTransition && hasPendingMessages && !isPanelOpenRef.current) {
      // Get and clear all pending messages
      const messages = clearPendingMessages();
      sendQueuedMessages(messages);
    }

    // Update ref for next render
    prevStatusRef.current = sessionProcessStatus;
  }, [
    sessionProcessStatus,
    hasPendingMessages,
    clearPendingMessages,
    sendQueuedMessages,
  ]);

  // Handle manual send from panel
  const handleSendNow = useCallback(() => {
    const messages = clearPendingMessages();
    if (messages.length > 0) {
      setIsPanelOpen(false);
      sendQueuedMessages(messages);
    }
  }, [clearPendingMessages, sendQueuedMessages]);

  // Handle clear all from panel
  const handleClearAll = useCallback(() => {
    clearPendingMessages();
    setIsPanelOpen(false);
    toast.info(
      i18n._({
        id: "chat.queue.cleared",
        message: "Queued messages cleared",
      }),
    );
  }, [clearPendingMessages, i18n]);

  const getPlaceholder = () => {
    const behavior = config?.enterKeyBehavior;
    if (behavior === "enter-send") {
      return i18n._({
        id: "chat.placeholder.continue.enter",
        message:
          "Type your message... (Start with / for commands, @ for files, Enter to send)",
      });
    }
    if (behavior === "command-enter-send") {
      return i18n._({
        id: "chat.placeholder.continue.command_enter",
        message:
          "Type your message... (Start with / for commands, @ for files, Command+Enter to send)",
      });
    }
    return i18n._({
      id: "chat.placeholder.continue.shift_enter",
      message:
        "Type your message... (Start with / for commands, @ for files, Shift+Enter to send)",
    });
  };

  const isRunning = sessionProcessStatus === "running";
  const isPending =
    continueSessionProcess.isPending ||
    stopSessionProcess.isPending ||
    createSessionProcess.isPending;
  const error =
    continueSessionProcess.error ||
    stopSessionProcess.error ||
    createSessionProcess.error;

  // Can send now only when Claude is paused
  const canSendNow = sessionProcessStatus === "paused";

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-3">
      <QueuedMessagesPanel
        messages={pendingMessages}
        isOpen={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        onUpdateMessage={updatePendingMessage}
        onRemoveMessage={removePendingMessage}
        onClearAll={handleClearAll}
        onSendNow={handleSendNow}
        canSendNow={canSendNow}
        isSending={isPending}
      />
      <ChatInput
        key={`${projectId}-${sessionId}`}
        projectId={projectId}
        onSubmit={handleSubmit}
        isPending={isPending}
        error={error}
        placeholder={getPlaceholder()}
        buttonText={<Trans id="chat.send" />}
        containerClassName=""
        buttonSize="default"
        enableScheduledSend={!isRunning}
        baseSessionId={sessionId}
        disabled={isRunning}
        isQueueMode={isRunning}
      />
    </div>
  );
};

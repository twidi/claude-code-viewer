import { Trans, useLingui } from "@lingui/react";
import { type FC, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCreateSchedulerJob } from "@/hooks/useScheduler";
import { useConfig } from "../../../../../../hooks/useConfig";
import {
  ChatInput,
  type MessageInput,
  useContinueSessionProcessMutation,
  useCreateSessionProcessMutation,
} from "../../../../components/chatForm";
import { useInjectMessageMutation } from "../../hooks/useInjectMessageMutation";
import { usePendingPermissionMode } from "../../hooks/usePendingPermissionMode";
import { useStopSessionProcessMutation } from "../../hooks/useStopSessionProcessMutation";
import {
  type SendMessageOption,
  SendMessageOptionsDialog,
} from "../SendMessageOptionsDialog";

export const ContinueChat: FC<{
  projectId: string;
  sessionId: string;
  sessionProcessId: string;
  sessionProcessStatus?: "starting" | "pending" | "running" | "paused";
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
  const injectMessage = useInjectMessageMutation(sessionProcessId);
  const createSchedulerJob = useCreateSchedulerJob();
  const { config } = useConfig();
  const { pendingMode, clearPendingMode } = usePendingPermissionMode(sessionId);

  // Dialog state for send options when session is running
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<MessageInput | null>(
    null,
  );
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  // Track if session became available while dialog was open
  const [sessionBecameAvailable, setSessionBecameAvailable] = useState(false);
  // Message to restore to the input when user cancels
  const [messageToRestore, setMessageToRestore] = useState<MessageInput | null>(
    null,
  );

  // Detect when session becomes paused while dialog is open
  useEffect(() => {
    if (
      showOptionsDialog &&
      pendingMessage &&
      sessionProcessStatus === "paused"
    ) {
      setSessionBecameAvailable(true);
    }
  }, [sessionProcessStatus, showOptionsDialog, pendingMessage]);

  // Check if we need to change permission mode
  const needsPermissionChange =
    pendingMode !== null && pendingMode !== currentPermissionMode;

  const executeSendAction = async (
    action: SendMessageOption,
    input: MessageInput,
  ) => {
    switch (action) {
      case "inject":
        await injectMessage.mutateAsync(input);
        toast.success(
          i18n._({
            id: "chat.message.injected",
            message: "Message sent to Claude",
          }),
        );
        break;

      case "queue":
        await createSchedulerJob.mutateAsync({
          name: i18n._({
            id: "chat.queued_message.name",
            message: "Queued message",
          }),
          schedule: {
            type: "queued",
            targetSessionId: sessionId,
          },
          message: {
            content: input.text,
            projectId,
            baseSessionId: sessionId,
            images: input.images,
            documents: input.documents,
          },
          enabled: true,
        });
        toast.success(
          i18n._({
            id: "chat.queued_message.success",
            message: "Message queued",
          }),
          {
            description: i18n._({
              id: "chat.queued_message.success_description",
              message:
                "Your message will be sent when the current task completes",
            }),
          },
        );
        break;

      case "abort":
        await stopSessionProcess.mutateAsync(sessionProcessId);
        // After stop, session is in "completed" state, so we need to create a new session process
        await createSessionProcess.mutateAsync({
          input,
          baseSessionId: sessionId,
        });
        break;
    }
  };

  const closeDialog = () => {
    setShowOptionsDialog(false);
    setPendingMessage(null);
    setSessionBecameAvailable(false);
  };

  const handleDialogConfirm = async (option: SendMessageOption) => {
    if (!pendingMessage) return;

    setIsExecutingAction(true);
    try {
      await executeSendAction(option, pendingMessage);
      closeDialog();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (option === "inject") {
        toast.error(
          i18n._({
            id: "chat.message.inject_failed",
            message: "Failed to send message",
          }),
          { description: errorMessage },
        );
      } else if (option === "abort") {
        toast.error(
          i18n._({
            id: "chat.message.abort_failed",
            message: "Failed to stop session",
          }),
          { description: errorMessage },
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Handle "Send Now" when session became available
  const handleSendNow = async () => {
    if (!pendingMessage) return;

    setIsExecutingAction(true);
    try {
      await continueSessionProcess.mutateAsync({
        input: pendingMessage,
        sessionProcessId,
      });
      closeDialog();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      toast.error(
        i18n._({
          id: "chat.message.send_failed",
          message: "Failed to send message",
        }),
        { description: errorMessage },
      );
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Handle "Cancel" when session became available - restore message to input
  const handleCancelWithRestore = () => {
    setMessageToRestore(pendingMessage);
    closeDialog();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog();
    } else {
      setShowOptionsDialog(true);
    }
  };

  const handleSubmit = async (input: MessageInput) => {
    // Session is active if it's starting, pending, or running
    const isActiveSession =
      sessionProcessStatus === "starting" ||
      sessionProcessStatus === "pending" ||
      sessionProcessStatus === "running";

    // If session is active, show options dialog
    if (isActiveSession) {
      setPendingMessage(input);
      setShowOptionsDialog(true);
      return;
    }

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

  const isActiveSession =
    sessionProcessStatus === "starting" ||
    sessionProcessStatus === "pending" ||
    sessionProcessStatus === "running";
  const isPending =
    continueSessionProcess.isPending ||
    stopSessionProcess.isPending ||
    createSessionProcess.isPending ||
    isExecutingAction;
  const error =
    continueSessionProcess.error ||
    stopSessionProcess.error ||
    createSessionProcess.error;

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-3">
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
        enableScheduledSend={!isActiveSession}
        showQueueOption={isActiveSession}
        baseSessionId={sessionId}
        restoredMessage={messageToRestore}
        onMessageRestored={() => setMessageToRestore(null)}
      />
      <SendMessageOptionsDialog
        open={showOptionsDialog}
        onOpenChange={handleDialogOpenChange}
        onConfirm={handleDialogConfirm}
        isLoading={isExecutingAction}
        sessionBecameAvailable={sessionBecameAvailable}
        onSendNow={handleSendNow}
        onCancelWithRestore={handleCancelWithRestore}
      />
    </div>
  );
};

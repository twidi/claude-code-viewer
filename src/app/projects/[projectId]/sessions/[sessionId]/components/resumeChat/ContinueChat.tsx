import { Trans, useLingui } from "@lingui/react";
import { type FC, useState } from "react";
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

  const handleDialogConfirm = async (option: SendMessageOption) => {
    if (!pendingMessage) return;

    setIsExecutingAction(true);
    try {
      await executeSendAction(option, pendingMessage);
      setPendingMessage(null);
      setShowOptionsDialog(false);
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

  const handleSubmit = async (input: MessageInput) => {
    const isRunning = sessionProcessStatus === "running";

    // If session is running, show options dialog
    if (isRunning) {
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

  const isRunning = sessionProcessStatus === "running";
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
        enableScheduledSend={!isRunning}
        showQueueOption={isRunning}
        baseSessionId={sessionId}
      />
      <SendMessageOptionsDialog
        open={showOptionsDialog}
        onOpenChange={setShowOptionsDialog}
        onConfirm={handleDialogConfirm}
        isLoading={isExecutingAction}
      />
    </div>
  );
};

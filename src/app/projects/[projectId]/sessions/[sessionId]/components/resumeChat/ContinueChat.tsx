import { Trans, useLingui } from "@lingui/react";
import type { FC } from "react";
import { useConfig } from "../../../../../../hooks/useConfig";
import {
  ChatInput,
  type MessageInput,
  useContinueSessionProcessMutation,
  useCreateSessionProcessMutation,
} from "../../../../components/chatForm";
import { usePendingPermissionMode } from "../../hooks/usePendingPermissionMode";
import { useStopSessionProcessMutation } from "../../hooks/useStopSessionProcessMutation";

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

  // Check if we need to change permission mode
  const needsPermissionChange =
    pendingMode !== null && pendingMode !== currentPermissionMode;

  const handleSubmit = async (input: MessageInput) => {
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
    createSessionProcess.isPending;
  const error =
    continueSessionProcess.error ||
    stopSessionProcess.error ||
    createSessionProcess.error;

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-3">
      <ChatInput
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
      />
    </div>
  );
};

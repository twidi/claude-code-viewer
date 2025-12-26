import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { clearPendingMessagesForSession } from "@/app/projects/[projectId]/sessions/[sessionId]/hooks/usePendingMessages";
import { sendQueuedMessages } from "@/app/projects/[projectId]/sessions/[sessionId]/utils/sendQueuedMessages";
import {
  browserNotificationsEnabledAtom,
  notificationSettingsAtom,
  soundNotificationsEnabledAtom,
} from "@/lib/atoms/notifications";
import { queuedMessagesPanelOpenForSessionAtom } from "@/lib/atoms/queuedMessagesPanelAtom";
import {
  playNotificationSound,
  sendBrowserNotification,
} from "@/lib/notifications";
import type { PublicSessionProcess } from "@/types/session-process";

/**
 * Global hook to handle session transitions (running → paused) for all sessions.
 *
 * When any session completes (transitions from running to paused):
 * 1. Plays notification sound (if enabled)
 * 2. Shows "Task completed" toast
 * 3. Auto-sends any queued messages for that session
 *
 * This works regardless of which session is currently being viewed.
 */
export const useGlobalSessionTransitions = (
  sessionProcesses: PublicSessionProcess[],
) => {
  const settings = useAtomValue(notificationSettingsAtom);
  const soundEnabled = useAtomValue(soundNotificationsEnabledAtom);
  const browserNotificationsEnabled = useAtomValue(
    browserNotificationsEnabledAtom,
  );
  const queuedMessagesPanelOpenForSession = useAtomValue(
    queuedMessagesPanelOpenForSessionAtom,
  );

  // Track previous statuses by sessionId (not processId) to detect transitions
  // This is important because processId changes when we auto-send queued messages
  const prevStatusesRef = useRef<Map<string, "running" | "paused">>(new Map());

  const handleSessionCompleted = useCallback(
    (process: PublicSessionProcess) => {
      // Check if the panel is open for this session (ContinueChat handles it locally)
      const isPanelOpenForThisSession =
        queuedMessagesPanelOpenForSession === process.sessionId;

      // Check for queued messages (only if panel is not open)
      const pendingMessages = isPanelOpenForThisSession
        ? []
        : clearPendingMessagesForSession(process.sessionId);
      const willAutoSendMessages = pendingMessages.length > 0;

      // Show toast (only if app is visible)
      if (!document.hidden) {
        toast.success("Task completed");
      }

      // Play notification sound if enabled
      // BUT skip if we're about to auto-send messages (agent will restart immediately)
      // DO play if panel is open (user needs to review) or no messages to send
      if (soundEnabled && !willAutoSendMessages) {
        playNotificationSound(settings.soundType);
      }

      // Send browser notification if app is in background
      if (
        document.hidden &&
        browserNotificationsEnabled &&
        !willAutoSendMessages
      ) {
        sendBrowserNotification({
          title: "Task completed",
          tag: process.sessionId,
        });
      }

      // Auto-send queued messages
      if (willAutoSendMessages) {
        sendQueuedMessages({
          sessionProcessId: process.id,
          projectId: process.projectId,
          sessionId: process.sessionId,
          messages: pendingMessages,
        }).catch((error) => {
          toast.error("Failed to send queued messages");
          console.error("Failed to send queued messages:", error);
        });
      }
    },
    [
      soundEnabled,
      browserNotificationsEnabled,
      settings.soundType,
      queuedMessagesPanelOpenForSession,
    ],
  );

  useEffect(() => {
    const prevStatuses = prevStatusesRef.current;

    for (const process of sessionProcesses) {
      // Track by sessionId, not processId, because processId changes on restart
      const prevStatus = prevStatuses.get(process.sessionId);
      const currentStatus = process.status;

      // Detect transition from running to paused
      if (prevStatus === "running" && currentStatus === "paused") {
        handleSessionCompleted(process);
      }

      // Update tracked status
      prevStatuses.set(process.sessionId, currentStatus);
    }

    // Clean up sessions that no longer exist
    for (const sessionId of prevStatuses.keys()) {
      if (!sessionProcesses.some((p) => p.sessionId === sessionId)) {
        prevStatuses.delete(sessionId);
      }
    }
  }, [sessionProcesses, handleSessionCompleted]);
};

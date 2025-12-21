import { toast } from "sonner";
import { honoClient } from "@/lib/api/client";
import type { PendingMessage } from "../hooks/usePendingMessages";
import { formatQueuedMessages } from "./formatQueuedMessages";

export interface SendQueuedMessagesParams {
  sessionProcessId: string;
  projectId: string;
  sessionId: string;
  messages: PendingMessage[];
}

/**
 * Sends queued messages to continue a session process.
 * This is a shared utility used by both:
 * - ContinueChat component (manual "Send now" button)
 * - useGlobalSessionTransitions hook (auto-send on session pause)
 *
 * @param params - The parameters for sending queued messages
 * @returns Promise that resolves when the messages are sent
 * @throws Error if the API call fails
 */
export async function sendQueuedMessages({
  sessionProcessId,
  projectId,
  sessionId,
  messages,
}: SendQueuedMessagesParams): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  const formattedText = formatQueuedMessages(messages);

  toast.info(`Sending ${messages.length} queued message(s)...`);

  const response = await honoClient.api.cc["session-processes"][
    ":sessionProcessId"
  ].continue.$post(
    {
      param: { sessionProcessId },
      json: {
        projectId,
        baseSessionId: sessionId,
        input: {
          text: formattedText,
          images: [],
          documents: [],
        },
      },
    },
    {
      init: {
        signal: AbortSignal.timeout(20 * 1000),
      },
    },
  );

  if (!response.ok) {
    throw new Error(response.statusText);
  }
}

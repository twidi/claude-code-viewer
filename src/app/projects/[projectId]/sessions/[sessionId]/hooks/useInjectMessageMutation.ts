import { useMutation } from "@tanstack/react-query";
import { honoClient } from "@/lib/api/client";
import type { MessageInput } from "../../../components/chatForm";

/**
 * Hook to inject a message into a running session process.
 * The message will be sent to the agent via stdin streaming.
 * Only works for processes that are actively running (not paused/completed).
 */
export const useInjectMessageMutation = (sessionProcessId: string) => {
  return useMutation({
    mutationFn: async (input: MessageInput) => {
      const response = await honoClient.api.cc["session-processes"][
        ":sessionProcessId"
      ].inject.$post({
        param: { sessionProcessId },
        json: {
          text: input.text,
          images: input.images,
          documents: input.documents,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to inject message");
      }

      return response.json();
    },
  });
};

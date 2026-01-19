import { useMutation } from "@tanstack/react-query";
import { honoClient } from "@/lib/api/client";

/**
 * Hook to stop a session process gracefully (without error).
 * Used when changing permission mode - stops the old process before
 * starting a new one with the new mode.
 */
export const useStopSessionProcessMutation = (projectId: string) => {
  return useMutation({
    mutationFn: async (sessionProcessId: string) => {
      const response = await honoClient.api.cc["session-processes"][
        ":sessionProcessId"
      ].stop.$post({
        param: { sessionProcessId },
        json: { projectId },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
  });
};

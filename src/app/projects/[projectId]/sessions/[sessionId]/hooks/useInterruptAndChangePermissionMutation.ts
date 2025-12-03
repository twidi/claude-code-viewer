import { useMutation } from "@tanstack/react-query";
import { honoClient } from "@/lib/api/client";
import type { PermissionMode } from "@/types/session-process";

const CONTINUE_MESSAGE = "please continue";

export const useInterruptAndChangePermissionMutation = (projectId: string) => {
  return useMutation({
    mutationFn: async (options: {
      sessionProcessId: string;
      sessionId: string;
      newPermissionMode: PermissionMode;
    }) => {
      // Step 1: Abort the running process
      const abortResponse = await honoClient.api.cc["session-processes"][
        ":sessionProcessId"
      ].abort.$post({
        param: { sessionProcessId: options.sessionProcessId },
        json: { projectId },
      });

      if (!abortResponse.ok) {
        throw new Error(`Failed to abort process: ${abortResponse.statusText}`);
      }

      // Step 2: Create a new session process with "please continue" and the new permission mode
      const createResponse = await honoClient.api.cc["session-processes"].$post(
        {
          json: {
            projectId,
            baseSessionId: options.sessionId,
            input: { text: CONTINUE_MESSAGE },
            permissionModeOverride: options.newPermissionMode,
          },
        },
        {
          init: {
            signal: AbortSignal.timeout(20 * 1000),
          },
        },
      );

      if (!createResponse.ok) {
        throw new Error(
          `Failed to resume with new permission: ${createResponse.statusText}`,
        );
      }

      return createResponse.json();
    },
  });
};

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { honoClient } from "../../../../../lib/api/client";
import type { PermissionMode } from "../../../../../types/session-process";
import type { MessageInput } from "./ChatInput";

/**
 * Get current sessionId from URL search params.
 * This reads directly from window.location to get the current value
 * at the time of the call, not a stale React state.
 */
const getCurrentSessionIdFromUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId");
  return sessionId ?? undefined;
};

export const useCreateSessionProcessMutation = (
  projectId: string,
  onSuccess?: () => void,
) => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (options: {
      input: MessageInput;
      baseSessionId?: string;
      permissionModeOverride?: PermissionMode;
    }) => {
      const response = await honoClient.api.cc["session-processes"].$post(
        {
          json: {
            projectId,
            baseSessionId: options.baseSessionId,
            input: options.input,
            permissionModeOverride: options.permissionModeOverride,
          },
        },
        {
          init: {
            signal: AbortSignal.timeout(60 * 1000),
          },
        },
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
    onSuccess: async (response) => {
      onSuccess?.();

      // Only navigate if user is still on "new chat" page (no sessionId in URL)
      // This prevents forcing navigation if user switched to another session
      // while waiting for the new session to initialize.
      // We read directly from window.location because React state/refs may be stale
      // if the component was unmounted and remounted during the async operation.
      const currentSessionId = getCurrentSessionIdFromUrl();
      if (currentSessionId === undefined) {
        navigate({
          to: "/projects/$projectId/session",
          params: {
            projectId,
          },
          search: (prev) => ({
            ...prev,
            sessionId: response.sessionProcess.sessionId,
          }),
        });
      }
    },
  });
};

export const useContinueSessionProcessMutation = (
  projectId: string,
  baseSessionId: string,
) => {
  return useMutation({
    mutationFn: async (options: {
      input: MessageInput;
      sessionProcessId: string;
    }) => {
      const response = await honoClient.api.cc["session-processes"][
        ":sessionProcessId"
      ].continue.$post(
        {
          param: { sessionProcessId: options.sessionProcessId },
          json: {
            projectId: projectId,
            baseSessionId: baseSessionId,
            input: options.input,
          },
        },
        {
          init: {
            signal: AbortSignal.timeout(60 * 1000),
          },
        },
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
  });
};

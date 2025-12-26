import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { honoClient } from "../lib/api/client";

/**
 * Query key factory for session names
 */
const sessionNamesKeys = {
  all: ["sessionNames"] as const,
  list: () => [...sessionNamesKeys.all, "list"] as const,
};

/**
 * Hook to fetch all custom session names
 *
 * @example
 * const { data: sessionNames, isLoading } = useSessionNames();
 * const customName = sessionNames?.[sessionId];
 *
 * @returns Query result containing Record<sessionId, customName>
 */
export const useSessionNames = () => {
  return useQuery({
    queryKey: sessionNamesKeys.list(),
    queryFn: async (): Promise<Record<string, string>> => {
      const response = await honoClient.api["session-names"].$get();
      if (!response.ok) {
        throw new Error("Failed to fetch session names");
      }
      const data = await response.json();
      return data.names;
    },
  });
};

/**
 * Hook to set a custom name for a session
 *
 * @example
 * const setSessionName = useSetSessionName();
 *
 * setSessionName.mutate(
 *   { sessionId: "session-123", name: "My Custom Name" },
 *   { onSuccess: () => console.log("Name saved") }
 * );
 *
 * @returns Mutation result for setting a session name
 */
export const useSetSessionName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      name,
    }: {
      sessionId: string;
      name: string;
    }): Promise<{ success: boolean }> => {
      const response = await honoClient.api["session-names"][":sessionId"].$put(
        {
          param: { sessionId },
          json: { name },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to set session name");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionNamesKeys.list() });
    },
  });
};

/**
 * Hook to delete a custom session name (revert to auto-generated)
 *
 * @example
 * const deleteSessionName = useDeleteSessionName();
 *
 * deleteSessionName.mutate("session-123", {
 *   onSuccess: () => console.log("Name removed"),
 * });
 *
 * @returns Mutation result for deleting a session name
 */
export const useDeleteSessionName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<{ success: boolean }> => {
      const response = await honoClient.api["session-names"][
        ":sessionId"
      ].$delete({
        param: { sessionId },
      });

      if (!response.ok) {
        throw new Error("Failed to delete session name");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionNamesKeys.list() });
    },
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { honoClient } from "../lib/api/client";

/**
 * Query key factory for starred sessions queries
 */
export const starredSessionsKeys = {
  all: ["starred-sessions"] as const,
  list: () => [...starredSessionsKeys.all, "list"] as const,
};

/**
 * Hook to fetch all starred session IDs
 *
 * @example
 * const { data, isLoading } = useStarredSessions();
 * const starredIds = data?.starredSessionIds ?? [];
 *
 * @returns Query result containing array of starred session IDs
 */
export const useStarredSessions = () => {
  return useQuery({
    queryKey: starredSessionsKeys.list(),
    queryFn: async (): Promise<{ starredSessionIds: string[] }> => {
      const response = await honoClient.api["starred-sessions"].$get();
      if (!response.ok) {
        throw new Error("Failed to fetch starred sessions");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
};

/**
 * Hook to toggle the star status of a session
 *
 * @example
 * const toggleStar = useToggleStarredSession();
 *
 * toggleStar.mutate("session-123", {
 *   onSuccess: (data) => {
 *     console.log(data.isStarred ? "Starred" : "Unstarred");
 *   },
 * });
 *
 * @returns Mutation result for toggling star status
 */
export const useToggleStarredSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<{ isStarred: boolean }> => {
      const response = await honoClient.api["starred-sessions"][
        ":sessionId"
      ].toggle.$post({
        param: { sessionId },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle star");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: starredSessionsKeys.list(),
      });
    },
  });
};

/**
 * Hook to add a star to a session
 *
 * @example
 * const addStar = useAddStarredSession();
 * addStar.mutate("session-123");
 *
 * @returns Mutation result for adding a star
 */
export const useAddStarredSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<{ success: true }> => {
      const response = await honoClient.api["starred-sessions"][
        ":sessionId"
      ].$post({
        param: { sessionId },
      });

      if (!response.ok) {
        throw new Error("Failed to add star");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: starredSessionsKeys.list(),
      });
    },
  });
};

/**
 * Hook to remove a star from a session
 *
 * @example
 * const removeStar = useRemoveStarredSession();
 * removeStar.mutate("session-123");
 *
 * @returns Mutation result for removing a star
 */
export const useRemoveStarredSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<{ success: true }> => {
      const response = await honoClient.api["starred-sessions"][
        ":sessionId"
      ].$delete({
        param: { sessionId },
      });

      if (!response.ok) {
        throw new Error("Failed to remove star");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: starredSessionsKeys.list(),
      });
    },
  });
};

/**
 * Hook that returns a Set of starred session IDs for efficient lookup
 *
 * @example
 * const starredSet = useStarredSessionsSet();
 * const isStarred = starredSet.has("session-123");
 *
 * @returns Set of starred session IDs
 */
export const useStarredSessionsSet = () => {
  const { data } = useStarredSessions();
  return new Set(data?.starredSessionIds ?? []);
};

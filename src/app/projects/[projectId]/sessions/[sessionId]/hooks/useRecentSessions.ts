import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { recentSessionsQuery } from "../../../../../../lib/api/queries";

export const useRecentSessions = () => {
  return useSuspenseInfiniteQuery({
    queryKey: recentSessionsQuery().queryKey,
    queryFn: async ({ pageParam }) => {
      const result = await recentSessionsQuery(pageParam).queryFn();
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnReconnect: true,
  });
};

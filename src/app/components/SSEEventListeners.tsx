import { useQueryClient } from "@tanstack/react-query";
import type { FC, PropsWithChildren } from "react";
import {
  projectDetailQuery,
  recentSessionsQuery,
  schedulerJobsQuery,
  sessionDetailQuery,
} from "../../lib/api/queries";
import { useServerEventListener } from "../../lib/sse/hook/useServerEventListener";

export const SSEEventListeners: FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();

  useServerEventListener("sessionListChanged", async (event) => {
    await queryClient.invalidateQueries({
      queryKey: projectDetailQuery(event.projectId).queryKey,
    });
    await queryClient.invalidateQueries({
      queryKey: recentSessionsQuery().queryKey,
    });
  });

  useServerEventListener("sessionChanged", async (event) => {
    await queryClient.invalidateQueries({
      queryKey: sessionDetailQuery(event.projectId, event.sessionId).queryKey,
    });
  });

  useServerEventListener("agentSessionChanged", async (event) => {
    // Invalidate the specific agent-session query for this agentSessionId
    // Query key pattern: ["projects", projectId, "sessions", sessionId, "agent-sessions", agentId]
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          Array.isArray(queryKey) &&
          queryKey[0] === "projects" &&
          queryKey[1] === event.projectId &&
          queryKey[2] === "sessions" &&
          // queryKey[3] is sessionId - we don't filter by it since event doesn't include it
          queryKey[4] === "agent-sessions" &&
          queryKey[5] === event.agentSessionId
        );
      },
    });
  });

  useServerEventListener("schedulerJobsChanged", async () => {
    await queryClient.invalidateQueries({
      queryKey: schedulerJobsQuery.queryKey,
    });
  });

  return <>{children}</>;
};

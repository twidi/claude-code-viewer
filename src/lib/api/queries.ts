import type { FuzzySearchResult } from "../../server/core/file-system/functions/fuzzySearchFiles";
import type { DirectoryListingResult } from "../../server/core/file-system/functions/getDirectoryListing";
import type { FileCompletionResult } from "../../server/core/file-system/functions/getFileCompletion";
import { honoClient } from "./client";

export const authCheckQuery = {
  queryKey: ["auth", "check"],
  queryFn: async () => {
    const response = await honoClient.api.auth.check.$get();
    return await response.json();
  },
} as const;

export const projectListQuery = {
  queryKey: ["projects"],
  queryFn: async () => {
    const response = await honoClient.api.projects.$get({
      param: {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const directoryListingQuery = (
  currentPath?: string,
  showHidden?: boolean,
) =>
  ({
    queryKey: ["directory-listing", currentPath, showHidden],
    queryFn: async (): Promise<DirectoryListingResult> => {
      const response = await honoClient.api.fs["directory-browser"].$get({
        query: {
          ...(currentPath ? { currentPath } : {}),
          ...(showHidden !== undefined
            ? { showHidden: showHidden.toString() }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch directory listing");
      }

      return await response.json();
    },
  }) as const;

export const projectDetailQuery = (projectId: string, cursor?: string) =>
  ({
    queryKey: ["projects", projectId],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"].$get({
        param: { projectId },
        query: { cursor },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      return await response.json();
    },
  }) as const;

export const latestSessionQuery = (projectId: string) =>
  ({
    queryKey: ["projects", projectId, "latest-session"],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"][
        "latest-session"
      ].$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch latest session: ${response.statusText}`,
        );
      }

      return response.json();
    },
  }) as const;

export const sessionDetailQuery = (projectId: string, sessionId: string) =>
  ({
    queryKey: ["projects", projectId, "sessions", sessionId],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"].sessions[
        ":sessionId"
      ].$get({
        param: {
          projectId,
          sessionId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      return await response.json();
    },
  }) as const;

export const claudeCommandsQuery = (projectId: string) =>
  ({
    queryKey: ["claude-commands", projectId],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"][
        "claude-commands"
      ].$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch claude commands: ${response.statusText}`,
        );
      }

      return await response.json();
    },
  }) as const;

export const sessionProcessesQuery = {
  queryKey: ["sessionProcesses"],
  queryFn: async () => {
    const response = await honoClient.api.cc["session-processes"].$get({});

    if (!response.ok) {
      throw new Error(`Failed to fetch alive tasks: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const gitCurrentRevisionsQuery = (projectId: string) =>
  ({
    queryKey: ["git", "current-revisions", projectId],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"].git[
        "current-revisions"
      ].$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch current revisions: ${response.statusText}`,
        );
      }

      return await response.json();
    },
  }) as const;

export const gitFileStatusQuery = (projectId: string) =>
  ({
    queryKey: ["git", "file-status", projectId],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"].git[
        "file-status"
      ].$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file status: ${response.statusText}`);
      }

      return await response.json();
    },
  }) as const;

export const mcpListQuery = (projectId: string) =>
  ({
    queryKey: ["mcp", "list", projectId],
    queryFn: async () => {
      const response = await honoClient.api.projects[
        ":projectId"
      ].mcp.list.$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch MCP list: ${response.statusText}`);
      }

      return await response.json();
    },
  }) as const;

export const fileCompletionQuery = (projectId: string, basePath: string) =>
  ({
    queryKey: ["file-completion", projectId, basePath],
    queryFn: async (): Promise<FileCompletionResult> => {
      const response = await honoClient.api.fs["file-completion"].$get({
        query: { basePath, projectId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch file completion");
      }

      return await response.json();
    },
  }) as const;

export const fuzzySearchFilesQuery = (
  projectId: string,
  basePath: string,
  query: string,
  limit?: number,
) =>
  ({
    queryKey: ["fuzzy-search", projectId, basePath, query, limit],
    queryFn: async (): Promise<FuzzySearchResult> => {
      const response = await honoClient.api.fs["fuzzy-search"].$get({
        query: {
          projectId,
          basePath,
          query,
          ...(limit !== undefined ? { limit: limit.toString() } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to search files");
      }

      return await response.json();
    },
  }) as const;

export const configQuery = {
  queryKey: ["config"],
  queryFn: async () => {
    const response = await honoClient.api.config.$get();

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const systemVersionQuery = {
  queryKey: ["version"],
  queryFn: async () => {
    const response = await honoClient.api.version.$get();

    if (!response.ok) {
      throw new Error(`Failed to fetch system version: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const claudeCodeMetaQuery = {
  queryKey: ["cc", "meta"],
  queryFn: async () => {
    const response = await honoClient.api.cc.meta.$get();

    if (!response.ok) {
      throw new Error(
        `Failed to fetch system features: ${response.statusText}`,
      );
    }

    return await response.json();
  },
} as const;

export const claudeCodeFeaturesQuery = {
  queryKey: ["cc", "features"],
  queryFn: async () => {
    const response = await honoClient.api.cc.features.$get();

    if (!response.ok) {
      throw new Error(
        `Failed to fetch claude code features: ${response.statusText}`,
      );
    }

    return await response.json();
  },
} as const;

export const schedulerJobsQuery = {
  queryKey: ["scheduler", "jobs"],
  queryFn: async () => {
    const response = await honoClient.api.scheduler.jobs.$get();

    if (!response.ok) {
      throw new Error(`Failed to fetch scheduler jobs: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const featureFlagsQuery = {
  queryKey: ["flags"],
  queryFn: async () => {
    const response = await honoClient.api.flags.$get();

    if (!response.ok) {
      throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
    }

    return await response.json();
  },
} as const;

export const agentSessionQuery = (
  projectId: string,
  sessionId: string,
  agentId: string,
) =>
  ({
    queryKey: [
      "projects",
      projectId,
      "sessions",
      sessionId,
      "agent-sessions",
      agentId,
    ],
    queryFn: async () => {
      const response = await honoClient.api.projects[":projectId"].sessions[
        ":sessionId"
      ]["agent-sessions"][":agentId"].$get({
        param: { projectId, sessionId, agentId },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch agent session: ${response.statusText}`,
        );
      }

      return await response.json();
    },
  }) as const;

/**
 * Find a pending agent session by matching prompt and timestamp.
 *
 * This is a workaround for foreground Task execution where the agentId
 * is not available in the session's tool_use message until the task completes.
 * The frontend calls this when opening a TaskModal for a running task
 * to find the matching agent file and enable live updates.
 *
 * This is NOT a TanStack Query - it's a direct API call function because:
 * 1. We don't want caching (the result changes as the agent file is created)
 * 2. We call it imperatively when the modal opens
 * 3. Once resolved, we store the agentId in component state
 */
export const findPendingAgentSession = async (params: {
  projectId: string;
  sessionId: string;
  prompt: string;
  toolUseTimestamp: string;
  knownAgentIds: string[];
}): Promise<{ agentId: string | null }> => {
  const { projectId, sessionId, prompt, toolUseTimestamp, knownAgentIds } =
    params;

  const response = await honoClient.api.projects[":projectId"].sessions[
    ":sessionId"
  ]["agent-sessions"]["find-pending"].$post({
    param: { projectId, sessionId },
    json: { prompt, toolUseTimestamp, knownAgentIds },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to find pending agent session: ${response.statusText}`,
    );
  }

  return await response.json();
};

export const searchQuery = (
  query: string,
  options?: { limit?: number; projectId?: string },
) =>
  ({
    queryKey: ["search", query, options?.limit, options?.projectId],
    queryFn: async () => {
      const response = await honoClient.api.search.$get({
        query: {
          q: query,
          ...(options?.limit !== undefined
            ? { limit: options.limit.toString() }
            : {}),
          ...(options?.projectId ? { projectId: options.projectId } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to search: ${response.statusText}`);
      }

      return await response.json();
    },
  }) as const;

export const recentSessionsQuery = (cursor?: string) =>
  ({
    queryKey: ["sessions", "recent"],
    queryFn: async () => {
      const response = await honoClient.api.sessions.recent.$get({
        query: { cursor },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch recent sessions: ${response.statusText}`,
        );
      }

      return await response.json();
    },
  }) as const;

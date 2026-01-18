import z from "zod";

const sessionFileRegExp = /(?<projectId>.*?)\/(?<sessionId>.*?)\.jsonl$/;

// Agent file in subagents directory: {projectId}/{sessionId}/subagents/agent-{agentSessionId}.jsonl
const subagentsFileRegExp =
  /(?<projectId>.*?)\/(?<sessionId>.*?)\/subagents\/agent-(?<agentSessionId>.*?)\.jsonl$/;

// Legacy agent file at project root: {projectId}/agent-{agentSessionId}.jsonl
const flatAgentFileRegExp =
  /(?<projectId>.*?)\/agent-(?<agentSessionId>.*?)\.jsonl$/;

const sessionFileGroupSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
});

const subagentsFileGroupSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
  agentSessionId: z.string(),
});

const flatAgentFileGroupSchema = z.object({
  projectId: z.string(),
  agentSessionId: z.string(),
});

export type SessionFileMatch = {
  type: "session";
  projectId: string;
  sessionId: string;
};

export type AgentFileMatch = {
  type: "agent";
  projectId: string;
  sessionId: string | null;
  agentSessionId: string;
};

export type FileMatch = SessionFileMatch | AgentFileMatch | null;

/**
 * Parses a file path to determine if it's a regular session file or an agent session file.
 * Agent files in subagents directory take precedence in matching (checked first).
 * Legacy flat agent files (at project root) are also supported for backward compatibility.
 *
 * @param filePath - The relative file path from the claude projects directory
 * @returns FileMatch object with type and extracted IDs, or null if not a recognized file
 */
export const parseSessionFilePath = (filePath: string): FileMatch => {
  // Check for agent file in subagents directory first (most specific pattern)
  const subagentsMatch = filePath.match(subagentsFileRegExp);
  const subagentsGroups = subagentsFileGroupSchema.safeParse(
    subagentsMatch?.groups,
  );
  if (subagentsGroups.success) {
    return {
      type: "agent",
      projectId: subagentsGroups.data.projectId,
      sessionId: subagentsGroups.data.sessionId,
      agentSessionId: subagentsGroups.data.agentSessionId,
    };
  }

  // Check for legacy flat agent file at project root
  const flatAgentMatch = filePath.match(flatAgentFileRegExp);
  const flatAgentGroups = flatAgentFileGroupSchema.safeParse(
    flatAgentMatch?.groups,
  );
  if (flatAgentGroups.success) {
    return {
      type: "agent",
      projectId: flatAgentGroups.data.projectId,
      sessionId: null,
      agentSessionId: flatAgentGroups.data.agentSessionId,
    };
  }

  // Check for regular session file
  const sessionMatch = filePath.match(sessionFileRegExp);
  const sessionGroups = sessionFileGroupSchema.safeParse(sessionMatch?.groups);
  if (sessionGroups.success) {
    return {
      type: "session",
      projectId: sessionGroups.data.projectId,
      sessionId: sessionGroups.data.sessionId,
    };
  }

  return null;
};

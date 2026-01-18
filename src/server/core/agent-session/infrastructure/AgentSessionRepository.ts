import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { parseJsonl } from "../../claude-code/functions/parseJsonl";
import { decodeProjectId } from "../../project/functions/id";
import type { ExtendedConversation } from "../../types";

/**
 * Schema for the first message of an agent session file.
 * Used to extract agentId, timestamp, and prompt for matching pending tasks.
 */
interface AgentFirstMessage {
  agentId: string;
  timestamp: string;
  message: {
    role: string;
    content: string;
  };
}

/**
 * Parses the first line of an agent JSONL file to extract metadata.
 * Returns null if parsing fails or required fields are missing.
 */
const parseAgentFirstMessage = (
  firstLine: string,
): AgentFirstMessage | null => {
  try {
    const parsed = JSON.parse(firstLine);
    if (
      typeof parsed.agentId === "string" &&
      typeof parsed.timestamp === "string" &&
      parsed.message?.role === "user" &&
      typeof parsed.message?.content === "string"
    ) {
      return {
        agentId: parsed.agentId,
        timestamp: parsed.timestamp,
        message: {
          role: parsed.message.role,
          content: parsed.message.content,
        },
      };
    }
    return null;
  } catch {
    return null;
  }
};

const LayerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  /**
   * Get agent session conversations by agentId.
   * Tries subagents path first (${sessionId}/subagents/agent-${agentId}.jsonl),
   * then falls back to flat path (agent-${agentId}.jsonl at project root).
   * Returns null if neither file exists.
   */
  const getAgentSessionByAgentId = (
    projectId: string,
    sessionId: string,
    agentId: string,
  ): Effect.Effect<ExtendedConversation[] | null, Error> =>
    Effect.gen(function* () {
      const projectPath = decodeProjectId(projectId);

      // New format: ${sessionId}/subagents/agent-${agentId}.jsonl
      const subagentsFilePath = path.resolve(
        projectPath,
        sessionId,
        "subagents",
        `agent-${agentId}.jsonl`,
      );

      const subagentsPathExists = yield* fs.exists(subagentsFilePath);
      if (subagentsPathExists) {
        const content = yield* fs.readFileString(subagentsFilePath);
        return parseJsonl(content);
      }

      // Legacy format: agent-${agentId}.jsonl at project root
      const flatFilePath = path.resolve(projectPath, `agent-${agentId}.jsonl`);

      const flatPathExists = yield* fs.exists(flatFilePath);
      if (flatPathExists) {
        const content = yield* fs.readFileString(flatFilePath);
        return parseJsonl(content);
      }

      return null;
    });

  /**
   * Find a pending agent session by matching prompt and timestamp.
   *
   * This is a workaround for foreground Task execution where the agentId
   * is not available in the session's tool_use message until the task completes.
   * We find the matching agent by:
   * 1. Listing all agent-*.jsonl files in the subagents directory
   * 2. Excluding agents already known (passed in knownAgentIds)
   * 3. Excluding agents with timestamp before the tool_use timestamp
   * 4. Matching by prompt content
   *
   * @param projectId - The encoded project ID
   * @param sessionId - The session ID (used for subagents directory path)
   * @param prompt - The Task prompt to match
   * @param toolUseTimestamp - The timestamp of the tool_use message
   * @param knownAgentIds - Agent IDs already mapped to tool_use IDs (to exclude)
   * @returns The matching agentId or null if not found
   */
  const findPendingAgentSession = (
    projectId: string,
    sessionId: string,
    prompt: string,
    toolUseTimestamp: string,
    knownAgentIds: string[],
  ): Effect.Effect<string | null, Error> =>
    Effect.gen(function* () {
      const projectPath = decodeProjectId(projectId);
      const subagentsDir = path.resolve(projectPath, sessionId, "subagents");

      // Check if subagents directory exists
      const dirExists = yield* fs.exists(subagentsDir);
      if (!dirExists) {
        return null;
      }

      // List all files in subagents directory
      const files = yield* fs.readDirectory(subagentsDir);

      // Filter to agent-*.jsonl files
      const agentFiles = files.filter(
        (file) => file.startsWith("agent-") && file.endsWith(".jsonl"),
      );

      // Parse tool_use timestamp for comparison
      const toolUseDate = new Date(toolUseTimestamp);

      // Check each agent file
      for (const file of agentFiles) {
        // Extract agentId from filename (agent-{agentId}.jsonl)
        const match = file.match(/^agent-(.+)\.jsonl$/);
        if (!match) continue;

        const agentId = match[1];
        if (agentId === undefined) continue;

        // Skip if this agent is already known/mapped
        if (knownAgentIds.includes(agentId)) continue;

        // Read first line of the file to get metadata
        const filePath = path.resolve(subagentsDir, file);
        const content = yield* fs.readFileString(filePath);
        const firstLine = content.split("\n")[0];
        if (!firstLine) continue;

        const firstMessage = parseAgentFirstMessage(firstLine);
        if (!firstMessage) continue;

        // Skip if agent timestamp is before tool_use timestamp
        const agentDate = new Date(firstMessage.timestamp);
        if (agentDate < toolUseDate) continue;

        // Match by prompt content
        if (firstMessage.message.content === prompt) {
          return agentId;
        }
      }

      return null;
    });

  return {
    getAgentSessionByAgentId,
    findPendingAgentSession,
  };
});

export class AgentSessionRepository extends Context.Tag(
  "AgentSessionRepository",
)<
  AgentSessionRepository,
  {
    readonly getAgentSessionByAgentId: (
      projectId: string,
      sessionId: string,
      agentId: string,
    ) => Effect.Effect<ExtendedConversation[] | null, Error>;
    readonly findPendingAgentSession: (
      projectId: string,
      sessionId: string,
      prompt: string,
      toolUseTimestamp: string,
      knownAgentIds: string[],
    ) => Effect.Effect<string | null, Error>;
  }
>() {
  static Live = Layer.effect(this, LayerImpl);
}

export type IAgentSessionRepository = Context.Tag.Service<
  typeof AgentSessionRepository
>;

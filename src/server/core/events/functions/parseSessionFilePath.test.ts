import { describe, expect, it } from "vitest";
import { parseSessionFilePath } from "./parseSessionFilePath";

describe("parseSessionFilePath", () => {
  describe("regular session files", () => {
    it("parses simple session file path", () => {
      const result = parseSessionFilePath("project-name/session-id.jsonl");
      expect(result).toEqual({
        type: "session",
        projectId: "project-name",
        sessionId: "session-id",
      });
    });

    it("parses session file with UUID-like session ID", () => {
      const result = parseSessionFilePath(
        "my-project/550e8400-e29b-41d4-a716-446655440000.jsonl",
      );
      expect(result).toEqual({
        type: "session",
        projectId: "my-project",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("parses session file with nested path (non-greedy first match)", () => {
      // The regex is non-greedy, so it matches the first slash
      // In practice, the projectId is just the first directory component
      // The encodeProjectIdFromSessionFilePath function handles proper encoding
      const result = parseSessionFilePath(
        "home/user/projects/my-app/session123.jsonl",
      );
      expect(result).toEqual({
        type: "session",
        projectId: "home",
        sessionId: "user/projects/my-app/session123",
      });
    });
  });

  describe("agent session files in subagents directory", () => {
    it("parses agent file in subagents directory", () => {
      const result = parseSessionFilePath(
        "project-name/session-id/subagents/agent-abc123.jsonl",
      );
      expect(result).toEqual({
        type: "agent",
        projectId: "project-name",
        sessionId: "session-id",
        agentSessionId: "abc123",
      });
    });

    it("parses agent file with UUID-like IDs", () => {
      const result = parseSessionFilePath(
        "my-project/550e8400-e29b-41d4-a716-446655440000/subagents/agent-a1b2c3d.jsonl",
      );
      expect(result).toEqual({
        type: "agent",
        projectId: "my-project",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        agentSessionId: "a1b2c3d",
      });
    });

    it("parses agent file with complex project path", () => {
      const result = parseSessionFilePath(
        "-home-twidi-dev-claude-code-viewer/23bd8b05-5ca4-467c-ae56-bea71289107f/subagents/agent-aa63fb8.jsonl",
      );
      expect(result).toEqual({
        type: "agent",
        projectId: "-home-twidi-dev-claude-code-viewer",
        sessionId: "23bd8b05-5ca4-467c-ae56-bea71289107f",
        agentSessionId: "aa63fb8",
      });
    });
  });

  describe("legacy flat agent files at project root", () => {
    it("parses agent file with simple hash", () => {
      const result = parseSessionFilePath("project-name/agent-abc123.jsonl");
      expect(result).toEqual({
        type: "agent",
        projectId: "project-name",
        sessionId: null,
        agentSessionId: "abc123",
      });
    });

    it("parses agent file with UUID-like agent ID", () => {
      const result = parseSessionFilePath(
        "my-project/agent-550e8400-e29b-41d4-a716-446655440000.jsonl",
      );
      expect(result).toEqual({
        type: "agent",
        projectId: "my-project",
        sessionId: null,
        agentSessionId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("parses agent file with complex project path", () => {
      const result = parseSessionFilePath(
        "-home-twidi-dev-claude-code-viewer/agent-aa63fb8.jsonl",
      );
      expect(result).toEqual({
        type: "agent",
        projectId: "-home-twidi-dev-claude-code-viewer",
        sessionId: null,
        agentSessionId: "aa63fb8",
      });
    });
  });

  describe("non-matching files", () => {
    it("returns null for non-jsonl files", () => {
      expect(parseSessionFilePath("project/session.json")).toBeNull();
    });

    it("returns null for directories", () => {
      expect(parseSessionFilePath("project/session")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseSessionFilePath("")).toBeNull();
    });

    it("returns null for jsonl file without directory", () => {
      // Path must have at least one directory separator
      expect(parseSessionFilePath("session.jsonl")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles project name containing 'agent' but not as prefix", () => {
      // my-agent-project/session.jsonl should be a session file
      const result = parseSessionFilePath("my-agent-project/session-id.jsonl");
      expect(result).toEqual({
        type: "session",
        projectId: "my-agent-project",
        sessionId: "session-id",
      });
    });

    it("correctly identifies agent- prefix at filename level, not path level", () => {
      // agent-project/session.jsonl - the agent- is in directory, not filename
      const result = parseSessionFilePath("agent-project/session-id.jsonl");
      expect(result).toEqual({
        type: "session",
        projectId: "agent-project",
        sessionId: "session-id",
      });
    });

    it("agent file in agent-prefixed directory", () => {
      // agent-project/agent-hash.jsonl
      const result = parseSessionFilePath("agent-project/agent-abc123.jsonl");
      expect(result).toEqual({
        type: "agent",
        projectId: "agent-project",
        sessionId: null,
        agentSessionId: "abc123",
      });
    });
  });
});

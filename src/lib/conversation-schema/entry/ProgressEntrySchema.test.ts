import { describe, expect, test } from "vitest";
import { ProgressEntrySchema } from "./ProgressEntrySchema";

// Base fields that all progress entries share
const baseProgressEntry = {
  parentUuid: "ec45e11d-bb12-43fb-bb58-4858408563df",
  isSidechain: false,
  userType: "external",
  cwd: "/home/user/project",
  sessionId: "23bd8b05-5ca4-467c-ae56-bea71289107f",
  version: "2.1.12",
  gitBranch: "main",
  slug: "distributed-snuggling-cerf",
  type: "progress",
  toolUseID: "toolu_01EHPDMhLCHueprjx13rzwLo",
  parentToolUseID: "toolu_01EHPDMhLCHueprjx13rzwLo",
  uuid: "4e4138aa-67e5-4ee4-9ae4-33d9655f9ebe",
  timestamp: "2026-01-18T20:21:42.527Z",
} as const;

describe("ProgressEntrySchema", () => {
  describe("hook_progress", () => {
    test("accepts basic hook_progress entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "hook_progress",
          hookEvent: "PreToolUse",
          hookName: "PreToolUse:Bash",
          command: "node ${CLAUDE_PLUGIN_ROOT}/dist/index.js",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts hook_progress with optional fields (v2.1.12+)", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "hook_progress",
          hookEvent: "SessionStart",
          hookName: "SessionStart:resume",
          command:
            '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start.sh',
          promptText: "Some prompt text",
          statusMessage: "Running hook...",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts various hookEvent types", () => {
      const hookEvents = [
        "PreToolUse",
        "PostToolUse",
        "SessionStart",
        "Stop",
        "SubagentStop",
      ];
      for (const hookEvent of hookEvents) {
        const result = ProgressEntrySchema.safeParse({
          ...baseProgressEntry,
          data: {
            type: "hook_progress",
            hookEvent,
            hookName: `${hookEvent}:test`,
            command: "test command",
          },
        });
        expect(result.success, `hookEvent ${hookEvent} should be valid`).toBe(
          true,
        );
      }
    });
  });

  describe("bash_progress", () => {
    test("accepts bash_progress entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        toolUseID: "bash-progress-0",
        data: {
          type: "bash_progress",
          output: "",
          fullOutput: "",
          elapsedTimeSeconds: 2,
          totalLines: 0,
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts bash_progress with output", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        toolUseID: "bash-progress-5",
        data: {
          type: "bash_progress",
          output: "Building...\nCompiling...",
          fullOutput: "Building...\nCompiling...\nDone!",
          elapsedTimeSeconds: 15,
          totalLines: 42,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("agent_progress", () => {
    test("accepts basic agent_progress entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        isSidechain: true,
        agentId: "a819f10",
        toolUseID: "agent_msg_01YQJbZdkrVVsEYLZptED85J",
        data: {
          type: "agent_progress",
          prompt: "Search for files",
          agentId: "a819f10",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts agent_progress with message and normalizedMessages", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        isSidechain: true,
        agentId: "a819f10",
        data: {
          type: "agent_progress",
          prompt: "Search for files",
          agentId: "a819f10",
          message: { type: "user", content: "test" },
          normalizedMessages: [{ type: "assistant", content: "response" }],
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts agent_progress with resume field", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "agent_progress",
          prompt: "Continue task",
          agentId: "b920e21",
          resume: { previousState: "some state" },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("query_update", () => {
    test("accepts query_update entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        toolUseID: "search-progress-1",
        data: {
          type: "query_update",
          query: "React hooks documentation 2026",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("search_results_received", () => {
    test("accepts search_results_received entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        toolUseID: "search-progress-2",
        data: {
          type: "search_results_received",
          resultCount: 10,
          query: "React hooks documentation",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts search_results_received with zero results", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "search_results_received",
          resultCount: 0,
          query: "nonexistent query",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("mcp_progress", () => {
    test("accepts mcp_progress with started status", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "mcp_progress",
          status: "started",
          serverName: "my-mcp-server",
          toolName: "fetch_data",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts mcp_progress with completed status and elapsedTimeMs", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "mcp_progress",
          status: "completed",
          serverName: "my-mcp-server",
          toolName: "fetch_data",
          elapsedTimeMs: 1523,
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts mcp_progress with failed status", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "mcp_progress",
          status: "failed",
          serverName: "my-mcp-server",
          toolName: "fetch_data",
          elapsedTimeMs: 500,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("skill_progress", () => {
    test("accepts skill_progress entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "skill_progress",
          prompt: "Run commit skill",
          agentId: "skill-123",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("task_progress", () => {
    test("accepts task_progress entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "task_progress",
          taskId: "task-456",
          taskType: "background",
          message: "Task is running...",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("waiting_for_task", () => {
    test("accepts waiting_for_task entry", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "waiting_for_task",
          taskDescription: "Waiting for user input",
          taskType: "user_input",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("tool_progress", () => {
    test("accepts tool_progress entry (SDK format)", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "tool_progress",
          tool_use_id: "toolu_01ABC123",
          tool_name: "Bash",
          parent_tool_use_id: null,
          elapsed_time_seconds: 5.2,
          session_id: "23bd8b05-5ca4-467c-ae56-bea71289107f",
        },
      });
      expect(result.success).toBe(true);
    });

    test("accepts tool_progress with parent_tool_use_id", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "tool_progress",
          tool_use_id: "toolu_01ABC123",
          tool_name: "Read",
          parent_tool_use_id: "toolu_01PARENT",
          elapsed_time_seconds: 1.5,
          session_id: "23bd8b05-5ca4-467c-ae56-bea71289107f",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("validation errors", () => {
    test("rejects missing data field", () => {
      const entry = { ...baseProgressEntry };
      // @ts-expect-error - intentionally testing invalid input
      delete entry.data;
      const result = ProgressEntrySchema.safeParse(entry);
      expect(result.success).toBe(false);
    });

    test("rejects invalid data type", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "invalid_progress_type",
          someField: "value",
        },
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing required data fields", () => {
      const result = ProgressEntrySchema.safeParse({
        ...baseProgressEntry,
        data: {
          type: "hook_progress",
          // missing hookEvent, hookName, command
        },
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing toolUseID", () => {
      const { toolUseID: _, ...entryWithoutToolUseID } = baseProgressEntry;
      const result = ProgressEntrySchema.safeParse({
        ...entryWithoutToolUseID,
        data: {
          type: "hook_progress",
          hookEvent: "PreToolUse",
          hookName: "PreToolUse:Bash",
          command: "test",
        },
      });
      expect(result.success).toBe(false);
    });

    test("accepts entry without slug (slug is optional)", () => {
      const { slug: _, ...entryWithoutSlug } = baseProgressEntry;
      const result = ProgressEntrySchema.safeParse({
        ...entryWithoutSlug,
        data: {
          type: "hook_progress",
          hookEvent: "PreToolUse",
          hookName: "PreToolUse:Bash",
          command: "test",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("real-world entries from JSONL", () => {
    test("parses actual hook_progress entry from session", () => {
      const realEntry = {
        parentUuid: "ec45e11d-bb12-43fb-bb58-4858408563df",
        isSidechain: false,
        userType: "external",
        cwd: "/home/twidi/dev/claude-code-viewer",
        sessionId: "23bd8b05-5ca4-467c-ae56-bea71289107f",
        version: "2.1.12",
        gitBranch: "twidi-updates",
        slug: "distributed-snuggling-cerf",
        type: "progress",
        data: {
          type: "hook_progress",
          hookEvent: "SessionStart",
          hookName: "SessionStart:resume",
          command:
            '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start.sh',
        },
        parentToolUseID: "f87735d0-4970-4ac3-a036-91a385a3bd65",
        toolUseID: "f87735d0-4970-4ac3-a036-91a385a3bd65",
        timestamp: "2026-01-18T01:45:30.073Z",
        uuid: "0e4d3301-779e-4f8c-b2cc-b4dd21c3e259",
      };
      const result = ProgressEntrySchema.safeParse(realEntry);
      expect(result.success).toBe(true);
    });

    test("parses actual bash_progress entry from session", () => {
      const realEntry = {
        parentUuid: "4e4138aa-67e5-4ee4-9ae4-33d9655f9ebe",
        isSidechain: true,
        userType: "external",
        cwd: "/home/twidi/dev/claude-code-viewer",
        sessionId: "23bd8b05-5ca4-467c-ae56-bea71289107f",
        version: "2.1.12",
        gitBranch: "twidi-updates",
        agentId: "a819f10",
        slug: "distributed-snuggling-cerf",
        type: "progress",
        data: {
          type: "bash_progress",
          output: "",
          fullOutput: "",
          elapsedTimeSeconds: 2,
          totalLines: 0,
        },
        toolUseID: "bash-progress-0",
        parentToolUseID: "toolu_01EHPDMhLCHueprjx13rzwLo",
        uuid: "9dd2e062-8ed6-41bc-826f-d017e9a2fe35",
        timestamp: "2026-01-18T20:21:44.713Z",
      };
      const result = ProgressEntrySchema.safeParse(realEntry);
      expect(result.success).toBe(true);
    });
  });
});

import { z } from "zod";
import { BaseEntrySchema } from "./BaseEntrySchema";

// Hook progress - tracks hook execution during tool use
const HookProgressDataSchema = z.object({
  type: z.literal("hook_progress"),
  hookEvent: z.string(), // "PreToolUse", "PostToolUse", "SessionStart", "Stop", etc.
  hookName: z.string(), // e.g., "PreToolUse:Bash"
  command: z.string(),
  promptText: z.string().optional(), // v2.1.12+
  statusMessage: z.string().optional(), // v2.1.12+
});

// Bash progress - tracks bash command execution progress
const BashProgressDataSchema = z.object({
  type: z.literal("bash_progress"),
  output: z.string(),
  fullOutput: z.string(),
  elapsedTimeSeconds: z.number(),
  totalLines: z.number(),
});

// Agent progress - tracks sub-agent execution
const AgentProgressDataSchema = z.object({
  type: z.literal("agent_progress"),
  prompt: z.string(),
  agentId: z.string(),
  message: z.unknown().optional(), // Message object structure varies
  normalizedMessages: z.array(z.unknown()).optional(),
  resume: z.unknown().optional(),
});

// Query update - tracks search query updates
const QueryUpdateDataSchema = z.object({
  type: z.literal("query_update"),
  query: z.string(),
});

// Search results received - tracks web search results
const SearchResultsReceivedDataSchema = z.object({
  type: z.literal("search_results_received"),
  resultCount: z.number(),
  query: z.string(),
});

// MCP progress - tracks MCP tool execution
const McpProgressDataSchema = z.object({
  type: z.literal("mcp_progress"),
  status: z.enum(["started", "completed", "failed"]),
  serverName: z.string(),
  toolName: z.string(),
  elapsedTimeMs: z.number().optional(),
});

// Skill progress - tracks skill execution
const SkillProgressDataSchema = z.object({
  type: z.literal("skill_progress"),
  prompt: z.string(),
  agentId: z.string(),
});

// Task progress - tracks task execution
const TaskProgressDataSchema = z.object({
  type: z.literal("task_progress"),
  taskId: z.string(),
  taskType: z.string(),
  message: z.string(),
});

// Waiting for task - indicates waiting state
const WaitingForTaskDataSchema = z.object({
  type: z.literal("waiting_for_task"),
  taskDescription: z.string(),
  taskType: z.string(),
});

// Tool progress - generic tool progress (SDK format)
const ToolProgressDataSchema = z.object({
  type: z.literal("tool_progress"),
  tool_use_id: z.string(),
  tool_name: z.string(),
  parent_tool_use_id: z.string().nullable(),
  elapsed_time_seconds: z.number(),
  session_id: z.string(),
});

// Union of all progress data types
const ProgressDataSchema = z.union([
  HookProgressDataSchema,
  BashProgressDataSchema,
  AgentProgressDataSchema,
  QueryUpdateDataSchema,
  SearchResultsReceivedDataSchema,
  McpProgressDataSchema,
  SkillProgressDataSchema,
  TaskProgressDataSchema,
  WaitingForTaskDataSchema,
  ToolProgressDataSchema,
]);

// Progress entry extends base with progress-specific fields
export const ProgressEntrySchema = BaseEntrySchema.extend({
  type: z.literal("progress"),
  data: ProgressDataSchema,
  toolUseID: z.string(),
  parentToolUseID: z.string(),
  // slug may not be present in all progress entries (e.g., SessionStart:startup)
  slug: z.string().optional(),
  // agentId appears at entry level for sidechain agents
  agentId: z.string().optional(),
});

export type ProgressEntry = z.infer<typeof ProgressEntrySchema>;
export type ProgressData = z.infer<typeof ProgressDataSchema>;

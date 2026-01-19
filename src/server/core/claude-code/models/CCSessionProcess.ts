import { Effect } from "effect";
import type { UserEntry } from "../../../../lib/conversation-schema/entry/UserEntrySchema";
import type { SessionProcessStatus } from "../../../../types/session-process";
import type { UserConfig } from "../../../lib/config/config";
import type { UserMessageInput } from "../functions/createMessageGenerator";
import type { InitMessageContext } from "../types";
import * as ClaudeCode from "./ClaudeCode";
import type * as CCTask from "./ClaudeCodeTask";
import * as ClaudeCodeVersion from "./ClaudeCodeVersion";

export type CCSessionProcessDef = {
  sessionProcessId: string;
  projectId: string;
  cwd: string;
  abortController: AbortController;
  setNextMessage: (input: UserMessageInput) => void;
  permissionMode: NonNullable<UserConfig["permissionMode"]>;
};

type CCSessionProcessStateBase = {
  def: CCSessionProcessDef;
  tasks: CCTask.ClaudeCodeTaskState[];
};

export type CCSessionProcessPendingState = CCSessionProcessStateBase & {
  type: "pending" /* メッセージがまだ解決されていない状態 */;
  sessionId?: undefined;
  currentTask: CCTask.PendingClaudeCodeTaskState;
};

export type CCSessionProcessNotInitializedState = CCSessionProcessStateBase & {
  type: "not_initialized" /* メッセージは解決されているが、init メッセージを未受信 */;
  sessionId?: undefined;
  currentTask: CCTask.RunningClaudeCodeTaskState;
  rawUserMessage: string;
};

export type CCSessionProcessInitializedState = CCSessionProcessStateBase & {
  type: "initialized" /* init メッセージを受信した状態 */;
  sessionId: string;
  currentTask: CCTask.RunningClaudeCodeTaskState;
  rawUserMessage: string;
  initContext: InitMessageContext;
};

export type CCSessionProcessFileCreatedState = CCSessionProcessStateBase & {
  type: "file_created" /* ファイルが作成された状態 */;
  sessionId: string;
  currentTask: CCTask.RunningClaudeCodeTaskState;
  rawUserMessage: string;
  initContext: InitMessageContext;
};

export type CCSessionProcessPausedState = CCSessionProcessStateBase & {
  type: "paused" /* タスクが完了し、次のタスクを受け付け可能 */;
  sessionId: string;
};

export type CCSessionProcessCompletedState = CCSessionProcessStateBase & {
  type: "completed" /* paused あるいは起動中のタスクが中断された状態。再開不可 */;
  sessionId?: string | undefined;
};

export type CCSessionProcessStatePublic =
  | CCSessionProcessPendingState
  | CCSessionProcessNotInitializedState
  | CCSessionProcessInitializedState
  | CCSessionProcessFileCreatedState
  | CCSessionProcessPausedState;

export type CCSessionProcessState =
  | CCSessionProcessStatePublic
  | CCSessionProcessCompletedState;

export const isPublic = (
  process: CCSessionProcessState,
): process is CCSessionProcessStatePublic => {
  return process.type !== "completed";
};

/**
 * Determines the public status to expose for a session process.
 *
 * - "starting": New conversation or resume after abort/backend restart (first task)
 * - "pending": Continuation of existing session, waiting for Claude to start
 * - "running": Claude is actively working
 * - "paused": Waiting for user input
 */
export const getPublicStatus = (
  process: CCSessionProcessStatePublic,
): SessionProcessStatus => {
  switch (process.type) {
    case "paused":
      return "paused";
    case "initialized":
    case "file_created":
      return "running";
    case "pending":
    case "not_initialized":
      // First task means new conversation or resume after abort/backend restart
      // More than one task means continuation of existing session
      return process.tasks.length === 1 ? "starting" : "pending";
  }
};

/**
 * Gets the session ID for a public session process.
 *
 * For initialized states, uses the confirmed sessionId.
 * For pending/not_initialized states, uses the baseSessionId from the current task
 * (available for continue/resume tasks, undefined for new conversations).
 */
export const getSessionId = (
  process: CCSessionProcessStatePublic,
): string | undefined => {
  // For states that have a confirmed sessionId
  if (
    process.type === "paused" ||
    process.type === "initialized" ||
    process.type === "file_created"
  ) {
    return process.sessionId;
  }

  // For pending/not_initialized, get sessionId or baseSessionId from current task
  const taskDef = process.currentTask.def;
  if (taskDef.type === "continue") {
    return taskDef.sessionId;
  }
  if (taskDef.type === "resume") {
    return taskDef.baseSessionId;
  }

  // For "new" task type, there's no sessionId yet
  return undefined;
};

export const getAliveTasks = (
  process: CCSessionProcessState,
): CCTask.AliveClaudeCodeTaskState[] => {
  return process.tasks.filter(
    (task) => task.status === "pending" || task.status === "running",
  );
};

export const createVirtualConversation = (
  process: CCSessionProcessState,
  ctx: {
    sessionId: string;
    userMessage: string;
  },
) => {
  const timestamp = new Date().toISOString();

  return Effect.gen(function* () {
    const config = yield* ClaudeCode.Config;

    const virtualConversation: UserEntry = {
      type: "user",
      message: {
        role: "user",
        content: ctx.userMessage,
      },
      isSidechain: false,
      userType: "external",
      cwd: process.def.cwd,
      sessionId: ctx.sessionId,
      version: config.claudeCodeVersion
        ? ClaudeCodeVersion.versionText(config.claudeCodeVersion)
        : "unknown",
      uuid: `vc__${ctx.sessionId}__${timestamp}`,
      timestamp,
      parentUuid: null,
    };

    return virtualConversation;
  });
};

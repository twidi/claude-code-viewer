export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan";

export type SessionProcessStatus =
  | "starting" // New conversation or resume after abort/backend restart (tasks.length === 1, state pending/not_initialized)
  | "pending" // Continuation of existing session, waiting for Claude to start (tasks.length > 1, state pending/not_initialized)
  | "running" // Claude is actively working (state initialized/file_created)
  | "paused"; // Waiting for user input (state paused)

export type PublicSessionProcess = {
  id: string;
  projectId: string;
  sessionId: string;
  status: SessionProcessStatus;
  permissionMode: PermissionMode;
};

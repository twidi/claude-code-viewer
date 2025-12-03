export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan";

export type PublicSessionProcess = {
  id: string;
  projectId: string;
  sessionId: string;
  status: "paused" | "running";
  permissionMode: PermissionMode;
};

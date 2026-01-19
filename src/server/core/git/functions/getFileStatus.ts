import { executeGitCommand, isGitRepository } from "./utils";

/**
 * File status types for the file explorer
 */
export type FileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked";

/**
 * Response from getFileStatus
 */
export interface FileStatusResponse {
  isGitRepo: boolean;
  files: Record<string, FileStatus>;
}

/**
 * Parse a status code from git status --porcelain output to FileStatus
 *
 * Git status --porcelain format:
 * - First character: index (staging area) status
 * - Second character: working tree status
 *
 * Status codes:
 * - ' ' = unmodified
 * - 'M' = modified
 * - 'A' = added
 * - 'D' = deleted
 * - 'R' = renamed
 * - 'C' = copied
 * - '?' = untracked
 */
function parseStatusCode(statusCode: string): FileStatus | null {
  const indexStatus = statusCode[0];
  const workingTreeStatus = statusCode[1];

  // Untracked files
  if (indexStatus === "?" && workingTreeStatus === "?") {
    return "untracked";
  }

  // Check index status first (staged changes take priority)
  switch (indexStatus) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      // Treat copied as added for file explorer purposes
      return "added";
  }

  // Check working tree status
  switch (workingTreeStatus) {
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "A":
      return "added";
  }

  return null;
}

/**
 * Parse a single line from git status --porcelain output
 *
 * Format: XY PATH or XY ORIG_PATH -> NEW_PATH (for renames)
 */
function parseStatusLine(
  line: string,
): { path: string; status: FileStatus } | null {
  if (line.length < 4) {
    return null;
  }

  const statusCode = line.slice(0, 2);
  const pathPart = line.slice(3);

  const status = parseStatusCode(statusCode);
  if (status === null) {
    return null;
  }

  // Handle renamed files: "R  old-name.ts -> new-name.ts"
  // We need to extract the new name (after the last " -> ")
  if (status === "renamed") {
    const arrowIndex = pathPart.lastIndexOf(" -> ");
    if (arrowIndex !== -1) {
      const newPath = pathPart.slice(arrowIndex + 4);
      return { path: newPath, status };
    }
  }

  return { path: pathPart, status };
}

/**
 * Get the git status of files in a directory
 *
 * Uses `git status --porcelain` to get a machine-readable output
 * and parses it into a map of file paths to their statuses.
 *
 * @param cwd - The directory to check (should be within a git repository)
 * @returns FileStatusResponse with isGitRepo flag and files map
 */
export async function getFileStatus(cwd: string): Promise<FileStatusResponse> {
  // Check if this is a git repository
  if (!isGitRepository(cwd)) {
    return {
      isGitRepo: false,
      files: {},
    };
  }

  // Execute git status --porcelain
  const result = await executeGitCommand(["status", "--porcelain"], cwd);

  if (!result.success) {
    // Return empty files on error, but indicate it is a git repo
    return {
      isGitRepo: true,
      files: {},
    };
  }

  const files: Record<string, FileStatus> = {};

  // Parse lines manually to preserve leading spaces (important for status codes like " M")
  // Don't use parseLines() because it trims the output which would strip leading spaces
  const lines = result.data.split("\n").filter((line) => line.length > 0);

  for (const line of lines) {
    const parsed = parseStatusLine(line);
    if (parsed !== null) {
      files[parsed.path] = parsed.status;
    }
  }

  return {
    isGitRepo: true,
    files,
  };
}

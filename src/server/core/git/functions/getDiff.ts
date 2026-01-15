import {
  executeGitCommand,
  parseLines,
  stripAnsiColors,
} from "../functions/utils";
import type { GitFileStatus, GitRawDiffResult, GitResult } from "../types";

const extractRef = (refText: string) => {
  const [group, ref] = refText.split(":");
  if (group === undefined || ref === undefined) {
    if (refText === "HEAD") {
      return "HEAD";
    }

    if (refText === "working") {
      return undefined;
    }

    throw new Error(`Invalid ref text: ${refText}`);
  }

  return ref;
};

/**
 * Get untracked files using git status
 */
async function getUntrackedFiles(cwd: string): Promise<GitResult<string[]>> {
  const statusResult = await executeGitCommand(
    ["status", "--untracked-files=all", "--short"],
    cwd,
  );

  if (!statusResult.success) {
    return statusResult;
  }

  try {
    const untrackedFiles = parseLines(statusResult.data)
      .map((line) => stripAnsiColors(line))
      .filter((line) => line.startsWith("??"))
      .map((line) => line.slice(3).trim());

    return {
      success: true,
      data: untrackedFiles,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: `Failed to parse status output: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    };
  }
}

/**
 * Mark untracked files with intent-to-add so they appear in git diff
 */
async function addIntentToAdd(
  cwd: string,
  files: string[],
): Promise<GitResult<void>> {
  if (files.length === 0) {
    return { success: true, data: undefined };
  }

  const result = await executeGitCommand(["add", "-N", ...files], cwd);
  if (!result.success) {
    return result;
  }
  return { success: true, data: undefined };
}

/**
 * Remove intent-to-add marks from files
 */
async function resetIntentToAdd(
  cwd: string,
  files: string[],
): Promise<GitResult<void>> {
  if (files.length === 0) {
    return { success: true, data: undefined };
  }

  const result = await executeGitCommand(
    ["reset", "HEAD", "--", ...files],
    cwd,
  );
  if (!result.success) {
    // Non-critical error, just log it
    console.warn("Failed to reset intent-to-add files:", result.error);
  }
  return { success: true, data: undefined };
}

/**
 * Parse numstat output to get file statistics
 */
function parseNumstat(
  numstatOutput: string,
): Map<string, { additions: number; deletions: number }> {
  const fileStats = new Map<string, { additions: number; deletions: number }>();
  const lines = parseLines(numstatOutput);

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      const additions = parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10);
      const deletions = parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10);
      // Handle renamed files: "old path" => "new path" or just "path"
      let filePath = parts[2];
      if (parts.length >= 4 && parts[3]) {
        // Renamed file: use the new path as the key
        filePath = parts[3];
      }
      fileStats.set(filePath, { additions, deletions });
    }
  }

  return fileStats;
}

/**
 * Parse name-status output to get file statuses
 * Returns a map of filePath -> { status, oldFilePath? }
 */
function parseNameStatus(
  nameStatusOutput: string,
): Map<string, { status: GitFileStatus; oldFilePath?: string }> {
  const fileStatuses = new Map<
    string,
    { status: GitFileStatus; oldFilePath?: string }
  >();
  const lines = parseLines(nameStatusOutput);

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const statusCode = parts[0].charAt(0);
      let status: GitFileStatus;
      let filePath: string;
      let oldFilePath: string | undefined;

      switch (statusCode) {
        case "A":
          status = "added";
          filePath = parts[1];
          break;
        case "D":
          status = "deleted";
          filePath = parts[1];
          break;
        case "M":
          status = "modified";
          filePath = parts[1];
          break;
        case "R":
          status = "renamed";
          oldFilePath = parts[1];
          filePath = parts[2] ?? parts[1];
          break;
        case "C":
          status = "copied";
          oldFilePath = parts[1];
          filePath = parts[2] ?? parts[1];
          break;
        default:
          status = "modified";
          filePath = parts[1];
      }

      fileStatuses.set(filePath, { status, oldFilePath });
    }
  }

  return fileStatuses;
}

/**
 * Get Git diff between two references as raw diff output.
 * Returns the raw diff string that can be passed directly to @git-diff-view/react.
 */
export const getDiff = async (
  cwd: string,
  fromRefText: string,
  toRefText: string,
): Promise<GitResult<GitRawDiffResult>> => {
  const fromRef = extractRef(fromRefText);
  const toRef = extractRef(toRefText);

  if (fromRef === toRef) {
    return {
      success: true,
      data: {
        rawDiff: "",
        files: [],
        summary: {
          totalFiles: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        },
      },
    };
  }

  if (fromRef === undefined) {
    throw new Error(`Invalid fromRef: ${fromRefText}`);
  }

  const isWorkingDirectory = toRef === undefined;
  let untrackedFiles: string[] = [];

  // If comparing to working directory, include untracked files via intent-to-add
  if (isWorkingDirectory) {
    const untrackedResult = await getUntrackedFiles(cwd);
    if (untrackedResult.success && untrackedResult.data.length > 0) {
      untrackedFiles = untrackedResult.data;
      const addResult = await addIntentToAdd(cwd, untrackedFiles);
      if (!addResult.success) {
        console.warn("Failed to add intent-to-add for untracked files");
      }
    }
  }

  // Create a set of untracked files for quick lookup
  const untrackedSet = new Set(untrackedFiles);

  try {
    const commandArgs = isWorkingDirectory ? [fromRef] : [fromRef, toRef];

    // Get diff with numstat for file statistics
    const numstatResult = await executeGitCommand(
      ["diff", "--numstat", ...commandArgs],
      cwd,
    );

    if (!numstatResult.success) {
      return numstatResult;
    }

    // Get diff with name-status for file statuses
    const nameStatusResult = await executeGitCommand(
      ["diff", "--name-status", ...commandArgs],
      cwd,
    );

    if (!nameStatusResult.success) {
      return nameStatusResult;
    }

    // Get raw diff output
    const diffResult = await executeGitCommand(
      ["diff", "--unified=5", ...commandArgs],
      cwd,
    );

    if (!diffResult.success) {
      return diffResult;
    }

    // Parse numstat for summary
    const fileStats = parseNumstat(numstatResult.data);

    // Parse name-status for file statuses
    const fileStatuses = parseNameStatus(nameStatusResult.data);

    let totalAdditions = 0;
    let totalDeletions = 0;
    const files: Array<{
      filePath: string;
      additions: number;
      deletions: number;
      status: GitFileStatus;
      oldFilePath?: string;
    }> = [];

    for (const [filePath, stats] of fileStats) {
      const statusInfo = fileStatuses.get(filePath);
      // If file is in untracked set, mark as untracked; otherwise use status from git
      const status: GitFileStatus = untrackedSet.has(filePath)
        ? "untracked"
        : (statusInfo?.status ?? "modified");

      files.push({
        filePath,
        additions: stats.additions,
        deletions: stats.deletions,
        status,
        oldFilePath: statusInfo?.oldFilePath,
      });
      totalAdditions += stats.additions;
      totalDeletions += stats.deletions;
    }

    return {
      success: true,
      data: {
        rawDiff: diffResult.data,
        files,
        summary: {
          totalFiles: files.length,
          totalAdditions,
          totalDeletions,
        },
      },
    };
  } finally {
    // Always cleanup intent-to-add marks
    if (untrackedFiles.length > 0) {
      await resetIntentToAdd(cwd, untrackedFiles);
    }
  }
};

/**
 * Compare between two branches (shorthand for getDiff)
 */
export async function compareBranches(
  cwd: string,
  baseBranch: string,
  targetBranch: string,
): Promise<GitResult<GitRawDiffResult>> {
  return getDiff(cwd, baseBranch, targetBranch);
}

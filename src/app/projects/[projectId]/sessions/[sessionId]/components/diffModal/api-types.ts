// API response types for Git operations
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  commit: string;
  ahead?: number;
  behind?: number;
}

export interface GitBranchesResponse {
  success: true;
  data: GitBranch[];
}

export type GitFileStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "copied"
  | "untracked";

export interface GitDiffFileSummary {
  filePath: string;
  additions: number;
  deletions: number;
  status: GitFileStatus;
  oldFilePath?: string;
}

export interface GitDiffSummary {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}

export interface GitDiffResponse {
  success: true;
  data: {
    rawDiff: string;
    files: GitDiffFileSummary[];
    summary: GitDiffSummary;
  };
}

export interface GitErrorResponse {
  success: false;
  error: {
    code:
      | "NOT_A_REPOSITORY"
      | "BRANCH_NOT_FOUND"
      | "COMMAND_FAILED"
      | "PARSE_ERROR";
    message: string;
    command?: string;
    stderr?: string;
  };
}

export type GitApiResponse =
  | GitBranchesResponse
  | GitDiffResponse
  | GitErrorResponse;

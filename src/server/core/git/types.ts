export type GitBranch = {
  name: string;
  current: boolean;
  remote?: string;
  commit: string;
  ahead?: number;
  behind?: number;
};

export type GitCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export type GitFileStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "copied"
  | "untracked";

export type GitDiffFileSummary = {
  filePath: string;
  additions: number;
  deletions: number;
  status: GitFileStatus;
  oldFilePath?: string; // For renamed/copied files
};

export type GitRawDiffResult = {
  rawDiff: string;
  files: GitDiffFileSummary[];
  summary: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
};

export type GitError = {
  code:
    | "NOT_A_REPOSITORY"
    | "BRANCH_NOT_FOUND"
    | "COMMAND_FAILED"
    | "PARSE_ERROR";
  message: string;
  command?: string;
  stderr?: string;
};

export type GitResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: GitError;
    };

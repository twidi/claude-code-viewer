export interface GitRef {
  name: `branch:${string}` | `commit:${string}` | `HEAD` | "working";
  type: "branch" | "commit" | "head" | "working";
  sha?: string;
  displayName: string;
}

export type FileStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "copied"
  | "untracked";

export interface DiffFileSummary {
  filePath: string;
  additions: number;
  deletions: number;
  status: FileStatus;
  oldFilePath?: string;
}

export interface DiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: DiffFileSummary[];
}

export interface DiffModalProps {
  projectId: string;
  projectName: string;
  branchName?: string;
  defaultCompareFrom?: string;
  defaultCompareTo?: string;
  revisionsData?:
    | {
        success: true;
        data: {
          baseBranch: {
            name: string;
            current: boolean;
            remote?: string;
            commit: string;
            ahead?: number;
            behind?: number;
          } | null;
          currentBranch: {
            name: string;
            current: boolean;
            remote?: string;
            commit: string;
            ahead?: number;
            behind?: number;
          } | null;
          head: string | null;
          commits: Array<{
            sha: string;
            message: string;
            author: string;
            date: string;
          }>;
        };
      }
    | {
        success: false;
      };
}

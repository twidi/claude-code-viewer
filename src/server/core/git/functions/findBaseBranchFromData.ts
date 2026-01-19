/**
 * Pure function to find the base branch from pre-fetched git data.
 *
 * This function implements the logic to detect which branch is the "base"
 * (parent) branch of a feature branch by analyzing commit history and
 * branch containment.
 */

export interface CommitWithParent {
  current: string;
  parent: string;
}

export interface BranchComparison {
  ahead: number;
  behind: number;
}

export interface FindBaseBranchInput {
  targetBranch: string;
  commits: CommitWithParent[];
  getBranchNamesForCommit: (commitHash: string) => string[];
  compareBranches: (
    targetBranch: string,
    otherBranch: string,
  ) => BranchComparison;
}

export interface FindBaseBranchResult {
  branch: string;
  hash: string;
}

/**
 * Finds the base branch for a given target branch.
 *
 * The algorithm:
 * 1. Iterates through commits in the target branch's history
 * 2. For each commit, checks which branches contain it
 * 3. If another branch contains the commit, compares the branches
 * 4. Returns the first branch where target has unique commits (behind > 0)
 *
 * This works for both cases:
 * - Base branch hasn't advanced: ahead=0, behind>0
 * - Diverged branches: ahead>0, behind>0
 *
 * @returns The base branch info, or null if not found
 */
export function findBaseBranchFromData(
  input: FindBaseBranchInput,
): FindBaseBranchResult | null {
  const { targetBranch, commits, getBranchNamesForCommit, compareBranches } =
    input;

  for (const commit of commits) {
    const branchNames = getBranchNamesForCommit(commit.current);

    if (!branchNames.includes(targetBranch)) {
      continue;
    }

    const otherBranchNames = branchNames.filter(
      (branchName) => branchName !== targetBranch,
    );

    if (otherBranchNames.length === 0) {
      continue;
    }

    for (const branchName of otherBranchNames) {
      const comparison = compareBranches(targetBranch, branchName);

      // If targetBranch has commits that otherBranch doesn't have (behind > 0),
      // then otherBranch is a potential base branch.
      // This works even if otherBranch has also advanced (ahead > 0),
      // which is the normal case for diverged branches.
      if (comparison.behind > 0) {
        return { branch: branchName, hash: commit.current };
      }
    }
  }

  return null;
}

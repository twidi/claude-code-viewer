import { describe, expect, test } from "vitest";
import {
  type BranchComparison,
  type CommitWithParent,
  findBaseBranchFromData,
} from "./findBaseBranchFromData";

describe("findBaseBranchFromData", () => {
  /**
   * Case 1: On main branch (no feature branch)
   *
   * main: A---B---C  (HEAD)
   *
   * When on main, there's no other branch that main is "behind" of,
   * so no base branch should be found.
   */
  test("returns null when on main branch with no feature branches", () => {
    const commits: CommitWithParent[] = [
      { current: "C", parent: "B" },
      { current: "B", parent: "A" },
      { current: "A", parent: "" },
    ];

    const branchContainment: Record<string, string[]> = {
      C: ["main"],
      B: ["main"],
      A: ["main"],
    };

    const result = findBaseBranchFromData({
      targetBranch: "main",
      commits,
      getBranchNamesForCommit: (hash) => branchContainment[hash] ?? [],
      compareBranches: () => ({ ahead: 0, behind: 0 }),
    });

    expect(result).toBeNull();
  });

  /**
   * Case 2: Feature branch where main has NOT advanced
   *
   * main:     A---B        (main points to B)
   *                \
   * feature:        D---E---F  (HEAD)
   *
   * feature..main = 0 commits (main has nothing feature doesn't have)
   * main..feature = 3 commits (feature has D, E, F that main doesn't have)
   *
   * Result: feature is "behind" main → main IS the base branch
   */
  test("finds base branch when main has not advanced since branching", () => {
    const commits: CommitWithParent[] = [
      { current: "F", parent: "E" },
      { current: "E", parent: "D" },
      { current: "D", parent: "B" },
      { current: "B", parent: "A" },
      { current: "A", parent: "" },
    ];

    const branchContainment: Record<string, string[]> = {
      F: ["feature"],
      E: ["feature"],
      D: ["feature"],
      B: ["feature", "main"],
      A: ["feature", "main"],
    };

    const branchComparisons: Record<string, BranchComparison> = {
      "feature:main": { ahead: 0, behind: 3 },
    };

    const result = findBaseBranchFromData({
      targetBranch: "feature",
      commits,
      getBranchNamesForCommit: (hash) => branchContainment[hash] ?? [],
      compareBranches: (target, other) =>
        branchComparisons[`${target}:${other}`] ?? { ahead: 0, behind: 0 },
    });

    expect(result).toEqual({ branch: "main", hash: "B" });
  });

  /**
   * Case 3: Feature branch where main HAS advanced (diverged branches)
   *
   * main:     A---B---C    (main has advanced with C)
   *                \
   * feature:        D---E---F  (HEAD)
   *
   * feature..main = 1 commit (main has C that feature doesn't have)
   * main..feature = 3 commits (feature has D, E, F that main doesn't have)
   *
   * Expected: main should still be detected as the base branch,
   * since B is the common ancestor (merge-base) of both branches.
   */
  test("finds base branch even when main has advanced (diverged branches)", () => {
    const commits: CommitWithParent[] = [
      { current: "F", parent: "E" },
      { current: "E", parent: "D" },
      { current: "D", parent: "B" },
      { current: "B", parent: "A" },
      { current: "A", parent: "" },
    ];

    const branchContainment: Record<string, string[]> = {
      F: ["feature"],
      E: ["feature"],
      D: ["feature"],
      B: ["feature", "main"],
      A: ["feature", "main"],
    };

    const branchComparisons: Record<string, BranchComparison> = {
      "feature:main": { ahead: 1, behind: 3 },
    };

    const result = findBaseBranchFromData({
      targetBranch: "feature",
      commits,
      getBranchNamesForCommit: (hash) => branchContainment[hash] ?? [],
      compareBranches: (target, other) =>
        branchComparisons[`${target}:${other}`] ?? { ahead: 0, behind: 0 },
    });

    expect(result).toEqual({ branch: "main", hash: "B" });
  });

  /**
   * Additional case: Multiple potential base branches
   *
   * main:      A---B
   *                 \
   * develop:         C---D
   *                       \
   * feature:               E---F  (HEAD)
   *
   * Should find 'develop' as the base branch (closest ancestor)
   */
  test("finds closest base branch when multiple branches exist", () => {
    const commits: CommitWithParent[] = [
      { current: "F", parent: "E" },
      { current: "E", parent: "D" },
      { current: "D", parent: "C" },
      { current: "C", parent: "B" },
      { current: "B", parent: "A" },
    ];

    const branchContainment: Record<string, string[]> = {
      F: ["feature"],
      E: ["feature"],
      D: ["feature", "develop"],
      C: ["feature", "develop"],
      B: ["feature", "develop", "main"],
      A: ["feature", "develop", "main"],
    };

    const branchComparisons: Record<string, BranchComparison> = {
      "feature:develop": { ahead: 0, behind: 2 },
      "feature:main": { ahead: 0, behind: 4 },
    };

    const result = findBaseBranchFromData({
      targetBranch: "feature",
      commits,
      getBranchNamesForCommit: (hash) => branchContainment[hash] ?? [],
      compareBranches: (target, other) =>
        branchComparisons[`${target}:${other}`] ?? { ahead: 0, behind: 0 },
    });

    expect(result).toEqual({ branch: "develop", hash: "D" });
  });

  /**
   * Edge case: Empty commits list
   */
  test("returns null when commits list is empty", () => {
    const result = findBaseBranchFromData({
      targetBranch: "feature",
      commits: [],
      getBranchNamesForCommit: () => [],
      compareBranches: () => ({ ahead: 0, behind: 0 }),
    });

    expect(result).toBeNull();
  });

  /**
   * Edge case: Commit not on target branch (should skip)
   */
  test("skips commits not on target branch", () => {
    const commits: CommitWithParent[] = [
      { current: "X", parent: "Y" },
      { current: "B", parent: "A" },
    ];

    const branchContainment: Record<string, string[]> = {
      X: ["other-branch"],
      B: ["feature", "main"],
    };

    const branchComparisons: Record<string, BranchComparison> = {
      "feature:main": { ahead: 0, behind: 1 },
    };

    const result = findBaseBranchFromData({
      targetBranch: "feature",
      commits,
      getBranchNamesForCommit: (hash) => branchContainment[hash] ?? [],
      compareBranches: (target, other) =>
        branchComparisons[`${target}:${other}`] ?? { ahead: 0, behind: 0 },
    });

    expect(result).toEqual({ branch: "main", hash: "B" });
  });
});

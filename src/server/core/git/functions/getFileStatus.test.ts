import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFileStatus } from "./getFileStatus";
import * as utils from "./utils";

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof utils>();
  return {
    ...actual,
    executeGitCommand: vi.fn(),
    isGitRepository: vi.fn(),
  };
});

describe("getFileStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("non-git repository", () => {
    it("returns isGitRepo: false when not a git repository", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(false);

      const result = await getFileStatus("/test/not-a-repo");

      expect(result).toEqual({
        isGitRepo: false,
        files: {},
      });
      expect(utils.executeGitCommand).not.toHaveBeenCalled();
    });
  });

  describe("git repository with no changes", () => {
    it("returns empty files when status is clean", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {},
      });
      expect(utils.executeGitCommand).toHaveBeenCalledWith(
        ["status", "--porcelain"],
        "/test/repo",
      );
    });
  });

  describe("parsing status codes", () => {
    it("parses untracked files (??)", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "?? src/newfile.ts\n?? README.md",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/newfile.ts": "untracked",
          "README.md": "untracked",
        },
      });
    });

    it("parses staged added files (A )", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "A  src/newfile.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/newfile.ts": "added",
        },
      });
    });

    it("parses staged modified files (M )", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "M  src/modified.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/modified.ts": "modified",
        },
      });
    });

    it("parses working tree modified files ( M)", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: " M src/modified.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/modified.ts": "modified",
        },
      });
    });

    it("parses both staged and unstaged modified files (MM)", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "MM src/modified.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/modified.ts": "modified",
        },
      });
    });

    it("parses staged deleted files (D )", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "D  src/deleted.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/deleted.ts": "deleted",
        },
      });
    });

    it("parses working tree deleted files ( D)", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: " D src/deleted.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/deleted.ts": "deleted",
        },
      });
    });

    it("parses renamed files (R )", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "R  old-name.ts -> new-name.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "new-name.ts": "renamed",
        },
      });
    });

    it("parses added to index with modifications in working tree (AM)", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "AM src/newfile.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/newfile.ts": "added",
        },
      });
    });
  });

  describe("mixed status output", () => {
    it("parses multiple files with different statuses", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: `?? src/untracked.ts
A  src/added.ts
M  src/staged-modified.ts
 M src/unstaged-modified.ts
D  src/deleted.ts
R  old.ts -> new.ts`,
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/untracked.ts": "untracked",
          "src/added.ts": "added",
          "src/staged-modified.ts": "modified",
          "src/unstaged-modified.ts": "modified",
          "src/deleted.ts": "deleted",
          "new.ts": "renamed",
        },
      });
    });
  });

  describe("edge cases", () => {
    it("handles files with spaces in names", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "?? src/file with spaces.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/file with spaces.ts": "untracked",
        },
      });
    });

    it("handles files with special characters", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "?? src/日本語ファイル.ts",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "src/日本語ファイル.ts": "untracked",
        },
      });
    });

    it("handles empty lines in output", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "?? file1.ts\n\n?? file2.ts\n",
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "file1.ts": "untracked",
          "file2.ts": "untracked",
        },
      });
    });

    it("handles renamed files with -> in original name", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: true,
        data: "R  old->name.ts -> new-name.ts",
      });

      const result = await getFileStatus("/test/repo");

      // The new name is after the last " -> "
      expect(result).toEqual({
        isGitRepo: true,
        files: {
          "new-name.ts": "renamed",
        },
      });
    });
  });

  describe("git command failure", () => {
    it("returns empty files when git command fails", async () => {
      vi.mocked(utils.isGitRepository).mockReturnValue(true);
      vi.mocked(utils.executeGitCommand).mockResolvedValue({
        success: false,
        error: {
          code: "COMMAND_FAILED",
          message: "Git command failed",
        },
      });

      const result = await getFileStatus("/test/repo");

      expect(result).toEqual({
        isGitRepo: true,
        files: {},
      });
    });
  });
});

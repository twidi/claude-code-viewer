import { describe, expect, test } from "vitest";
import { buildDiffFileTree, getAllDirectoryPaths } from "./diffFileTreeUtils";
import type { DiffFileSummary } from "./types";

const makeFile = (
  filePath: string,
  status: DiffFileSummary["status"] = "modified",
): DiffFileSummary => ({
  filePath,
  additions: 10,
  deletions: 5,
  status,
});

describe("buildDiffFileTree", () => {
  test("returns empty array for empty input", () => {
    expect(buildDiffFileTree([])).toEqual([]);
  });

  test("handles single file at root", () => {
    const files = [makeFile("README.md")];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(1);
    const node = tree[0];
    expect(node).toBeDefined();
    expect(node?.name).toBe("README.md");
    expect(node?.type).toBe("file");
    expect(node?.fileData?.filePath).toBe("README.md");
  });

  test("handles multiple files at root", () => {
    const files = [makeFile("README.md"), makeFile("package.json")];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(2);
    // Sorted alphabetically
    expect(tree[0]?.name).toBe("package.json");
    expect(tree[1]?.name).toBe("README.md");
  });

  test("creates directory structure", () => {
    const files = [makeFile("src/index.ts"), makeFile("src/utils.ts")];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(1);
    const srcDir = tree[0];
    expect(srcDir).toBeDefined();
    expect(srcDir?.name).toBe("src");
    expect(srcDir?.type).toBe("directory");
    expect(srcDir?.children).toHaveLength(2);
    expect(srcDir?.children[0]?.name).toBe("index.ts");
    expect(srcDir?.children[1]?.name).toBe("utils.ts");
  });

  test("collapses single-child directory chain", () => {
    const files = [
      makeFile("src/server/api/routes.ts"),
      makeFile("src/server/api/handlers.ts"),
    ];
    const tree = buildDiffFileTree(files);

    // src -> server -> api should be collapsed to "src/server/api"
    expect(tree).toHaveLength(1);
    const collapsedDir = tree[0];
    expect(collapsedDir).toBeDefined();
    expect(collapsedDir?.name).toBe("src/server/api");
    expect(collapsedDir?.type).toBe("directory");
    expect(collapsedDir?.fullPath).toBe("src/server/api");
    expect(collapsedDir?.children).toHaveLength(2);
    expect(collapsedDir?.children[0]?.name).toBe("handlers.ts");
    expect(collapsedDir?.children[1]?.name).toBe("routes.ts");
  });

  test("does not collapse when directory has multiple children", () => {
    const files = [
      makeFile("src/server/routes.ts"),
      makeFile("src/client/app.ts"),
    ];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(1);
    const srcDir = tree[0];
    expect(srcDir).toBeDefined();
    expect(srcDir?.name).toBe("src");
    expect(srcDir?.children).toHaveLength(2);
    // Directories sorted alphabetically
    expect(srcDir?.children[0]?.name).toBe("client");
    expect(srcDir?.children[1]?.name).toBe("server");
  });

  test("does not collapse when directory has file and subdirectory", () => {
    const files = [makeFile("src/index.ts"), makeFile("src/server/routes.ts")];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(1);
    const srcDir = tree[0];
    expect(srcDir).toBeDefined();
    expect(srcDir?.name).toBe("src");
    expect(srcDir?.children).toHaveLength(2);
    // Directory first, then file
    expect(srcDir?.children[0]?.name).toBe("server");
    expect(srcDir?.children[0]?.type).toBe("directory");
    expect(srcDir?.children[1]?.name).toBe("index.ts");
    expect(srcDir?.children[1]?.type).toBe("file");
  });

  test("handles deeply nested collapsed path", () => {
    const files = [makeFile("a/b/c/d/e/file.ts")];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(1);
    const collapsedDir = tree[0];
    expect(collapsedDir).toBeDefined();
    expect(collapsedDir?.name).toBe("a/b/c/d/e");
    expect(collapsedDir?.type).toBe("directory");
    expect(collapsedDir?.children).toHaveLength(1);
    expect(collapsedDir?.children[0]?.name).toBe("file.ts");
  });

  test("sorts directories before files at each level", () => {
    const files = [
      makeFile("src/z-file.ts"),
      makeFile("src/a-folder/nested.ts"),
      makeFile("README.md"),
      makeFile("docs/guide.md"),
    ];
    const tree = buildDiffFileTree(files);

    // Root level: directories (docs, src) then files (README.md)
    expect(tree).toHaveLength(3);
    expect(tree[0]?.name).toBe("docs");
    expect(tree[0]?.type).toBe("directory");
    expect(tree[1]?.name).toBe("src");
    expect(tree[1]?.type).toBe("directory");
    expect(tree[2]?.name).toBe("README.md");
    expect(tree[2]?.type).toBe("file");

    // Inside src: directory (a-folder) then file (z-file.ts)
    const srcDir = tree[1];
    expect(srcDir).toBeDefined();
    expect(srcDir?.children[0]?.name).toBe("a-folder");
    expect(srcDir?.children[0]?.type).toBe("directory");
    expect(srcDir?.children[1]?.name).toBe("z-file.ts");
    expect(srcDir?.children[1]?.type).toBe("file");
  });

  test("preserves file data through tree building", () => {
    const files = [
      {
        filePath: "src/app.ts",
        additions: 100,
        deletions: 50,
        status: "added" as const,
      },
    ];
    const tree = buildDiffFileTree(files);

    const srcDir = tree[0];
    expect(srcDir).toBeDefined();
    expect(srcDir?.children[0]?.fileData).toEqual(files[0]);
  });

  test("handles mixed collapsed and non-collapsed paths", () => {
    const files = [
      makeFile("src/components/Button.tsx"),
      makeFile("src/components/Input.tsx"),
      makeFile("src/utils/deep/nested/helper.ts"),
      makeFile("README.md"),
    ];
    const tree = buildDiffFileTree(files);

    expect(tree).toHaveLength(2);

    // src is not collapsed because it has multiple children (components and utils)
    const srcDir = tree[0];
    expect(srcDir).toBeDefined();
    expect(srcDir?.name).toBe("src");
    expect(srcDir?.children).toHaveLength(2);

    // components is not collapsed - has multiple files
    const componentsDir = srcDir?.children[0];
    expect(componentsDir?.name).toBe("components");
    expect(componentsDir?.children).toHaveLength(2);

    // utils/deep/nested should be collapsed
    const utilsDir = srcDir?.children[1];
    expect(utilsDir?.name).toBe("utils/deep/nested");
    expect(utilsDir?.children).toHaveLength(1);
    expect(utilsDir?.children[0]?.name).toBe("helper.ts");
  });
});

describe("getAllDirectoryPaths", () => {
  test("returns empty set for empty tree", () => {
    const paths = getAllDirectoryPaths([]);
    expect(paths.size).toBe(0);
  });

  test("returns empty set for tree with only files", () => {
    const tree = buildDiffFileTree([makeFile("README.md")]);
    const paths = getAllDirectoryPaths(tree);
    expect(paths.size).toBe(0);
  });

  test("returns all directory paths", () => {
    const tree = buildDiffFileTree([
      makeFile("src/components/Button.tsx"),
      makeFile("src/utils/helper.ts"),
      makeFile("docs/guide.md"),
    ]);
    const paths = getAllDirectoryPaths(tree);

    expect(paths.has("src")).toBe(true);
    expect(paths.has("src/components")).toBe(true);
    expect(paths.has("src/utils")).toBe(true);
    expect(paths.has("docs")).toBe(true);
    expect(paths.size).toBe(4);
  });

  test("returns collapsed directory paths", () => {
    const tree = buildDiffFileTree([makeFile("src/server/api/routes.ts")]);
    const paths = getAllDirectoryPaths(tree);

    // Should have the collapsed path
    expect(paths.has("src/server/api")).toBe(true);
    expect(paths.size).toBe(1);
  });
});

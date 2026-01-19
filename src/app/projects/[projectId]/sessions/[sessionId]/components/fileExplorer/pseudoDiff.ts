/**
 * Generates a pseudo-diff where all content appears as "added" lines.
 *
 * This allows reusing the @git-diff-view/react library for file viewing
 * (with syntax highlighting, virtualization, and comment widgets) while
 * CSS neutralizes the visual diff indicators (green backgrounds, + symbols).
 *
 * The generated diff includes proper git diff headers that the library's
 * internal DiffParser expects for correct rendering.
 *
 * @param content - The file content to convert to pseudo-diff format
 * @param fileName - The file name (used in diff headers)
 * @returns A git diff format string where all lines are prefixed with "+"
 *
 * @example
 * Input:
 *   content = "const x = 1;\nconst y = 2;"
 *   fileName = "src/file.ts"
 *
 * Output:
 *   diff --git a/src/file.ts b/src/file.ts
 *   new file mode 100644
 *   --- /dev/null
 *   +++ b/src/file.ts
 *   @@ -0,0 +1,2 @@
 *   +const x = 1;
 *   +const y = 2;
 */
export function generatePseudoDiff(content: string, fileName: string): string {
  const lines = content.split("\n");
  const lineCount = lines.length;

  // Build the diff components
  const diffHeader = `diff --git a/${fileName} b/${fileName}`;
  const newFileMode = "new file mode 100644";
  const oldFileHeader = "--- /dev/null";
  const newFileHeader = `+++ b/${fileName}`;
  const hunkHeader = `@@ -0,0 +1,${lineCount} @@`;
  const diffLines = lines.map((line) => `+${line}`).join("\n");

  return [
    diffHeader,
    newFileMode,
    oldFileHeader,
    newFileHeader,
    hunkHeader,
    diffLines,
  ].join("\n");
}

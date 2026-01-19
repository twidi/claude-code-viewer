/**
 * Utilities for file line comments.
 *
 * These functions are shared between the Git Diff dialog and File Explorer,
 * centralizing logic for syntax highlighting, comment keys, and formatting.
 */

/**
 * Maps file extensions to language identifiers for syntax highlighting.
 */
export const LANG_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  sh: "bash",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  sql: "sql",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
};

/**
 * Gets the language identifier from a file path for syntax highlighting.
 *
 * @param filePath - The file path to extract the language from
 * @param fallback - The fallback value if the extension is not recognized (default: "")
 * @returns The language identifier for syntax highlighting
 */
export function getLangFromFilePath(filePath: string, fallback = ""): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXTENSION[ext] ?? fallback;
}

/**
 * Creates a unique key for a comment on a file line.
 *
 * Format: "filePath:lineNumber:side"
 *
 * @param filePath - The path of the file
 * @param lineNumber - The line number being commented
 * @param side - Whether this is the old or new version of the line (for diffs)
 * @returns A unique string key for the comment
 */
export function createFileLineCommentKey(
  filePath: string,
  lineNumber: number,
  side: "old" | "new",
): string {
  return `${filePath}:${lineNumber}:${side}`;
}

/**
 * Data needed to format a file line comment.
 * This is a minimal interface - the actual LineCommentData may have more fields.
 */
export interface FileLineCommentFormatData {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  comment: string;
}

/**
 * Formats a single file line comment as a markdown block.
 *
 * Output format:
 * ---
 *
 * file:line
 * ```lang
 * code
 * ```
 *
 * user comment
 *
 * @param data - The comment data to format
 * @returns A formatted markdown string
 */
export function formatFileLineComment(data: FileLineCommentFormatData): string {
  const lang = getLangFromFilePath(data.filePath);
  const lines = [
    "---",
    "",
    `${data.filePath}:${data.lineNumber}`,
    `\`\`\`${lang}`,
    data.lineContent.trimEnd(),
    "```",
  ];
  if (data.comment) {
    lines.push("", data.comment);
  }
  return lines.join("\n");
}

/**
 * Formats multiple file line comments for chat insertion.
 * Only includes comments with non-empty text by default.
 *
 * @param comments - Array of comment data to format
 * @param hasContent - Optional filter function to determine if a comment has content
 * @returns A formatted string with all comments separated by double newlines
 */
export function formatFileLineComments<T extends FileLineCommentFormatData>(
  comments: T[],
  hasContent: (c: T) => boolean = (c) => c.comment.trim().length > 0,
): string {
  return comments.filter(hasContent).map(formatFileLineComment).join("\n\n");
}

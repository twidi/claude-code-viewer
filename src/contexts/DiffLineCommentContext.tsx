"use client";

import { createCommentCountContext } from "./createCommentCountContext";

/**
 * Context for inserting text from diff line comments into the chat textarea
 * and for sharing the comment count with badge components.
 */

/**
 * Data for a single line comment in a diff
 */
export interface LineCommentData {
  filePath: string;
  lineNumber: number;
  side: "old" | "new";
  lineContent: string;
  comment: string;
}

/**
 * Map of comment key to comment data
 */
export type CommentsMap = Map<string, LineCommentData>;

/**
 * Checks if a comment has non-empty content (not just whitespace).
 */
export function hasNonEmptyComment(comment: LineCommentData): boolean {
  return comment.comment.trim().length > 0;
}

// Create context using factory
const { Provider, useCommentCount } = createCommentCountContext("DiffLine");

/**
 * Provider for diff line comment context.
 * Wrap your component tree with this to enable comment functionality.
 */
export const DiffLineCommentProvider = Provider;

/**
 * Hook to access diff line comment context.
 * Must be used within a DiffLineCommentProvider.
 */
export const useDiffLineComment = useCommentCount;

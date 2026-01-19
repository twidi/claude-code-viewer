"use client";

import { createCommentCountContext } from "./createCommentCountContext";
import type { LineCommentData } from "./DiffLineCommentContext";

/**
 * Context for inserting text from file explorer line comments into the chat textarea
 * and for sharing the comment count with badge components.
 *
 * This is separate from DiffLineCommentContext to ensure independent counters
 * and no interference between Git dialog and File Explorer.
 */

/**
 * Map of comment key to comment data.
 * Uses the unified LineCommentData type from DiffLineCommentContext.
 * In File Explorer, the `side` field is always "new".
 */
export type FileExplorerCommentsMap = Map<string, LineCommentData>;

// Create context using factory
const { Provider, useCommentCount } = createCommentCountContext("FileExplorer");

/**
 * Provider for file explorer comment context.
 * Wrap your component tree with this to enable comment functionality.
 */
export const FileExplorerCommentProvider = Provider;

/**
 * Hook to access file explorer comment context.
 * Must be used within a FileExplorerCommentProvider.
 */
export const useFileExplorerComment = useCommentCount;

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CommentsMap,
  LineCommentData,
} from "@/contexts/DiffLineCommentContext";
import { createFileLineCommentKey } from "@/lib/utils/fileLineComments";

/**
 * Options for the useFileLineComments hook.
 */
interface UseFileLineCommentsOptions {
  /** Callback to sync comment count to context (for badge display) */
  setContextCommentCount: (count: number) => void;
}

/**
 * Return type for the useFileLineComments hook.
 */
interface UseFileLineCommentsReturn {
  /** Map of comment key to comment data */
  comments: CommentsMap;
  /** Add a new comment on a file line */
  handleAddComment: (
    filePath: string,
    lineNumber: number,
    side: "old" | "new",
    lineContent: string,
  ) => void;
  /** Update the text of an existing comment */
  handleUpdateComment: (key: string, comment: string) => void;
  /** Remove a comment */
  handleRemoveComment: (key: string) => void;
  /** Clear all comments */
  resetComments: () => void;
  /** Number of comments with non-empty text */
  nonEmptyCommentCount: number;
  /** Map of file path to count of non-empty comments */
  commentCountByFile: Map<string, number>;
}

/**
 * Hook for managing file line comments.
 *
 * This hook provides:
 * - State management for comments (add, update, remove)
 * - Memoized count calculations
 * - Automatic sync to context for badge display
 * - Cleanup on unmount
 *
 * Used by both Git Diff dialog and File Explorer to manage inline comments
 * on file lines.
 */
export function useFileLineComments({
  setContextCommentCount,
}: UseFileLineCommentsOptions): UseFileLineCommentsReturn {
  const [comments, setComments] = useState<CommentsMap>(() => new Map());

  const handleAddComment = useCallback(
    (
      filePath: string,
      lineNumber: number,
      side: "old" | "new",
      lineContent: string,
    ) => {
      const key = createFileLineCommentKey(filePath, lineNumber, side);
      setComments((prev) => {
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, {
          filePath,
          lineNumber,
          side,
          lineContent,
          comment: "",
        } satisfies LineCommentData);
        return next;
      });
    },
    [],
  );

  const handleUpdateComment = useCallback((key: string, comment: string) => {
    setComments((prev) => {
      const existing = prev.get(key);
      if (!existing) return prev;

      // CRITICAL: Don't create a new Map if the value hasn't changed.
      // This prevents an infinite loop caused by:
      // 1. LineCommentWidget's useEffect syncs localComment to parent on mount
      // 2. If we always create a new Map, comments changes -> extendData changes
      // 3. Library re-renders extend lines -> new onCommentChange callback
      // 4. LineCommentWidget sees new callback -> useEffect runs again -> LOOP!
      // See file-explorer.md Task 24 for details.
      if (existing.comment === comment) return prev;

      const next = new Map(prev);
      next.set(key, { ...existing, comment });
      return next;
    });
  }, []);

  const handleRemoveComment = useCallback((key: string) => {
    setComments((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const resetComments = useCallback(() => {
    setComments(new Map());
  }, []);

  const nonEmptyCommentCount = useMemo(() => {
    let count = 0;
    for (const comment of comments.values()) {
      if (comment.comment.trim().length > 0) count++;
    }
    return count;
  }, [comments]);

  const commentCountByFile = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of comments.values()) {
      if (comment.comment.trim().length > 0) {
        counts.set(comment.filePath, (counts.get(comment.filePath) ?? 0) + 1);
      }
    }
    return counts;
  }, [comments]);

  // Sync count to context for badge display
  useEffect(() => {
    setContextCommentCount(nonEmptyCommentCount);
  }, [nonEmptyCommentCount, setContextCommentCount]);

  // Reset count on unmount
  useEffect(() => {
    return () => setContextCommentCount(0);
  }, [setContextCommentCount]);

  return {
    comments,
    handleAddComment,
    handleUpdateComment,
    handleRemoveComment,
    resetComments,
    nonEmptyCommentCount,
    commentCountByFile,
  };
}

"use client";

import {
  DiffFile,
  DiffModeEnum,
  DiffView,
  type SplitSide,
} from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";
import { type FC, useCallback, useMemo, useRef } from "react";
import type { FileExplorerCommentsMap } from "@/contexts/FileExplorerCommentContext";
import { useTheme } from "@/hooks/useTheme";
import { getLangFromFilePath } from "@/lib/utils/fileLineComments";
import { LineCommentWidget } from "../diffModal/LineCommentWidget";
import { generatePseudoDiff } from "./pseudoDiff";
import type { FileViewOptions } from "./types";
import "./FileViewerStyles.css";

interface ExtendDataItem {
  commentKey: string;
}

export interface FileContentViewerProps {
  /** File content to display */
  content: string;
  /** File name (used for syntax highlighting detection) */
  fileName: string;
  /** View options for wrap and highlight */
  options: FileViewOptions;
  /** Map of comment key to comment data */
  comments: FileExplorerCommentsMap;
  /** Callback when a new comment is added */
  onAddComment: (
    filePath: string,
    lineNumber: number,
    side: "old" | "new",
    lineContent: string,
  ) => void;
  /** Callback when a comment is updated */
  onUpdateComment: (key: string, comment: string) => void;
  /** Callback when a comment is removed */
  onRemoveComment: (key: string) => void;
}

/**
 * FileContentViewer - Displays file content with syntax highlighting and line comments.
 *
 * Uses the @git-diff-view/react library with a pseudo-diff where all content
 * appears as "added" lines. CSS overrides (in FileViewerStyles.css) neutralize
 * the diff appearance (green backgrounds, + symbols) to show a normal file viewer.
 *
 * Features:
 * - Syntax highlighting (optional)
 * - Line wrapping (optional)
 * - Click on line numbers to add comments
 * - Virtualization for large files
 */
export const FileContentViewer: FC<FileContentViewerProps> = ({
  content,
  fileName,
  options,
  comments,
  onAddComment,
  onUpdateComment,
  onRemoveComment,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = isDark ? "dark" : "light";
  const lang = useMemo(() => getLangFromFilePath(fileName, "text"), [fileName]);

  // Use a ref to access comments without causing re-renders of renderExtendLine
  // This prevents the textarea cursor from jumping to the end on each keystroke
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  // Create the pseudo-diff where all lines appear as "added"
  const diffFile = useMemo(() => {
    const pseudoDiff = generatePseudoDiff(content, fileName);

    const file = DiffFile.createInstance({
      oldFile: {
        fileName: fileName || undefined,
        fileLang: lang,
        content: "",
      },
      newFile: {
        fileName: fileName || undefined,
        fileLang: lang,
        content: "",
      },
      hunks: [pseudoDiff],
    });

    file.initTheme(theme);
    file.init();
    file.buildSplitDiffLines();

    return file;
  }, [content, theme, fileName, lang]);

  // Get line content from the diff file
  const getLineContent = useCallback(
    (lineNumber: number): string => {
      try {
        // In our pseudo-diff, all lines are "new" lines
        return diffFile.getNewPlainLine(lineNumber)?.value ?? "";
      } catch {
        return "";
      }
    },
    [diffFile],
  );

  // Build extendData from comments for this file
  const extendData = useMemo(() => {
    const oldFile: Record<string, { data: ExtendDataItem }> = {};
    const newFile: Record<string, { data: ExtendDataItem }> = {};

    for (const [key, comment] of comments.entries()) {
      if (comment.filePath !== fileName) continue;

      const lineKey = String(comment.lineNumber);
      // In file viewer mode, all comments are on "new" side
      newFile[lineKey] = { data: { commentKey: key } };
    }

    return { oldFile, newFile };
  }, [comments, fileName]);

  // Handle click on line number to add a comment
  const handleAddWidgetClick = useCallback(
    (lineNumber: number, _side: SplitSide) => {
      // In file viewer mode, we always use the "new" side
      const lineContent = getLineContent(lineNumber);
      onAddComment(fileName, lineNumber, "new", lineContent);
    },
    [fileName, getLineContent, onAddComment],
  );

  // Render the comment widget for a line
  const renderExtendLine = useCallback(
    ({
      data,
    }: {
      lineNumber: number;
      side: SplitSide;
      data: ExtendDataItem;
      diffFile: DiffFile;
      onUpdate: () => void;
    }) => {
      // Use ref to get current comments to avoid re-renders on comment text changes
      const comment = commentsRef.current.get(data.commentKey);
      if (!comment) return null;

      return (
        <LineCommentWidget
          filePath={comment.filePath}
          lineNumber={comment.lineNumber}
          initialComment={comment.comment}
          onCommentChange={(newComment) =>
            onUpdateComment(data.commentKey, newComment)
          }
          onCancel={() => onRemoveComment(data.commentKey)}
        />
      );
    },
    [onUpdateComment, onRemoveComment],
  );

  /**
   * Empty widget line renderer to prevent React error #185.
   *
   * When diffViewAddWidget={true}, clicking the "+" button triggers the library's
   * internal widget system (setWidget). Even though we use renderExtendLine instead
   * of renderWidgetLine for rendering comments, the library may still attempt to
   * process the widget system's render pipeline internally.
   *
   * Providing this no-op callback ensures the library doesn't encounter issues
   * with its widget rendering path while we handle comments through extendData.
   */
  const renderWidgetLine = useCallback(() => null, []);

  return (
    <div className="file-viewer-mode h-full overflow-auto">
      <DiffView
        diffFile={diffFile}
        diffViewMode={DiffModeEnum.Unified}
        diffViewHighlight={options.highlight}
        diffViewWrap={options.wrap}
        diffViewAddWidget={true}
        onAddWidgetClick={handleAddWidgetClick}
        extendData={extendData}
        renderExtendLine={renderExtendLine}
        renderWidgetLine={renderWidgetLine}
      />
    </div>
  );
};

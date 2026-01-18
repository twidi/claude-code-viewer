"use client";

import { Trans } from "@lingui/react";
import { FolderOpen, MessageSquarePlus } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import { PersistentDialogShell } from "@/components/PersistentDialogShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFileExplorerComment } from "@/contexts/FileExplorerCommentContext";
import { useFileLineComments } from "@/hooks/useFileLineComments";
import { formatFileLineComments } from "@/lib/utils/fileLineComments";
import { EmptyState } from "./EmptyState";
import { FileTree } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { DEFAULT_FILE_VIEW_OPTIONS, type FileViewOptions } from "./types";

export interface FileExplorerDialogProps {
  projectId: string;
  projectPath: string;
  projectName: string;
  branchName?: string;
}

/**
 * Checkbox toggle for view options (Wrap, Syntax)
 * Uses the same pattern as DiffOptionToggle in DiffViewer.tsx for UI consistency.
 */
const OptionToggle: FC<{
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => {
  const id = useId();
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <label
        htmlFor={id}
        className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none"
      >
        {label}
      </label>
    </div>
  );
};

// ============================================================================
// FileExplorerDialogContent - internal component that gets remounted on resetKey change
// ============================================================================

interface FileExplorerDialogContentProps {
  projectId: string;
  projectPath: string;
  projectName: string;
}

const FileExplorerDialogContent: FC<FileExplorerDialogContentProps> = ({
  projectId,
  projectPath,
  projectName,
}) => {
  // Context for inserting comments into chat
  const { insertText, setNonEmptyCommentCount } = useFileExplorerComment();

  // Use shared hook for comment management
  const {
    comments,
    handleAddComment,
    handleUpdateComment,
    handleRemoveComment,
    resetComments,
    nonEmptyCommentCount,
    commentCountByFile,
  } = useFileLineComments({
    setContextCommentCount: setNonEmptyCommentCount,
  });

  // Local state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewOptions, setViewOptions] = useState<FileViewOptions>(
    DEFAULT_FILE_VIEW_OPTIONS,
  );

  // Send all comments to chat
  const handleSendAllComments = useCallback(() => {
    if (nonEmptyCommentCount === 0) return;

    const commentsArray = Array.from(comments.values());
    const formatted = formatFileLineComments(commentsArray);
    insertText(formatted);

    // Clear all comments after sending (focus happens in insertText callback)
    resetComments();
  }, [comments, insertText, nonEmptyCommentCount, resetComments]);

  // Handle file selection
  const handleFileSelect = useCallback((filePath: string) => {
    // Only set file if it's not a directory (directories end with / or are "/")
    if (filePath !== "/" && !filePath.endsWith("/")) {
      setSelectedFile(filePath);
    }
  }, []);

  return (
    <>
      <PersistentDialogShell.Header>
        <FolderOpen className="w-5 h-5" />
        <span className="font-semibold">
          <Trans id="file_explorer.title" /> — {projectName}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {/* View options */}
          <OptionToggle
            label={<Trans id="diff.options.wrap" />}
            checked={viewOptions.wrap}
            onChange={(wrap) => setViewOptions((prev) => ({ ...prev, wrap }))}
          />
          <OptionToggle
            label={<Trans id="diff.options.highlight" />}
            checked={viewOptions.highlight}
            onChange={(highlight) =>
              setViewOptions((prev) => ({ ...prev, highlight }))
            }
          />
          {/* Close button is automatically added by PersistentDialogShell.Header */}
        </div>
      </PersistentDialogShell.Header>

      <PersistentDialogShell.Content>
        {/* Main content - two panel layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left panel - File tree */}
          <div className="w-64 md:w-72 lg:w-80 border-r border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
            <FileTree
              projectId={projectId}
              projectPath={projectPath}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              commentCountByFile={commentCountByFile}
            />
          </div>

          {/* Right panel - File viewer */}
          <div className="flex-1 overflow-hidden relative">
            {selectedFile ? (
              <FileViewer
                projectId={projectId}
                filePath={selectedFile}
                options={viewOptions}
                comments={comments}
                onAddComment={handleAddComment}
                onUpdateComment={handleUpdateComment}
                onRemoveComment={handleRemoveComment}
              />
            ) : (
              <EmptyState />
            )}

            {/* Floating button to send all comments */}
            {nonEmptyCommentCount > 0 && (
              <div className="absolute bottom-4 right-4 z-10">
                <Button
                  onClick={handleSendAllComments}
                  className="shadow-lg bg-blue-500 hover:bg-blue-600 text-white"
                  size="sm"
                >
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  <Trans
                    id="diff.line_comment.send_all"
                    values={{ count: nonEmptyCommentCount }}
                  />
                </Button>
              </div>
            )}
          </div>
        </div>
      </PersistentDialogShell.Content>
    </>
  );
};

// ============================================================================
// FileExplorerDialog - wrapper component that uses PersistentDialogShell
// ============================================================================

/**
 * FileExplorerDialog - Main dialog for browsing project files.
 *
 * Features:
 * - Minimizable dialog (persisted via PersistentDialogsContext)
 * - Two-panel layout: FileTree on left, FileViewer on right
 * - View options toggles (Wrap, Syntax)
 * - Line comments that can be sent to chat
 * - Close confirmation if unsent comments exist
 */
export const FileExplorerDialog: FC<FileExplorerDialogProps> = ({
  projectId,
  projectPath,
  projectName,
  branchName,
}) => {
  // Get nonEmptyCommentCount from context for badge and close confirmation
  const { nonEmptyCommentCount } = useFileExplorerComment();

  // Build resetKey: reset when projectId or branchName changes
  const resetKey = branchName ? `${projectId}-${branchName}` : projectId;

  return (
    <PersistentDialogShell
      dialogId="file-explorer"
      config={{
        icon: FolderOpen,
        label: <Trans id="control.files" />,
        description: projectName,
        badgeCount: nonEmptyCommentCount,
      }}
      resetKey={resetKey}
      closeConfirmation={{
        shouldConfirm: () => nonEmptyCommentCount > 0,
        title: <Trans id="diff.close_confirm.title" />,
        description: (
          <Trans
            id="diff.close_confirm.description"
            values={{ count: nonEmptyCommentCount }}
          />
        ),
        cancelLabel: <Trans id="diff.close_confirm.cancel" />,
        confirmLabel: <Trans id="diff.close_confirm.confirm" />,
      }}
    >
      <FileExplorerDialogContent
        projectId={projectId}
        projectPath={projectPath}
        projectName={projectName}
      />
    </PersistentDialogShell>
  );
};

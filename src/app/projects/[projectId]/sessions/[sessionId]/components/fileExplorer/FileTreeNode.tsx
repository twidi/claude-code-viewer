import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import type { FileCompletionEntry } from "@/hooks/useFileCompletion";
import { cn } from "@/lib/utils";
import type { FileStatus } from "@/server/core/git/functions/getFileStatus";

/**
 * Props for the FileTreeNode component
 */
export interface FileTreeNodeProps {
  /** The file or directory entry to display */
  entry: FileCompletionEntry;
  /** Current depth level (for indentation) */
  depth: number;
  /** Whether this folder is expanded (only relevant for directories) */
  isExpanded: boolean;
  /** Whether this file/folder is currently selected */
  isSelected: boolean;
  /** Whether this folder is currently loading its contents */
  isLoading?: boolean;
  /** Git status of this file (if available) */
  gitStatus?: FileStatus;
  /** Number of comments on this file (for badge display) */
  commentCount?: number;
  /** Callback when a folder is expanded/collapsed */
  onToggle: (path: string) => void;
  /** Callback when a file is selected */
  onSelect: (path: string) => void;
  /** Child nodes to render (for directories) */
  children?: React.ReactNode;
}

/**
 * Get the color class for a git status indicator
 */
function getGitStatusColor(status: FileStatus): string {
  switch (status) {
    case "added":
    case "untracked":
      return "bg-green-500";
    case "modified":
      return "bg-yellow-500";
    case "deleted":
      return "bg-red-500";
    case "renamed":
      return "bg-blue-500";
    default:
      return "bg-transparent";
  }
}

/**
 * Get the accessible label for a git status
 */
function getGitStatusLabel(status: FileStatus): string {
  switch (status) {
    case "added":
      return "Added";
    case "untracked":
      return "Untracked";
    case "modified":
      return "Modified";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    default:
      return "";
  }
}

/**
 * FileTreeNode - A single node in the file tree.
 *
 * Renders a file or directory with:
 * - Appropriate icon (file, folder, or folder open)
 * - Expand/collapse chevron for directories
 * - Git status indicator dot
 * - Indentation based on depth
 * - Loading spinner when fetching folder contents
 */
export const FileTreeNode: FC<FileTreeNodeProps> = ({
  entry,
  depth,
  isExpanded,
  isSelected,
  isLoading = false,
  gitStatus,
  commentCount,
  onToggle,
  onSelect,
  children,
}) => {
  const isDirectory = entry.type === "directory";

  const handleClick = () => {
    if (isDirectory) {
      onToggle(entry.path);
    } else {
      onSelect(entry.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
    // Arrow right expands folder, arrow left collapses
    if (isDirectory) {
      if (e.key === "ArrowRight" && !isExpanded) {
        e.preventDefault();
        onToggle(entry.path);
      } else if (e.key === "ArrowLeft" && isExpanded) {
        e.preventDefault();
        onToggle(entry.path);
      }
    }
  };

  // Calculate indentation: base padding + (depth * indent size)
  const paddingLeft = 8 + depth * 16;

  return (
    <div className="select-none">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full h-7 justify-start text-left font-mono text-sm px-2 rounded-none",
          "hover:bg-accent/50 focus-visible:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {/* Expand/collapse chevron for directories */}
        {isDirectory && (
          <span className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </span>
        )}

        {/* Spacer for files to align with directories */}
        {!isDirectory && <span className="w-4 h-4 mr-1 flex-shrink-0" />}

        {/* File/folder icon */}
        <span className="flex-shrink-0 w-4 h-4 mr-2 flex items-center justify-center">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            )
          ) : (
            <File className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </span>

        {/* File/folder name */}
        <span className="truncate flex-1 min-w-0">{entry.name}</span>

        {/* Comment count badge */}
        {commentCount != null && commentCount > 0 && (
          <span className="shrink-0 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded ml-1">
            {commentCount}
          </span>
        )}

        {/* Git status indicator */}
        {gitStatus && (
          <span
            className={cn(
              "flex-shrink-0 w-2 h-2 rounded-full ml-2",
              getGitStatusColor(gitStatus),
            )}
            title={getGitStatusLabel(gitStatus)}
          />
        )}
      </Button>

      {/* Render children for expanded directories */}
      {isDirectory && isExpanded && children && <div>{children}</div>}
    </div>
  );
};

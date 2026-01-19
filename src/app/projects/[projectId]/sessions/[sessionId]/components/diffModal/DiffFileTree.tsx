import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDiffFileTree,
  type DiffTreeNode,
  getAllDirectoryPaths,
} from "./diffFileTreeUtils";
import type { DiffFileSummary, FileStatus } from "./types";

interface FileStatusBadgeProps {
  status: FileStatus;
  className?: string;
}

const FileStatusBadge: FC<FileStatusBadgeProps> = ({ status, className }) => {
  const config: Record<
    FileStatus,
    { label: string; bgClass: string; textClass: string }
  > = {
    added: {
      label: "A",
      bgClass: "bg-green-100 dark:bg-green-900/30",
      textClass: "text-green-700 dark:text-green-400",
    },
    deleted: {
      label: "D",
      bgClass: "bg-red-100 dark:bg-red-900/30",
      textClass: "text-red-700 dark:text-red-400",
    },
    modified: {
      label: "M",
      bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
      textClass: "text-yellow-700 dark:text-yellow-400",
    },
    renamed: {
      label: "R",
      bgClass: "bg-purple-100 dark:bg-purple-900/30",
      textClass: "text-purple-700 dark:text-purple-400",
    },
    copied: {
      label: "C",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
      textClass: "text-blue-700 dark:text-blue-400",
    },
    untracked: {
      label: "U",
      bgClass: "bg-gray-100 dark:bg-gray-700",
      textClass: "text-gray-700 dark:text-gray-300",
    },
  };

  const { label, bgClass, textClass } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold shrink-0",
        bgClass,
        textClass,
        className,
      )}
      title={status}
    >
      {label}
    </span>
  );
};

interface DiffTreeNodeComponentProps {
  node: DiffTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onFileClick: (filePath: string) => void;
  commentCountByFile: Map<string, number>;
}

const DiffTreeNodeComponent: FC<DiffTreeNodeComponentProps> = ({
  node,
  depth,
  expandedPaths,
  onToggle,
  onFileClick,
  commentCountByFile,
}) => {
  const isDirectory = node.type === "directory";
  const isExpanded = isDirectory && expandedPaths.has(node.fullPath);

  const handleClick = () => {
    if (isDirectory) {
      onToggle(node.fullPath);
    } else if (node.fileData) {
      onFileClick(node.fileData.filePath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
    if (isDirectory) {
      if (e.key === "ArrowRight" && !isExpanded) {
        e.preventDefault();
        onToggle(node.fullPath);
      } else if (e.key === "ArrowLeft" && isExpanded) {
        e.preventDefault();
        onToggle(node.fullPath);
      }
    }
  };

  // Calculate indentation: base padding + (depth * indent size)
  const paddingLeft = 8 + depth * 16;

  const commentCount = node.fileData
    ? commentCountByFile.get(node.fileData.filePath)
    : undefined;

  return (
    <div className="select-none">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full h-7 justify-start text-left font-mono text-sm px-2 rounded-none",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
      >
        {/* Expand/collapse chevron for directories */}
        {isDirectory && (
          <span className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            )}
          </span>
        )}

        {/* File status badge (for files only) */}
        {!isDirectory && node.fileData && (
          <FileStatusBadge status={node.fileData.status} className="mr-1" />
        )}

        {/* Spacer for files to align with directories that don't have status badge */}
        {isDirectory && <span className="w-0 h-4 mr-0 flex-shrink-0" />}

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

        {/* Name */}
        <span className="truncate flex-1 min-w-0">{node.name}</span>

        {/* Comment count badge (files only) */}
        {commentCount != null && commentCount > 0 && (
          <span className="shrink-0 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded ml-1">
            {commentCount} 💬
          </span>
        )}

        {/* Diff stats (files only) */}
        {node.fileData && (
          <span className="shrink-0 text-xs ml-2">
            {node.fileData.additions > 0 && (
              <span className="text-green-600 dark:text-green-400">
                +{node.fileData.additions}
              </span>
            )}
            {node.fileData.additions > 0 && node.fileData.deletions > 0 && " "}
            {node.fileData.deletions > 0 && (
              <span className="text-red-600 dark:text-red-400">
                -{node.fileData.deletions}
              </span>
            )}
          </span>
        )}
      </Button>

      {/* Render children for expanded directories */}
      {isDirectory && isExpanded && (
        <div>
          {node.children.map((child) => (
            <DiffTreeNodeComponent
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onFileClick={onFileClick}
              commentCountByFile={commentCountByFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export interface DiffFileTreeProps {
  files: DiffFileSummary[];
  onFileClick: (filePath: string) => void;
  commentCountByFile: Map<string, number>;
}

export const DiffFileTree: FC<DiffFileTreeProps> = ({
  files,
  onFileClick,
  commentCountByFile,
}) => {
  // Build tree structure with collapsed paths
  const tree = useMemo(() => buildDiffFileTree(files), [files]);

  // Initialize all directories as expanded
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    getAllDirectoryPaths(tree),
  );

  // Update expanded paths when tree changes (new files list)
  useMemo(() => {
    const allPaths = getAllDirectoryPaths(tree);
    setExpandedPaths((prev) => {
      // Keep existing expanded state but add any new directories
      const next = new Set(prev);
      for (const path of allPaths) {
        if (!prev.has(path)) {
          next.add(path);
        }
      }
      return next;
    });
  }, [tree]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return null;
  }

  return (
    <div role="tree" aria-label="Changed files">
      {tree.map((node) => (
        <DiffTreeNodeComponent
          key={node.fullPath}
          node={node}
          depth={0}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
          onFileClick={onFileClick}
          commentCountByFile={commentCountByFile}
        />
      ))}
    </div>
  );
};

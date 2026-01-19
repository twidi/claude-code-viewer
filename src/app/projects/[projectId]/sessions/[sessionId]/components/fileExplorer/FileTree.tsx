import { useQuery } from "@tanstack/react-query";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import type { FileCompletionEntry } from "@/hooks/useFileCompletion";
import { useFileCompletion } from "@/hooks/useFileCompletion";
import { gitFileStatusQuery } from "@/lib/api/queries";
import type { FileStatus } from "@/server/core/git/functions/getFileStatus";
import { FileTreeNode } from "./FileTreeNode";

/**
 * Get all parent folder paths for a given file path.
 * Example: "src/components/Button.tsx" -> ["/", "src", "src/components"]
 * Note: Root is "/" but other paths have no leading slash to match entry.path format from API
 */
const getParentFolders = (filePath: string): string[] => {
  const folders: string[] = ["/"];
  if (!filePath || filePath === "/") return folders;

  // Remove leading slash if present
  const normalizedPath = filePath.startsWith("/")
    ? filePath.slice(1)
    : filePath;
  const parts = normalizedPath.split("/").filter(Boolean);

  // Remove the last part (file name) and build folder paths
  for (let i = 0; i < parts.length - 1; i++) {
    folders.push(parts.slice(0, i + 1).join("/"));
  }
  return folders;
};

/**
 * Props for the FileTree component
 */
export interface FileTreeProps {
  /** Project ID for API calls */
  projectId: string;
  /** Path to the project root */
  projectPath: string;
  /** Currently selected file path */
  selectedFile: string | null;
  /** Callback when a file is selected */
  onFileSelect: (filePath: string) => void;
  /** Map of file paths to their comment counts (for badge display) */
  commentCountByFile: Map<string, number>;
}

/**
 * Recursive component to render folder contents
 */
interface FolderContentsProps {
  projectId: string;
  folderPath: string;
  depth: number;
  expandedFolders: Set<string>;
  loadingFolders: Set<string>;
  selectedFile: string | null;
  fileStatuses: Record<string, FileStatus>;
  commentCountByFile: Map<string, number>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onLoadingChange: (path: string, isLoading: boolean) => void;
}

const FolderContents: FC<FolderContentsProps> = ({
  projectId,
  folderPath,
  depth,
  expandedFolders,
  loadingFolders,
  selectedFile,
  fileStatuses,
  commentCountByFile,
  onToggle,
  onSelect,
  onLoadingChange,
}) => {
  // Fetch folder contents with useFileCompletion
  const { data, isLoading } = useFileCompletion(
    projectId,
    folderPath,
    true, // Always enabled since this component is only rendered for expanded folders
  );

  // Notify parent about loading state changes
  useEffect(() => {
    onLoadingChange(folderPath, isLoading);
  }, [folderPath, isLoading, onLoadingChange]);

  if (isLoading) {
    return null; // Loading indicator is shown on the parent folder node
  }

  if (!data?.entries || data.entries.length === 0) {
    return null;
  }

  // Sort entries: directories first, then files, both alphabetically
  const sortedEntries = [...data.entries].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "directory" ? -1 : 1;
  });

  return (
    <>
      {sortedEntries.map((entry) => {
        const isExpanded = expandedFolders.has(entry.path);
        const isLoading = loadingFolders.has(entry.path);

        return (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={depth}
            isExpanded={isExpanded}
            isSelected={selectedFile === entry.path}
            isLoading={isLoading}
            gitStatus={fileStatuses[entry.path]}
            commentCount={commentCountByFile.get(entry.path)}
            onToggle={onToggle}
            onSelect={onSelect}
          >
            {/* Recursively render folder contents if expanded */}
            {entry.type === "directory" && isExpanded && (
              <FolderContents
                projectId={projectId}
                folderPath={
                  entry.path.endsWith("/") ? entry.path : `${entry.path}/`
                }
                depth={depth + 1}
                expandedFolders={expandedFolders}
                loadingFolders={loadingFolders}
                selectedFile={selectedFile}
                fileStatuses={fileStatuses}
                commentCountByFile={commentCountByFile}
                onToggle={onToggle}
                onSelect={onSelect}
                onLoadingChange={onLoadingChange}
              />
            )}
          </FileTreeNode>
        );
      })}
    </>
  );
};

/**
 * FileTree - Main file tree component for the file explorer.
 *
 * Features:
 * - Lazy loading of folder contents (only fetches when expanded)
 * - Git status indicators for files
 * - Keyboard navigation
 * - Persistent expanded state during session
 */
export const FileTree: FC<FileTreeProps> = ({
  projectId,
  projectPath,
  selectedFile,
  onFileSelect,
  commentCountByFile,
}) => {
  // Track expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(["/"]),
  );

  // Track loading folders for spinner display
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  // Auto-expand to selected file when it changes
  useEffect(() => {
    if (!selectedFile) return;

    const parentFolders = getParentFolders(selectedFile);
    setExpandedFolders((prev) => {
      // Check if we need to expand any new folders
      const needsExpansion = parentFolders.some((folder) => !prev.has(folder));
      if (!needsExpansion) return prev;

      const next = new Set(prev);
      for (const folder of parentFolders) {
        next.add(folder);
      }
      return next;
    });
  }, [selectedFile]);

  // Fetch git file status
  const { data: fileStatusData } = useQuery({
    ...gitFileStatusQuery(projectId),
    staleTime: 1000 * 30, // 30 seconds cache
    refetchOnWindowFocus: false,
  });

  // Build file statuses map from response
  const fileStatuses = useMemo((): Record<string, FileStatus> => {
    if (!fileStatusData?.files) {
      return {};
    }
    // The API returns paths relative to project root
    // We need to prefix with "/" to match our tree paths
    const statuses: Record<string, FileStatus> = {};
    for (const [path, status] of Object.entries(fileStatusData.files)) {
      const fullPath = path.startsWith("/") ? path : `/${path}`;
      statuses[fullPath] = status;
    }
    return statuses;
  }, [fileStatusData]);

  // Toggle folder expansion
  const handleToggle = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle file selection
  const handleSelect = useCallback(
    (path: string) => {
      onFileSelect(path);
    },
    [onFileSelect],
  );

  // Handle loading state changes
  const handleLoadingChange = useCallback(
    (path: string, isLoading: boolean) => {
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        if (isLoading) {
          next.add(path);
        } else {
          next.delete(path);
        }
        return next;
      });
    },
    [],
  );

  // Create a virtual root entry for the project
  const rootEntry: FileCompletionEntry = useMemo(
    () => ({
      name: projectPath.split("/").pop() || projectPath,
      type: "directory",
      path: "/",
    }),
    [projectPath],
  );

  const isRootExpanded = expandedFolders.has("/");
  const isRootLoading = loadingFolders.has("/");

  return (
    <div
      className="overflow-y-auto h-full"
      role="tree"
      aria-label="File explorer"
    >
      {/* Root folder */}
      <FileTreeNode
        entry={rootEntry}
        depth={0}
        isExpanded={isRootExpanded}
        isSelected={false}
        isLoading={isRootLoading}
        gitStatus={undefined}
        onToggle={handleToggle}
        onSelect={handleSelect}
      >
        {/* Root folder contents */}
        {isRootExpanded && (
          <FolderContents
            projectId={projectId}
            folderPath="/"
            depth={1}
            expandedFolders={expandedFolders}
            loadingFolders={loadingFolders}
            selectedFile={selectedFile}
            fileStatuses={fileStatuses}
            commentCountByFile={commentCountByFile}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onLoadingChange={handleLoadingChange}
          />
        )}
      </FileTreeNode>
    </div>
  );
};

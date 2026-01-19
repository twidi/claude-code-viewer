"use client";

import { Trans } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { FC } from "react";
import { z } from "zod";
import type { FileExplorerCommentsMap } from "@/contexts/FileExplorerCommentContext";
import { honoClient } from "@/lib/api/client";
import type { FileContentResponse } from "@/server/core/file-system/functions/getFileContent";
import { BinaryFileMessage } from "./BinaryFileMessage";
import { FileContentViewer } from "./FileContentViewer";
import { ImageViewer } from "./ImageViewer";
import type { FileViewOptions } from "./types";

/**
 * Zod schema for API error response
 */
const ErrorResponseSchema = z.object({
  error: z.string(),
});

/**
 * Zod schema to validate FileContentResponse from the API
 */
const FileContentResponseSchema = z.object({
  content: z.string(),
  encoding: z.enum(["utf-8", "base64"]),
  mimeType: z.string(),
  size: z.number(),
  fileType: z.enum(["text", "image", "binary"]),
});

/**
 * Query factory for fetching file content.
 * The API returns FileContentResponse directly on success (status 200),
 * or throws on error (non-200 status codes).
 */
const fileContentQuery = (projectId: string, filePath: string) =>
  ({
    queryKey: ["file-content", projectId, filePath],
    queryFn: async (): Promise<FileContentResponse> => {
      const response = await honoClient.api.fs["file-content"].$get({
        query: { projectId, filePath },
      });

      if (!response.ok) {
        // Try to get error message from response body
        try {
          const errorBody: unknown = await response.json();
          const parseResult = ErrorResponseSchema.safeParse(errorBody);
          if (parseResult.success) {
            throw new Error(parseResult.data.error);
          }
          throw new Error(response.statusText);
        } catch (e) {
          // If JSON parsing failed or other error, use status text
          if (e instanceof Error && e.message !== response.statusText) {
            throw e;
          }
          throw new Error(response.statusText);
        }
      }

      // The API returns FileContentResponse directly on success
      const data: unknown = await response.json();
      const parseResult = FileContentResponseSchema.safeParse(data);
      if (!parseResult.success) {
        throw new Error("Invalid response format from file content API");
      }
      return parseResult.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  }) as const;

export interface FileViewerProps {
  /** Project ID for API calls */
  projectId: string;
  /** Path to the file (relative to project root) */
  filePath: string;
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
 * FileViewer - Routes between different viewer components based on file type.
 *
 * This component fetches the file content and renders the appropriate viewer:
 * - Text files: FileContentViewer (with syntax highlighting and comments)
 * - Images: ImageViewer (renders base64 images)
 * - Binary files: BinaryFileMessage (shows file info with a warning)
 */
export const FileViewer: FC<FileViewerProps> = ({
  projectId,
  filePath,
  options,
  comments,
  onAddComment,
  onUpdateComment,
  onRemoveComment,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["file-content", projectId, filePath],
    queryFn: fileContentQuery(projectId, filePath).queryFn,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: !!projectId && !!filePath,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  // Error state (includes API errors like 404, 400, etc.)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <p className="text-red-500 dark:text-red-400 text-sm mb-2">
          <Trans id="file_explorer.error.load_failed" />
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          {error.message}
        </p>
      </div>
    );
  }

  // No data - should not happen if query succeeded
  if (!data) {
    return null;
  }

  const fileData = data;
  const fileName = filePath.split("/").pop() ?? filePath;

  // Binary file - show metadata only
  if (fileData.fileType === "binary") {
    return <BinaryFileMessage fileName={fileName} size={fileData.size} />;
  }

  // Image file - render with ImageViewer
  if (fileData.fileType === "image") {
    return (
      <ImageViewer
        content={fileData.content}
        mimeType={fileData.mimeType}
        fileName={fileName}
      />
    );
  }

  // Text file - render with FileContentViewer
  return (
    <FileContentViewer
      content={fileData.content}
      fileName={filePath}
      options={options}
      comments={comments}
      onAddComment={onAddComment}
      onUpdateComment={onUpdateComment}
      onRemoveComment={onRemoveComment}
    />
  );
};

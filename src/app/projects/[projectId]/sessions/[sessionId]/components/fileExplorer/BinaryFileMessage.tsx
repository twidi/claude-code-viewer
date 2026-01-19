import { Trans } from "@lingui/react";
import { FileWarning } from "lucide-react";
import type { FC } from "react";

/**
 * Formats byte size to a human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BinaryFileMessageProps {
  /** Name of the binary file */
  fileName: string;
  /** Size of the file in bytes */
  size: number;
}

/**
 * Component displayed when a binary file is selected.
 * Shows file name, size, and a message indicating the file cannot be displayed.
 */
export const BinaryFileMessage: FC<BinaryFileMessageProps> = ({
  fileName,
  size,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-4 p-8">
      <FileWarning className="w-12 h-12 text-amber-500 dark:text-amber-400" />
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 break-all">
          {fileName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatSize(size)}
        </p>
        <p className="text-sm">
          <Trans id="file_explorer.binary_file.cannot_display" />
        </p>
      </div>
    </div>
  );
};

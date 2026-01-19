import { Trans } from "@lingui/react";
import { FileText } from "lucide-react";
import type { FC } from "react";

/**
 * Component displayed when no file is selected in the file explorer.
 * Shows a centered message with an icon prompting the user to select a file.
 */
export const EmptyState: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-4 p-8">
      <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      <p className="text-sm text-center">
        <Trans id="file_explorer.empty_state" />
      </p>
    </div>
  );
};

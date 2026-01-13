import { Trans } from "@lingui/react";
import { PaperclipIcon } from "lucide-react";
import { type FC, useRef } from "react";
import { SUPPORTED_MIME_TYPES } from "@/app/projects/[projectId]/components/chatForm/fileUtils";
import { Button } from "@/components/ui/button";

export interface AttachButtonProps {
  /** Called when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: "ghost" | "outline" | "default";
  /** Button size */
  size?: "sm" | "default" | "lg";
}

export const AttachButton: FC<AttachButtonProps> = ({
  onFilesSelected,
  disabled = false,
  variant = "ghost",
  size = "sm",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onFilesSelected(Array.from(files));

    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SUPPORTED_MIME_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="gap-1.5"
      >
        <PaperclipIcon className="w-4 h-4" />
        <span className="text-xs">
          <Trans id="chat.attach_file" />
        </span>
      </Button>
    </>
  );
};

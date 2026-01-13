import { FileText, Image as ImageIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import type {
  DocumentBlockParam,
  ImageBlockParam,
} from "@/server/core/claude-code/schema";

/** Represents an existing encoded attachment */
export type ExistingAttachment =
  | { type: "image"; data: ImageBlockParam; id: string }
  | { type: "document"; data: DocumentBlockParam; id: string };

/** Represents a new file not yet encoded */
export type NewFileAttachment = {
  file: File;
  id: string;
};

export interface AttachmentListProps {
  /** Existing attachments (already encoded as base64/text) */
  existingAttachments: ExistingAttachment[];
  /** New files (not yet encoded) */
  newFiles: NewFileAttachment[];
  /** Called when removing an existing attachment */
  onRemoveExisting: (id: string) => void;
  /** Called when removing a new file */
  onRemoveNew: (id: string) => void;
  /** Whether the list is disabled */
  disabled?: boolean;
}

/** Get display label for an existing attachment */
const getExistingLabel = (attachment: ExistingAttachment): string => {
  if (attachment.type === "image") {
    return attachment.data.source.media_type;
  }
  return attachment.data.source.media_type;
};

/** Get icon for attachment type */
const getAttachmentIcon = (
  type: "image" | "document" | "text",
): FC<{ className?: string }> => {
  if (type === "image") return ImageIcon;
  return FileText;
};

/** Determine attachment type from MIME */
const getTypeFromMime = (mimeType: string): "image" | "document" | "text" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "document";
  return "text";
};

export const AttachmentList: FC<AttachmentListProps> = ({
  existingAttachments,
  newFiles,
  onRemoveExisting,
  onRemoveNew,
  disabled = false,
}) => {
  const hasAttachments = existingAttachments.length > 0 || newFiles.length > 0;

  if (!hasAttachments) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Existing attachments */}
      {existingAttachments.map((attachment) => {
        const label = getExistingLabel(attachment);
        const Icon = getAttachmentIcon(attachment.type);

        return (
          <div
            key={attachment.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="truncate max-w-[150px]">{label}</span>
            <button
              type="button"
              onClick={() => onRemoveExisting(attachment.id)}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              disabled={disabled}
              aria-label={`Remove ${label}`}
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* New files */}
      {newFiles.map(({ file, id }) => {
        const type = getTypeFromMime(file.type);
        const Icon = getAttachmentIcon(type);

        return (
          <div
            key={id}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="truncate max-w-[150px]">{file.name}</span>
            <button
              type="button"
              onClick={() => onRemoveNew(id)}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              disabled={disabled}
              aria-label={`Remove ${file.name}`}
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

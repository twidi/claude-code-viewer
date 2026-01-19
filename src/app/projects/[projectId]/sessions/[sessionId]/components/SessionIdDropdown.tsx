import { useLingui } from "@lingui/react";
import { CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react";
import { type FC, useCallback, useState } from "react";
import { toast } from "sonner";
import { useConfig } from "@/app/hooks/useConfig";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PermissionMode } from "@/types/session-process";

type SessionIdDropdownProps = {
  sessionId: string;
  jsonlFilePath: string;
  runningPermissionMode?: PermissionMode;
};

type CopiedItem = "id" | "command" | "path" | null;

export const SessionIdDropdown: FC<SessionIdDropdownProps> = ({
  sessionId,
  jsonlFilePath,
  runningPermissionMode,
}) => {
  const { i18n } = useLingui();
  const { config } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<CopiedItem>(null);

  const truncatedId = `${sessionId.slice(0, 8)}...`;

  // Use running session's permission mode if available, otherwise use config default
  const permissionMode =
    runningPermissionMode ?? config?.permissionMode ?? "default";
  const resumeCommand = `claude --permissionMode ${permissionMode} --resume ${sessionId}`;

  const handleCopy = useCallback(
    async (text: string, item: CopiedItem) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedItem(item);
        toast.success(i18n._({ id: "session_id.copied" }));
        setTimeout(() => setCopiedItem(null), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        toast.error(i18n._({ id: "session_id.copy_failed" }));
      }
    },
    [i18n],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="secondary"
          className="h-6 text-xs flex items-center gap-1 max-w-full font-mono cursor-pointer hover:bg-secondary/80"
        >
          <span className="truncate">{truncatedId}</span>
          <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-md p-2">
        <div className="space-y-2">
          <CopyableRow
            label={i18n._({ id: "session_id.label" })}
            value={sessionId}
            isCopied={copiedItem === "id"}
            onCopy={() => handleCopy(sessionId, "id")}
          />
          <CopyableRow
            label={i18n._({ id: "session_id.resume_command" })}
            value={resumeCommand}
            isCopied={copiedItem === "command"}
            onCopy={() => handleCopy(resumeCommand, "command")}
          />
          <CopyableRow
            label={i18n._({ id: "session_id.file_path" })}
            value={jsonlFilePath}
            isCopied={copiedItem === "path"}
            onCopy={() => handleCopy(jsonlFilePath, "path")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

type CopyableRowProps = {
  label: string;
  value: string;
  isCopied: boolean;
  onCopy: () => void;
};

const CopyableRow: FC<CopyableRowProps> = ({
  label,
  value,
  isCopied,
  onCopy,
}) => {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-full text-left group hover:bg-muted/50 rounded p-1.5 transition-colors"
    >
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono break-all flex-1">{value}</code>
        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCopied ? (
            <CheckIcon className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <CopyIcon className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </span>
      </div>
    </button>
  );
};

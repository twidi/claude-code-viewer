import { Trans, useLingui } from "@lingui/react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderOpenIcon,
  GitCompareIcon,
  GlobeIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { FC } from "react";
import { useConfig } from "@/app/hooks/useConfig";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDiffLineComment } from "@/contexts/DiffLineCommentContext";
import { useFileExplorerComment } from "@/contexts/FileExplorerCommentContext";
import { usePersistentDialogs } from "@/contexts/PersistentDialogsContext";
import { useBrowserPreview } from "../../../../../../../hooks/useBrowserPreview";

interface ChatActionMenuProps {
  projectId: string;
  isPending?: boolean;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  onForceReload?: () => void;
  isReloading?: boolean;
  isNewChat?: boolean;
}

export const ChatActionMenu: FC<ChatActionMenuProps> = ({
  projectId,
  isPending = false,
  onScrollToTop,
  onScrollToBottom,
  onForceReload,
  isReloading = false,
  isNewChat = false,
}) => {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const { openPreview } = useBrowserPreview();
  const { config, updateConfig } = useConfig();
  const persistentDialogs = usePersistentDialogs();
  const { nonEmptyCommentCount: diffCommentCount } = useDiffLineComment();
  const { nonEmptyCommentCount: fileExplorerCommentCount } =
    useFileExplorerComment();

  const fullView = !(config?.simplifiedView ?? false);

  const handleFullViewChange = (checked: boolean) => {
    updateConfig({
      ...config,
      simplifiedView: !checked,
    });
  };

  const handleStartNewChat = () => {
    navigate({
      to: "/projects/$projectId/session",
      params: { projectId },
      search: (prev) => {
        const { sessionId: _removed, ...rest } = prev;
        return rest;
      },
    });
  };

  return (
    <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 mb-1">
      <div className="py-0 flex items-center gap-1.5 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => persistentDialogs?.toggle("git")}
          disabled={isPending}
          className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40 relative"
          title={i18n._({
            id: "control.open_git_dialog",
            message: "Open Git Dialog",
          })}
        >
          <GitCompareIcon className="w-3.5 h-3.5" />
          <span>
            <Trans id="control.git" />
          </span>
          {diffCommentCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-medium bg-blue-500 text-white rounded-full px-1">
              {diffCommentCount}
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => persistentDialogs?.toggle("file-explorer")}
          disabled={isPending}
          className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40 relative"
          title={i18n._({
            id: "control.open_file_explorer",
            message: "Open File Explorer",
          })}
        >
          <FolderOpenIcon className="w-3.5 h-3.5" />
          <span>
            <Trans id="control.files" />
          </span>
          {fileExplorerCommentCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-medium bg-blue-500 text-white rounded-full px-1">
              {fileExplorerCommentCount}
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openPreview("about:blank")}
          disabled={isPending}
          className="h-7 px-2 text-xs bg-muted/20 rounded-lg border border-border/40"
          title={i18n._({
            id: "control.open_browser",
            message: "Open Browser",
          })}
        >
          <GlobeIcon className="w-3.5 h-3.5" />
        </Button>
        <div className="flex items-center gap-1.5 h-7 px-2 text-xs bg-muted/20 rounded-lg border border-border/40">
          <Switch
            id="full-view-toggle"
            checked={fullView}
            onCheckedChange={handleFullViewChange}
          />
          <Label
            htmlFor="full-view-toggle"
            className="text-xs cursor-pointer select-none"
          >
            <Trans id="control.full_view" />
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending || isNewChat}
          className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40"
          onClick={handleStartNewChat}
          title={i18n._({
            id: "control.new_chat",
            message: "New Chat",
          })}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>
            <Trans id="control.new" />
          </span>
        </Button>
        {onScrollToTop && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onScrollToTop}
            disabled={isPending}
            className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40"
            title={i18n._({
              id: "control.scroll_to_top",
              message: "Scroll to Top",
            })}
          >
            <ArrowUpIcon className="w-3.5 h-3.5" />
          </Button>
        )}
        {onScrollToBottom && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onScrollToBottom}
            disabled={isPending}
            className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40"
            title={i18n._({
              id: "control.scroll_to_bottom",
              message: "Scroll to Bottom",
            })}
          >
            <ArrowDownIcon className="w-3.5 h-3.5" />
          </Button>
        )}
        {onForceReload && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onForceReload}
            disabled={isPending || isReloading}
            className="h-7 px-2 gap-1.5 text-xs bg-muted/20 rounded-lg border border-border/40"
            title={i18n._({
              id: "control.force_reload",
              message: "Force Reload",
            })}
          >
            {isReloading ? (
              <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

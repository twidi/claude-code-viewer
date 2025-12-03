import { Trans } from "@lingui/react";
import { ShieldCheckIcon, ShieldIcon, ShieldOffIcon } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import type { PermissionMode } from "../../../../../../../types/session-process";

const permissionModeConfig: Record<
  PermissionMode,
  {
    icon: typeof ShieldIcon;
    labelId: string;
    className: string;
  }
> = {
  default: {
    icon: ShieldIcon,
    labelId: "settings.permission.mode.default",
    className:
      "bg-blue-500/10 text-blue-900 dark:text-blue-200 border-blue-500/20",
  },
  acceptEdits: {
    icon: ShieldCheckIcon,
    labelId: "settings.permission.mode.accept_edits",
    className:
      "bg-yellow-500/10 text-yellow-900 dark:text-yellow-200 border-yellow-500/20",
  },
  bypassPermissions: {
    icon: ShieldOffIcon,
    labelId: "settings.permission.mode.bypass_permissions",
    className:
      "bg-orange-500/10 text-orange-900 dark:text-orange-200 border-orange-500/20",
  },
  plan: {
    icon: ShieldIcon,
    labelId: "settings.permission.mode.plan",
    className:
      "bg-purple-500/10 text-purple-900 dark:text-purple-200 border-purple-500/20",
  },
};

interface PermissionModeBadgeProps {
  permissionMode: PermissionMode;
}

export const PermissionModeBadge: FC<PermissionModeBadgeProps> = ({
  permissionMode,
}) => {
  const config = permissionModeConfig[permissionMode];
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="w-3.5 h-3.5" />
      <Trans id={config.labelId} />
    </Badge>
  );
};

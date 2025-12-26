import { Trans } from "@lingui/react";
import { useAtom } from "jotai";
import { type FC, useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type NotificationSoundType,
  notificationSettingsAtom,
} from "@/lib/atoms/notifications";
import {
  getAvailableSoundTypes,
  getBrowserNotificationPermission,
  getSoundDisplayName,
  isBrowserNotificationSupported,
  playNotificationSound,
  requestBrowserNotificationPermission,
} from "@/lib/notifications";

interface NotificationSettingsProps {
  showLabels?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

export const NotificationSettings: FC<NotificationSettingsProps> = ({
  showLabels = true,
  showDescriptions = true,
  className = "",
}: NotificationSettingsProps) => {
  const selectId = useId();
  const [settings, setSettings] = useAtom(notificationSettingsAtom);
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >(() => getBrowserNotificationPermission());

  const handleSoundTypeChange = useCallback(
    (value: NotificationSoundType) => {
      setSettings((prev) => ({
        ...prev,
        soundType: value,
      }));
    },
    [setSettings],
  );

  const handleTestSound = useCallback(() => {
    if (settings.soundType !== "none") {
      playNotificationSound(settings.soundType);
    }
  }, [settings.soundType]);

  const handleRequestPermission = useCallback(async () => {
    const permission = await requestBrowserNotificationPermission();
    setPermissionStatus(permission);
    if (permission === "granted") {
      setSettings((prev) => ({
        ...prev,
        browserNotificationsEnabled: true,
      }));
    }
  }, [setSettings]);

  const handleToggleBrowserNotifications = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      browserNotificationsEnabled: !prev.browserNotificationsEnabled,
    }));
  }, [setSettings]);

  const availableSoundTypes = getAvailableSoundTypes();
  const browserNotificationsSupported = isBrowserNotificationSupported();

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        {showLabels && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium leading-none"
          >
            Task completion sound
          </label>
        )}

        <div className="flex items-center gap-2">
          <Select
            value={settings.soundType}
            onValueChange={handleSoundTypeChange}
          >
            <SelectTrigger id={selectId} className="w-[180px]">
              <SelectValue placeholder="音を選択" />
            </SelectTrigger>
            <SelectContent>
              {availableSoundTypes.map((soundType) => (
                <SelectItem key={soundType} value={soundType}>
                  {getSoundDisplayName(soundType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.soundType !== "none" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSound}
              className="px-3"
            >
              <Trans id="notification.test" />
            </Button>
          )}
        </div>

        {showDescriptions && (
          <p className="text-xs text-muted-foreground">
            <Trans id="notification.description" />
          </p>
        )}
      </div>

      {browserNotificationsSupported && (
        <div className="space-y-2">
          {showLabels && (
            <span className="text-sm font-medium leading-none">
              <Trans id="notification.browser.label" />
            </span>
          )}

          <div className="flex items-center gap-2">
            {permissionStatus === "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestPermission}
              >
                <Trans id="notification.browser.enable" />
              </Button>
            )}

            {permissionStatus === "granted" && (
              <Button
                variant={
                  settings.browserNotificationsEnabled ? "default" : "outline"
                }
                size="sm"
                onClick={handleToggleBrowserNotifications}
              >
                {settings.browserNotificationsEnabled ? (
                  <Trans id="notification.browser.enabled" />
                ) : (
                  <Trans id="notification.browser.disabled" />
                )}
              </Button>
            )}

            {permissionStatus === "denied" && (
              <span className="text-sm text-muted-foreground">
                <Trans id="notification.browser.denied" />
              </span>
            )}
          </div>

          {showDescriptions && (
            <p className="text-xs text-muted-foreground">
              <Trans id="notification.browser.description" />
            </p>
          )}
        </div>
      )}
    </div>
  );
};

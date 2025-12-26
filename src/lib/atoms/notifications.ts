import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Available sound types for notifications
 */
export type NotificationSoundType = "none" | "beep" | "chime" | "ping" | "pop";

/**
 * Notification settings stored in localStorage
 */
export interface NotificationSettings {
  soundType: NotificationSoundType;
  browserNotificationsEnabled: boolean;
}

const defaultSettings: NotificationSettings = {
  soundType: "none",
  browserNotificationsEnabled: false,
};

/**
 * Atom for notification settings with localStorage persistence
 */
export const notificationSettingsAtom = atomWithStorage<NotificationSettings>(
  "claude-code-viewer-notification-settings",
  defaultSettings,
);

/**
 * Derived atom to check if sound notifications are enabled
 */
export const soundNotificationsEnabledAtom = atom((get) => {
  const settings = get(notificationSettingsAtom);
  return settings.soundType !== "none";
});

/**
 * Derived atom to check if browser notifications are enabled
 */
export const browserNotificationsEnabledAtom = atom((get) => {
  const settings = get(notificationSettingsAtom);
  return settings.browserNotificationsEnabled;
});

import z from "zod";
import { localeSchema } from "../../../lib/i18n/schema";

export const autoAbortAfterMinutesValues = [
  "15",
  "30",
  "60",
  "120",
  "180",
  "300",
  "600",
  "1440",
] as const;

export const userConfigSchema = z.object({
  hideNoUserMessageSession: z.boolean().optional().default(true),
  unifySameTitleSession: z.boolean().optional().default(false),
  enterKeyBehavior: z
    .enum(["shift-enter-send", "enter-send", "command-enter-send"])
    .optional()
    .default("shift-enter-send"),
  permissionMode: z
    .enum(["acceptEdits", "bypassPermissions", "default", "plan"])
    .optional()
    .default("default"),
  locale: localeSchema.optional().default("en"),
  theme: z.enum(["light", "dark", "system"]).optional().default("system"),
  searchHotkey: z.enum(["ctrl-k", "command-k"]).optional().default("command-k"),
  simplifiedView: z.boolean().optional().default(false),
  autoAbortAfterMinutes: z
    .enum(autoAbortAfterMinutesValues)
    .optional()
    .default("120"),
});

export const defaultUserConfig = userConfigSchema.parse({});

export type UserConfig = z.infer<typeof userConfigSchema>;

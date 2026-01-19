import { z } from "zod";

export const starredSessionsConfigSchema = z.object({
  starredSessionIds: z.array(z.string()),
});

export type StarredSessionsConfig = z.infer<typeof starredSessionsConfigSchema>;

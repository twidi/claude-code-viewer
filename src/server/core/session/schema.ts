import { z } from "zod";
import { parsedUserMessageSchema } from "../claude-code/functions/parseUserMessage";

export const MAX_CONTEXT_WINDOW_TOKENS = 200_000;

export const currentContextUsageSchema = z.object({
  tokens: z.number(),
  percentage: z.number(),
  maxTokens: z.number(),
});

export type CurrentContextUsage = z.infer<typeof currentContextUsageSchema>;

export const sessionMetaSchema = z.object({
  messageCount: z.number(),
  firstUserMessage: parsedUserMessageSchema.nullable(),
  cost: z.object({
    totalUsd: z.number(),
    breakdown: z.object({
      inputTokensUsd: z.number(),
      outputTokensUsd: z.number(),
      cacheCreationUsd: z.number(),
      cacheReadUsd: z.number(),
    }),
    tokenUsage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      cacheCreationTokens: z.number(),
      cacheReadTokens: z.number(),
    }),
  }),
  currentContextUsage: currentContextUsageSchema.nullable(),
});

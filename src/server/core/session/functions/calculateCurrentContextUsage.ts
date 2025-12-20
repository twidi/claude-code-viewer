import type { ExtendedConversation } from "../../types";
import { type CurrentContextUsage, MAX_CONTEXT_WINDOW_TOKENS } from "../schema";

/**
 * Calculates the current context window usage based on the last valid assistant message.
 *
 * The input_tokens of the last assistant message represents the total context
 * sent to the API at that moment (system prompt + conversation history).
 * Cache tokens are part of this context and count toward the window limit.
 *
 * Only main chain messages are considered (not sidechains/agents) and
 * API error messages are excluded.
 */
export const calculateCurrentContextUsage = (
  conversations: ExtendedConversation[],
): CurrentContextUsage | null => {
  // Find the last valid assistant message (not sidechain, not API error)
  const lastValidAssistant = findLastValidAssistantMessage(conversations);

  if (lastValidAssistant === null) {
    return null;
  }

  const usage = lastValidAssistant.message.usage;

  // Total context = input tokens + cache tokens (both creation and read)
  // Cache tokens are part of the context window
  const tokens =
    usage.input_tokens +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);

  const percentage = (tokens / MAX_CONTEXT_WINDOW_TOKENS) * 100;

  return {
    tokens,
    percentage,
    maxTokens: MAX_CONTEXT_WINDOW_TOKENS,
  };
};

/**
 * Finds the last assistant message that is:
 * - Not a sidechain (agent) message
 * - Not an API error message
 * - Not an error from parsing
 */
const findLastValidAssistantMessage = (
  conversations: ExtendedConversation[],
): Extract<ExtendedConversation, { type: "assistant" }> | null => {
  for (let i = conversations.length - 1; i >= 0; i--) {
    const conversation = conversations[i];

    if (conversation === undefined) {
      continue;
    }

    // Skip parsing errors
    if (conversation.type === "x-error") {
      continue;
    }

    if (conversation.type !== "assistant") {
      continue;
    }

    // Skip sidechain messages (agent calls)
    if (conversation.isSidechain) {
      continue;
    }

    // Skip API error messages
    if (conversation.isApiErrorMessage === true) {
      continue;
    }

    return conversation;
  }

  return null;
};

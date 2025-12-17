import type { PendingMessage } from "../hooks/usePendingMessages";

/**
 * Formats queued messages into a single string with appropriate context.
 *
 * Single message:
 * [Note: While you were working, the user added a follow-up message:]
 *
 * <message text>
 *
 * Multiple messages:
 * [Note: While you were working, the user added N follow-up messages:
 *
 * [follow-up message 1]
 *
 * <first message text>
 *
 * [follow-up message 2]
 *
 * <second message text>
 *
 * @param messages - Array of pending messages to format
 * @returns Formatted string, or empty string if no messages
 */
export function formatQueuedMessages(messages: PendingMessage[]): string {
  if (messages.length === 0) {
    return "";
  }

  const [firstMessage] = messages;
  if (messages.length === 1 && firstMessage) {
    return `[Note: While you were working, the user added a follow-up message:]

${firstMessage.text}`;
  }

  // Multiple messages
  const header = `[Note: While you were working, the user added ${messages.length} follow-up messages:`;
  const formattedMessages = messages.map((message, index) => {
    return `[follow-up message ${index + 1}]

${message.text}`;
  });

  return `${header}

${formattedMessages.join("\n\n")}`;
}

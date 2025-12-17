import { describe, expect, test } from "vitest";
import type { PendingMessage } from "../hooks/usePendingMessages";
import { formatQueuedMessages } from "./formatQueuedMessages";

describe("formatQueuedMessages", () => {
  test("returns empty string for empty array", () => {
    const result = formatQueuedMessages([]);
    expect(result).toBe("");
  });

  test("formats single message without numbering", () => {
    const messages: PendingMessage[] = [
      {
        text: "Can you help me with this?",
        queuedAt: "2025-12-17T10:00:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);
    const expected = `[Note: While you were working, the user added a follow-up message:]

Can you help me with this?`;

    expect(result).toBe(expected);
  });

  test("formats multiple messages with numbering", () => {
    const messages: PendingMessage[] = [
      {
        text: "First question",
        queuedAt: "2025-12-17T10:00:00Z",
      },
      {
        text: "Second question",
        queuedAt: "2025-12-17T10:01:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);
    const expected = `[Note: While you were working, the user added 2 follow-up messages:

[follow-up message 1]

First question

[follow-up message 2]

Second question`;

    expect(result).toBe(expected);
  });

  test("formats three messages with correct numbering", () => {
    const messages: PendingMessage[] = [
      {
        text: "Message one",
        queuedAt: "2025-12-17T10:00:00Z",
      },
      {
        text: "Message two",
        queuedAt: "2025-12-17T10:01:00Z",
      },
      {
        text: "Message three",
        queuedAt: "2025-12-17T10:02:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);
    const expected = `[Note: While you were working, the user added 3 follow-up messages:

[follow-up message 1]

Message one

[follow-up message 2]

Message two

[follow-up message 3]

Message three`;

    expect(result).toBe(expected);
  });

  test("preserves message text with special characters", () => {
    const messages: PendingMessage[] = [
      {
        text: "Test with\nnewlines\nand\ttabs",
        queuedAt: "2025-12-17T10:00:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);
    const expected = `[Note: While you were working, the user added a follow-up message:]

Test with
newlines
and\ttabs`;

    expect(result).toBe(expected);
  });

  test("handles empty message text", () => {
    const messages: PendingMessage[] = [
      {
        text: "",
        queuedAt: "2025-12-17T10:00:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);
    const expected = `[Note: While you were working, the user added a follow-up message:]

`;

    expect(result).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import type { AssistantEntry } from "@/lib/conversation-schema/entry/AssistantEntrySchema";
import type { ExtendedConversation } from "../../types";
import { calculateCurrentContextUsage } from "./calculateCurrentContextUsage";

const createAssistantEntry = (
  overrides: {
    inputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    isSidechain?: boolean;
    isApiErrorMessage?: boolean;
  } = {},
): AssistantEntry => ({
  type: "assistant",
  isSidechain: overrides.isSidechain ?? false,
  isApiErrorMessage: overrides.isApiErrorMessage,
  userType: "external",
  cwd: "/path/to/project",
  sessionId: "test-session-id",
  version: "1.0.0",
  uuid: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  parentUuid: null,
  message: {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [{ type: "text", text: "Test response" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: overrides.inputTokens ?? 1000,
      output_tokens: 100,
      cache_creation_input_tokens: overrides.cacheCreationTokens,
      cache_read_input_tokens: overrides.cacheReadTokens,
    },
  },
});

describe("calculateCurrentContextUsage", () => {
  it("should return null when there are no conversations", () => {
    const result = calculateCurrentContextUsage([]);
    expect(result).toBeNull();
  });

  it("should return null when there are no assistant messages", () => {
    const conversations: ExtendedConversation[] = [
      {
        type: "user",
        isSidechain: false,
        userType: "external",
        cwd: "/path",
        sessionId: "test",
        version: "1.0.0",
        uuid: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        parentUuid: null,
        message: { role: "user", content: "Hello" },
      },
    ];

    const result = calculateCurrentContextUsage(conversations);
    expect(result).toBeNull();
  });

  it("should calculate context from the last valid assistant message", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 5000 }),
      createAssistantEntry({ inputTokens: 10000 }),
      createAssistantEntry({ inputTokens: 15000 }),
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(15000);
    expect(result?.percentage).toBeCloseTo(7.5, 1); // 15000 / 200000 * 100
    expect(result?.maxTokens).toBe(200000);
  });

  it("should include cache tokens in the calculation", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({
        inputTokens: 10000,
        cacheCreationTokens: 5000,
        cacheReadTokens: 3000,
      }),
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(18000); // 10000 + 5000 + 3000
    expect(result?.percentage).toBeCloseTo(9, 1); // 18000 / 200000 * 100
  });

  it("should skip sidechain messages", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 5000 }),
      createAssistantEntry({ inputTokens: 100000, isSidechain: true }), // This should be skipped
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(5000); // Should use first message, not sidechain
  });

  it("should skip API error messages", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 5000 }),
      createAssistantEntry({ inputTokens: 100000, isApiErrorMessage: true }), // This should be skipped
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(5000); // Should use first message, not error
  });

  it("should skip parsing error entries", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 5000 }),
      {
        type: "x-error",
        line: '{"invalid": "json',
        lineNumber: 5,
      },
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(5000);
  });

  it("should handle undefined cache tokens", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({
        inputTokens: 10000,
        cacheCreationTokens: undefined,
        cacheReadTokens: undefined,
      }),
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(10000); // Only input tokens
  });

  it("should return correct percentage for high context usage", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 180000 }),
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.percentage).toBeCloseTo(90, 1);
  });

  it("should find the last valid message among mixed types", () => {
    const conversations: ExtendedConversation[] = [
      createAssistantEntry({ inputTokens: 5000 }), // valid
      createAssistantEntry({ inputTokens: 50000, isSidechain: true }), // skip
      createAssistantEntry({ inputTokens: 10000 }), // valid - should use this
      createAssistantEntry({ inputTokens: 80000, isApiErrorMessage: true }), // skip
    ];

    const result = calculateCurrentContextUsage(conversations);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBe(10000);
  });
});

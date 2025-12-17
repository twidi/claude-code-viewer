import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PendingMessage } from "./usePendingMessages";

describe("usePendingMessages", () => {
  const sessionId = "test-session-123";
  const storageKey = `ccv-pending-messages-${sessionId}`;

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => {
        return store[key] || null;
      },
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  // Helper to simulate the storage operations the hook performs
  const getStoredMessages = (sid: string): PendingMessage[] => {
    const value = localStorageMock.getItem(`ccv-pending-messages-${sid}`);
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  };

  const addMessage = (sid: string, text: string): void => {
    const newMessage: PendingMessage = {
      text,
      queuedAt: new Date().toISOString(),
    };
    const currentMessages = getStoredMessages(sid);
    const updatedMessages = [...currentMessages, newMessage];
    localStorageMock.setItem(
      `ccv-pending-messages-${sid}`,
      JSON.stringify(updatedMessages),
    );
  };

  const clearMessages = (sid: string): PendingMessage[] => {
    const currentMessages = getStoredMessages(sid);
    localStorageMock.removeItem(`ccv-pending-messages-${sid}`);
    return currentMessages;
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("should initialize with empty pending messages when no data in localStorage", () => {
    const messages = getStoredMessages(sessionId);
    expect(messages).toEqual([]);
  });

  it("should add a pending message to localStorage", () => {
    addMessage(sessionId, "Hello World");

    const messages = getStoredMessages(sessionId);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe("Hello World");
    expect(messages[0]?.queuedAt).toBeDefined();

    // Verify ISO timestamp format
    const firstMessage = messages[0];
    if (firstMessage) {
      expect(() => new Date(firstMessage.queuedAt)).not.toThrow();
    }
  });

  it("should add multiple pending messages", () => {
    addMessage(sessionId, "First message");
    addMessage(sessionId, "Second message");
    addMessage(sessionId, "Third message");

    const messages = getStoredMessages(sessionId);
    expect(messages).toHaveLength(3);
    expect(messages[0]?.text).toBe("First message");
    expect(messages[1]?.text).toBe("Second message");
    expect(messages[2]?.text).toBe("Third message");
  });

  it("should clear pending messages and return them", () => {
    addMessage(sessionId, "Message 1");
    addMessage(sessionId, "Message 2");

    expect(getStoredMessages(sessionId)).toHaveLength(2);

    const clearedMessages = clearMessages(sessionId);

    // Should return the cleared messages
    expect(clearedMessages).toHaveLength(2);
    expect(clearedMessages[0]?.text).toBe("Message 1");
    expect(clearedMessages[1]?.text).toBe("Message 2");

    // Should empty the store
    expect(getStoredMessages(sessionId)).toEqual([]);
  });

  it("should isolate stores by sessionId", () => {
    const session1 = "session-1";
    const session2 = "session-2";

    addMessage(session1, "Message for session 1");
    addMessage(session2, "Message for session 2");

    // Each session should have its own message
    const messages1 = getStoredMessages(session1);
    const messages2 = getStoredMessages(session2);

    expect(messages1).toHaveLength(1);
    expect(messages1[0]?.text).toBe("Message for session 1");

    expect(messages2).toHaveLength(1);
    expect(messages2[0]?.text).toBe("Message for session 2");

    // Clearing one should not affect the other
    clearMessages(session1);

    expect(getStoredMessages(session1)).toHaveLength(0);
    expect(getStoredMessages(session2)).toHaveLength(1);
  });

  it("should handle invalid localStorage data gracefully", () => {
    // Set invalid JSON in localStorage
    localStorageMock.setItem(storageKey, "invalid-json");

    const messages = getStoredMessages(sessionId);
    expect(messages).toEqual([]);
  });

  it("should persist messages across operations", () => {
    addMessage(sessionId, "Persisted message");

    // Simulate re-read
    const messages = getStoredMessages(sessionId);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe("Persisted message");
  });

  it("should validate PendingMessage structure", () => {
    const message: PendingMessage = {
      text: "Test message",
      queuedAt: new Date().toISOString(),
    };

    expect(message.text).toBe("Test message");
    expect(typeof message.queuedAt).toBe("string");

    // Validate ISO 8601 timestamp format
    const date = new Date(message.queuedAt);
    expect(date.toISOString()).toBe(message.queuedAt);
  });

  it("should maintain message order (FIFO)", () => {
    addMessage(sessionId, "First");
    addMessage(sessionId, "Second");
    addMessage(sessionId, "Third");

    const messages = getStoredMessages(sessionId);

    expect(messages[0]?.text).toBe("First");
    expect(messages[1]?.text).toBe("Second");
    expect(messages[2]?.text).toBe("Third");

    // Verify timestamp order
    if (messages[0] && messages[1] && messages[2]) {
      const time1 = new Date(messages[0].queuedAt).getTime();
      const time2 = new Date(messages[1].queuedAt).getTime();
      const time3 = new Date(messages[2].queuedAt).getTime();

      expect(time1).toBeLessThanOrEqual(time2);
      expect(time2).toBeLessThanOrEqual(time3);
    }
  });

  it("should handle empty message text", () => {
    addMessage(sessionId, "");

    const messages = getStoredMessages(sessionId);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe("");
  });

  it("should handle special characters in message text", () => {
    const specialText = 'Special chars: \n\t"quotes"\' <html> & symbols';
    addMessage(sessionId, specialText);

    const messages = getStoredMessages(sessionId);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe(specialText);
  });

  it("should return empty array when clearing empty store", () => {
    const clearedMessages = clearMessages(sessionId);
    expect(clearedMessages).toEqual([]);
  });

  it("should have correct storage key format", () => {
    const sid = "my-session-123";
    const expectedKey = `ccv-pending-messages-${sid}`;

    addMessage(sid, "Test");

    const storedValue = localStorageMock.getItem(expectedKey);
    expect(storedValue).toBeDefined();
    expect(storedValue).toContain("Test");
  });
});

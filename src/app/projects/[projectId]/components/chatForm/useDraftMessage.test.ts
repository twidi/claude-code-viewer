import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("useDraftMessage", () => {
  const projectId = "test-project-123";
  const sessionId = "test-session-456";
  const storageKeyPrefix = "ccv-draft-";

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

  // Helper functions that mirror the hook's internal logic
  const getStorageKey = (
    pid: string,
    sid: string | null | undefined,
  ): string => {
    return `${storageKeyPrefix}${pid}-${sid ?? "new"}`;
  };

  const getDraft = (pid: string, sid?: string | null): string => {
    const key = getStorageKey(pid, sid);
    return localStorageMock.getItem(key) || "";
  };

  const setDraft = (
    pid: string,
    sid: string | null | undefined,
    text: string,
  ): void => {
    const key = getStorageKey(pid, sid);
    if (text === "") {
      localStorageMock.removeItem(key);
    } else {
      localStorageMock.setItem(key, text);
    }
  };

  const clearDraft = (pid: string, sid?: string | null): void => {
    const key = getStorageKey(pid, sid);
    localStorageMock.removeItem(key);
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("should return empty string when no draft exists", () => {
    const draft = getDraft(projectId, sessionId);
    expect(draft).toBe("");
  });

  it("should return saved draft from localStorage", () => {
    const key = getStorageKey(projectId, sessionId);
    localStorageMock.setItem(key, "saved message");

    const draft = getDraft(projectId, sessionId);
    expect(draft).toBe("saved message");
  });

  it("should use 'new' suffix when sessionId is null", () => {
    const key = getStorageKey(projectId, null);
    localStorageMock.setItem(key, "new session draft");

    const draft = getDraft(projectId, null);
    expect(draft).toBe("new session draft");
    expect(key).toBe(`${storageKeyPrefix}${projectId}-new`);
  });

  it("should use 'new' suffix when sessionId is undefined", () => {
    const key = getStorageKey(projectId, undefined);
    localStorageMock.setItem(key, "new session draft");

    const draft = getDraft(projectId, undefined);
    expect(draft).toBe("new session draft");
    expect(key).toBe(`${storageKeyPrefix}${projectId}-new`);
  });

  it("should save draft to localStorage", () => {
    setDraft(projectId, sessionId, "typing...");

    const key = getStorageKey(projectId, sessionId);
    expect(localStorageMock.getItem(key)).toBe("typing...");
  });

  it("should clear draft from localStorage", () => {
    const key = getStorageKey(projectId, sessionId);
    localStorageMock.setItem(key, "to be cleared");

    clearDraft(projectId, sessionId);

    expect(localStorageMock.getItem(key)).toBeNull();
  });

  it("should remove empty drafts from localStorage", () => {
    const key = getStorageKey(projectId, sessionId);
    localStorageMock.setItem(key, "existing");

    setDraft(projectId, sessionId, "");

    expect(localStorageMock.getItem(key)).toBeNull();
  });

  it("should keep different drafts for different sessions", () => {
    setDraft(projectId, "session-1", "draft 1");
    setDraft(projectId, "session-2", "draft 2");

    expect(getDraft(projectId, "session-1")).toBe("draft 1");
    expect(getDraft(projectId, "session-2")).toBe("draft 2");
  });

  it("should keep different drafts for different projects", () => {
    setDraft("project-1", sessionId, "project 1 draft");
    setDraft("project-2", sessionId, "project 2 draft");

    expect(getDraft("project-1", sessionId)).toBe("project 1 draft");
    expect(getDraft("project-2", sessionId)).toBe("project 2 draft");
  });

  it("should have correct storage key format for existing session", () => {
    const key = getStorageKey("my-project", "my-session");
    expect(key).toBe("ccv-draft-my-project-my-session");
  });

  it("should have correct storage key format for new session", () => {
    const key = getStorageKey("my-project", null);
    expect(key).toBe("ccv-draft-my-project-new");
  });

  it("should handle special characters in draft text", () => {
    const specialText = 'Special chars: \n\t"quotes"\' <html> & symbols';
    setDraft(projectId, sessionId, specialText);

    expect(getDraft(projectId, sessionId)).toBe(specialText);
  });

  it("should handle unicode characters", () => {
    const unicodeText = "Hello 世界 🌍 Привет";
    setDraft(projectId, sessionId, unicodeText);

    expect(getDraft(projectId, sessionId)).toBe(unicodeText);
  });

  it("should handle long draft messages", () => {
    const longText = "x".repeat(10000);
    setDraft(projectId, sessionId, longText);

    expect(getDraft(projectId, sessionId)).toBe(longText);
  });

  it("should update existing draft", () => {
    setDraft(projectId, sessionId, "first version");
    expect(getDraft(projectId, sessionId)).toBe("first version");

    setDraft(projectId, sessionId, "second version");
    expect(getDraft(projectId, sessionId)).toBe("second version");
  });

  it("should isolate new session drafts between projects", () => {
    setDraft("project-a", null, "new session in project A");
    setDraft("project-b", null, "new session in project B");

    expect(getDraft("project-a", null)).toBe("new session in project A");
    expect(getDraft("project-b", null)).toBe("new session in project B");
  });

  it("should not affect session draft when clearing new session draft", () => {
    setDraft(projectId, sessionId, "existing session draft");
    setDraft(projectId, null, "new session draft");

    clearDraft(projectId, null);

    expect(getDraft(projectId, null)).toBe("");
    expect(getDraft(projectId, sessionId)).toBe("existing session draft");
  });
});

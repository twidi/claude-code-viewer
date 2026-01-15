import { describe, expect, test } from "vitest";
import type { PublicSessionProcess } from "@/types/session-process";
import {
  getSessionPriority,
  getStatusPriority,
  sortSessionsByStatusAndDate,
} from "./session-sorting";

describe("getSessionPriority", () => {
  test("returns 0 for active statuses (starting, pending, running)", () => {
    expect(getSessionPriority("starting", false)).toBe(0);
    expect(getSessionPriority("pending", false)).toBe(0);
    expect(getSessionPriority("running", false)).toBe(0);
  });

  test("returns 1 for paused status", () => {
    expect(getSessionPriority("paused", false)).toBe(1);
  });

  test("returns 2 for starred sessions without process", () => {
    expect(getSessionPriority(undefined, true)).toBe(2);
  });

  test("returns 3 for non-starred sessions without process", () => {
    expect(getSessionPriority(undefined, false)).toBe(3);
  });

  test("active and paused statuses take precedence over starred", () => {
    // Active sessions always have priority 0, even if starred
    expect(getSessionPriority("running", true)).toBe(0);
    expect(getSessionPriority("starting", true)).toBe(0);
    expect(getSessionPriority("pending", true)).toBe(0);

    // Paused sessions always have priority 1, even if starred
    expect(getSessionPriority("paused", true)).toBe(1);
  });
});

describe("getStatusPriority (deprecated)", () => {
  test("returns same as getSessionPriority with isStarred=false", () => {
    expect(getStatusPriority("starting")).toBe(0);
    expect(getStatusPriority("pending")).toBe(0);
    expect(getStatusPriority("running")).toBe(0);
    expect(getStatusPriority("paused")).toBe(1);
    expect(getStatusPriority(undefined)).toBe(3);
  });
});

describe("sortSessionsByStatusAndDate", () => {
  const createSession = (id: string, date: Date) => ({
    id,
    lastModifiedAt: date,
  });

  const createProcess = (
    sessionId: string,
    status: PublicSessionProcess["status"],
  ): PublicSessionProcess => ({
    id: `process-${sessionId}`,
    projectId: "project-1",
    sessionId,
    status,
    permissionMode: "default",
  });

  test("sorts running sessions before paused sessions", () => {
    const sessions = [
      createSession("session-paused", new Date("2024-01-01")),
      createSession("session-running", new Date("2024-01-01")),
    ];
    const processes = [
      createProcess("session-paused", "paused"),
      createProcess("session-running", "running"),
    ];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    expect(result.map((s) => s.id)).toEqual([
      "session-running",
      "session-paused",
    ]);
  });

  test("sorts paused sessions before sessions without process", () => {
    const sessions = [
      createSession("session-no-process", new Date("2024-01-01")),
      createSession("session-paused", new Date("2024-01-01")),
    ];
    const processes = [createProcess("session-paused", "paused")];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    expect(result.map((s) => s.id)).toEqual([
      "session-paused",
      "session-no-process",
    ]);
  });

  test("sorts by date within the same priority group", () => {
    const sessions = [
      createSession("session-old", new Date("2024-01-01")),
      createSession("session-new", new Date("2024-01-15")),
    ];
    const processes: PublicSessionProcess[] = [];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    expect(result.map((s) => s.id)).toEqual(["session-new", "session-old"]);
  });

  test("active sessions with older dates still appear before paused sessions with newer dates", () => {
    const sessions = [
      createSession("session-paused-new", new Date("2024-01-15")),
      createSession("session-running-old", new Date("2024-01-01")),
    ];
    const processes = [
      createProcess("session-paused-new", "paused"),
      createProcess("session-running-old", "running"),
    ];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    expect(result.map((s) => s.id)).toEqual([
      "session-running-old",
      "session-paused-new",
    ]);
  });

  test("handles all active statuses equally", () => {
    const sessions = [
      createSession("session-pending", new Date("2024-01-01")),
      createSession("session-running", new Date("2024-01-02")),
      createSession("session-starting", new Date("2024-01-03")),
    ];
    const processes = [
      createProcess("session-pending", "pending"),
      createProcess("session-running", "running"),
      createProcess("session-starting", "starting"),
    ];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    // All have priority 0, so sorted by date (newest first)
    expect(result.map((s) => s.id)).toEqual([
      "session-starting",
      "session-running",
      "session-pending",
    ]);
  });

  test("does not mutate the original array", () => {
    const sessions = [
      createSession("session-b", new Date("2024-01-01")),
      createSession("session-a", new Date("2024-01-15")),
    ];
    const originalOrder = sessions.map((s) => s.id);

    sortSessionsByStatusAndDate(sessions, []);

    expect(sessions.map((s) => s.id)).toEqual(originalOrder);
  });

  test("handles empty sessions array", () => {
    const result = sortSessionsByStatusAndDate([], []);
    expect(result).toEqual([]);
  });

  test("handles sessions with no matching processes", () => {
    const sessions = [
      createSession("session-a", new Date("2024-01-15")),
      createSession("session-b", new Date("2024-01-01")),
    ];

    const result = sortSessionsByStatusAndDate(sessions, []);

    // All have priority 3 (no process, not starred), so sorted by date
    expect(result.map((s) => s.id)).toEqual(["session-a", "session-b"]);
  });

  test("complex scenario: mixed statuses and dates", () => {
    const sessions = [
      createSession("no-process-old", new Date("2024-01-01")),
      createSession("paused-new", new Date("2024-01-20")),
      createSession("running-mid", new Date("2024-01-10")),
      createSession("no-process-new", new Date("2024-01-15")),
      createSession("starting-old", new Date("2024-01-05")),
      createSession("paused-old", new Date("2024-01-02")),
    ];
    const processes = [
      createProcess("paused-new", "paused"),
      createProcess("running-mid", "running"),
      createProcess("starting-old", "starting"),
      createProcess("paused-old", "paused"),
    ];

    const result = sortSessionsByStatusAndDate(sessions, processes);

    // Expected order:
    // Priority 0 (active): running-mid (Jan 10), starting-old (Jan 5)
    // Priority 1 (paused): paused-new (Jan 20), paused-old (Jan 2)
    // Priority 3 (no process, not starred): no-process-new (Jan 15), no-process-old (Jan 1)
    expect(result.map((s) => s.id)).toEqual([
      "running-mid",
      "starting-old",
      "paused-new",
      "paused-old",
      "no-process-new",
      "no-process-old",
    ]);
  });

  describe("starred sessions", () => {
    test("sorts starred sessions before non-starred sessions without process", () => {
      const sessions = [
        createSession("session-normal", new Date("2024-01-01")),
        createSession("session-starred", new Date("2024-01-01")),
      ];
      const processes: PublicSessionProcess[] = [];
      const starredIds = new Set(["session-starred"]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      expect(result.map((s) => s.id)).toEqual([
        "session-starred",
        "session-normal",
      ]);
    });

    test("sorts paused sessions before starred sessions", () => {
      const sessions = [
        createSession("session-starred", new Date("2024-01-15")),
        createSession("session-paused", new Date("2024-01-01")),
      ];
      const processes = [createProcess("session-paused", "paused")];
      const starredIds = new Set(["session-starred"]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      expect(result.map((s) => s.id)).toEqual([
        "session-paused",
        "session-starred",
      ]);
    });

    test("sorts active sessions before starred sessions", () => {
      const sessions = [
        createSession("session-starred", new Date("2024-01-15")),
        createSession("session-running", new Date("2024-01-01")),
      ];
      const processes = [createProcess("session-running", "running")];
      const starredIds = new Set(["session-starred"]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      expect(result.map((s) => s.id)).toEqual([
        "session-running",
        "session-starred",
      ]);
    });

    test("starred session with active process keeps active priority", () => {
      const sessions = [
        createSession("session-starred-running", new Date("2024-01-01")),
        createSession("session-starred-no-process", new Date("2024-01-15")),
      ];
      const processes = [createProcess("session-starred-running", "running")];
      const starredIds = new Set([
        "session-starred-running",
        "session-starred-no-process",
      ]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      // Running takes priority 0, starred without process takes priority 2
      expect(result.map((s) => s.id)).toEqual([
        "session-starred-running",
        "session-starred-no-process",
      ]);
    });

    test("sorts by date within starred sessions", () => {
      const sessions = [
        createSession("starred-old", new Date("2024-01-01")),
        createSession("starred-new", new Date("2024-01-15")),
      ];
      const processes: PublicSessionProcess[] = [];
      const starredIds = new Set(["starred-old", "starred-new"]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      expect(result.map((s) => s.id)).toEqual(["starred-new", "starred-old"]);
    });

    test("complex scenario with starred sessions", () => {
      const sessions = [
        createSession("normal-old", new Date("2024-01-01")),
        createSession("starred-old", new Date("2024-01-05")),
        createSession("paused", new Date("2024-01-10")),
        createSession("running", new Date("2024-01-02")),
        createSession("starred-new", new Date("2024-01-15")),
        createSession("normal-new", new Date("2024-01-20")),
      ];
      const processes = [
        createProcess("paused", "paused"),
        createProcess("running", "running"),
      ];
      const starredIds = new Set(["starred-old", "starred-new"]);

      const result = sortSessionsByStatusAndDate(
        sessions,
        processes,
        starredIds,
      );

      // Expected order:
      // Priority 0 (active): running (Jan 2)
      // Priority 1 (paused): paused (Jan 10)
      // Priority 2 (starred): starred-new (Jan 15), starred-old (Jan 5)
      // Priority 3 (other): normal-new (Jan 20), normal-old (Jan 1)
      expect(result.map((s) => s.id)).toEqual([
        "running",
        "paused",
        "starred-new",
        "starred-old",
        "normal-new",
        "normal-old",
      ]);
    });

    test("starredSessionIds parameter is optional (backward compatible)", () => {
      const sessions = [
        createSession("session-a", new Date("2024-01-15")),
        createSession("session-b", new Date("2024-01-01")),
      ];

      // Without starredSessionIds parameter
      const result = sortSessionsByStatusAndDate(sessions, []);

      expect(result.map((s) => s.id)).toEqual(["session-a", "session-b"]);
    });

    test("empty starredSessionIds set works correctly", () => {
      const sessions = [
        createSession("session-a", new Date("2024-01-15")),
        createSession("session-b", new Date("2024-01-01")),
      ];

      const result = sortSessionsByStatusAndDate(sessions, [], new Set());

      expect(result.map((s) => s.id)).toEqual(["session-a", "session-b"]);
    });
  });
});

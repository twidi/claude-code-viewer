import { describe, expect, test } from "vitest";
import type { SchedulerJob } from "../schema";
import {
  calculateReservedDelay,
  formatQueuedMessages,
  shouldExecuteJob,
} from "./Job";

describe("shouldExecuteJob", () => {
  test("returns false when job is disabled", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "cron",
        expression: "* * * * *",
        concurrencyPolicy: "skip",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: false,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, new Date())).toBe(false);
  });

  test("returns true for cron job when enabled", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "cron",
        expression: "* * * * *",
        concurrencyPolicy: "skip",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, new Date())).toBe(true);
  });

  test("returns false for reserved job that has already run", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "reserved",
        reservedExecutionTime: "2025-10-25T00:01:00Z",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: "2025-10-25T00:01:00Z",
      lastRunStatus: "success",
    };

    expect(shouldExecuteJob(job, new Date())).toBe(false);
  });

  test("returns false for reserved job when scheduled time has not arrived", () => {
    const now = new Date("2025-10-25T00:00:30Z");

    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "reserved",
        reservedExecutionTime: "2025-10-25T00:01:00Z",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, now)).toBe(false);
  });

  test("returns true for reserved job when scheduled time has arrived", () => {
    const now = new Date("2025-10-25T00:01:01Z");

    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "reserved",
        reservedExecutionTime: "2025-10-25T00:01:00Z",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, now)).toBe(true);
  });
});

describe("calculateReservedDelay", () => {
  test("calculates delay correctly for future scheduled time", () => {
    const now = new Date("2025-10-25T00:00:30Z");

    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "reserved",
        reservedExecutionTime: "2025-10-25T00:01:00Z",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    const delay = calculateReservedDelay(job, now);
    expect(delay).toBe(30000);
  });

  test("returns 0 for past scheduled time", () => {
    const now = new Date("2025-10-25T00:02:00Z");

    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "reserved",
        reservedExecutionTime: "2025-10-25T00:01:00Z",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    const delay = calculateReservedDelay(job, now);
    expect(delay).toBe(0);
  });

  test("throws error for non-reserved schedule type", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Job",
      schedule: {
        type: "cron",
        expression: "* * * * *",
        concurrencyPolicy: "skip",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(() => calculateReservedDelay(job, new Date())).toThrow(
      "Job schedule type must be reserved",
    );
  });
});

describe("shouldExecuteJob with queued type", () => {
  test("returns true for enabled queued job", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Queued Job",
      schedule: {
        type: "queued",
        targetSessionId: "session-123",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: true,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, new Date())).toBe(true);
  });

  test("returns false for disabled queued job", () => {
    const job: SchedulerJob = {
      id: "test-job",
      name: "Test Queued Job",
      schedule: {
        type: "queued",
        targetSessionId: "session-123",
      },
      message: { content: "test", projectId: "proj-1", baseSessionId: null },
      enabled: false,
      createdAt: "2025-10-25T00:00:00Z",
      lastRunAt: null,
      lastRunStatus: null,
    };

    expect(shouldExecuteJob(job, new Date())).toBe(false);
  });
});

describe("formatQueuedMessages", () => {
  test("returns empty object for empty messages array", () => {
    const result = formatQueuedMessages([]);
    expect(result).toEqual({ text: "", images: [], documents: [] });
  });

  test("formats single message correctly", () => {
    const messages = [
      {
        text: "Hello, this is a test message",
        createdAt: "2025-10-25T00:00:00Z",
      },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).toBe(
      `[Note: While you were working, the user added a follow-up message:]

Hello, this is a test message`,
    );
    expect(result.images).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("formats multiple messages correctly", () => {
    const messages = [
      { text: "First message", createdAt: "2025-10-25T00:00:00Z" },
      { text: "Second message", createdAt: "2025-10-25T00:01:00Z" },
      { text: "Third message", createdAt: "2025-10-25T00:02:00Z" },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).toBe(
      `[Note: While you were working, the user added 3 follow-up messages.]

--- Follow-up message 1 ---
First message

--- Follow-up message 2 ---
Second message

--- Follow-up message 3 ---
Third message`,
    );
    expect(result.images).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("formats two messages correctly", () => {
    const messages = [
      { text: "Message one", createdAt: "2025-10-25T00:00:00Z" },
      { text: "Message two", createdAt: "2025-10-25T00:01:00Z" },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).toBe(
      `[Note: While you were working, the user added 2 follow-up messages.]

--- Follow-up message 1 ---
Message one

--- Follow-up message 2 ---
Message two`,
    );
  });

  test("formats single message with attachments correctly", () => {
    const image = {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: "base64data",
      },
    };
    const messages = [
      {
        text: "Check this image",
        createdAt: "2025-10-25T00:00:00Z",
        images: [image],
      },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).toBe(
      `[Note: While you were working, the user added a follow-up message:]

Check this image`,
    );
    expect(result.images).toEqual([image]);
    expect(result.documents).toEqual([]);
  });

  test("formats multiple messages with attachments correctly", () => {
    const image1 = {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: "image1data",
      },
    };
    const image2 = {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: "image2data",
      },
    };
    const document1 = {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: "pdfdata",
      },
    };

    const messages = [
      {
        text: "First message with images",
        createdAt: "2025-10-25T00:00:00Z",
        images: [image1, image2],
      },
      {
        text: "Second message without attachments",
        createdAt: "2025-10-25T00:01:00Z",
      },
      {
        text: "Third message with document",
        createdAt: "2025-10-25T00:02:00Z",
        documents: [document1],
      },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).toBe(
      `[Note: While you were working, the user added 3 follow-up messages. Attachment references in each follow-up refer only to that follow-up's attachments.]

--- Follow-up message 1 ---
Attachments included: #1 (image/png), #2 (image/jpeg)

First message with images

--- Follow-up message 2 ---
No attachments included.

Second message without attachments

--- Follow-up message 3 ---
Attachments included: #3 (application/pdf)

Third message with document`,
    );
    expect(result.images).toEqual([image1, image2]);
    expect(result.documents).toEqual([document1]);
  });

  test("does not mention attachments when no message has any", () => {
    const messages = [
      { text: "First message", createdAt: "2025-10-25T00:00:00Z" },
      { text: "Second message", createdAt: "2025-10-25T00:01:00Z" },
    ];

    const result = formatQueuedMessages(messages);

    expect(result.text).not.toContain("attachment");
    expect(result.text).not.toContain("Attachments");
  });
});

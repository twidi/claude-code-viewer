import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { testPlatformLayer } from "../../../../testing/layers/testPlatformLayer";
import { testSessionRepositoryLayer } from "../../../../testing/layers/testSessionRepositoryLayer";
import { VirtualConversationDatabase } from "../../session/infrastructure/VirtualConversationDatabase";
import { SessionMetaService } from "../../session/services/SessionMetaService";
import type * as CCSessionProcess from "../models/CCSessionProcess";
import { ClaudeCodeLifeCycleService } from "./ClaudeCodeLifeCycleService";
import { ClaudeCodePermissionService } from "./ClaudeCodePermissionService";
import { ClaudeCodeSessionProcessService } from "./ClaudeCodeSessionProcessService";

// Helper function to create mock session process definition
const createMockSessionProcessDef = (
  sessionProcessId: string,
  projectId = "test-project",
): CCSessionProcess.CCSessionProcessDef => ({
  sessionProcessId,
  projectId,
  cwd: "/test/path",
  abortController: new AbortController(),
  setNextMessage: () => {},
  permissionMode: "default",
});

// Create mock layers for dependencies
const mockVirtualConversationDatabaseLayer = Layer.mock(
  VirtualConversationDatabase,
  {
    createVirtualConversation: () => Effect.succeed(undefined),
    deleteVirtualConversations: () => Effect.succeed(undefined),
  },
);

const mockSessionMetaServiceLayer = Layer.mock(SessionMetaService, {
  getSessionMeta: () => Effect.fail(new Error("Not implemented in mock")),
});

const mockClaudeCodePermissionServiceLayer = Layer.mock(
  ClaudeCodePermissionService,
  {
    createCanUseToolRelatedOptions: () =>
      Effect.succeed({
        permissionMode: "bypassPermissions" as const,
      }),
    respondToPermissionRequest: () => Effect.succeed(undefined),
  },
);

describe("ClaudeCodeLifeCycleService", () => {
  describe("stopTask", () => {
    it("should stop a running process and transition to completed state without error", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;
        const sessionProcessService = yield* ClaudeCodeSessionProcessService;

        // Create a session process
        const sessionDef = createMockSessionProcessDef("process-1");
        const { sessionProcess } =
          yield* sessionProcessService.startSessionProcess({
            sessionDef,
            taskDef: { type: "new", taskId: "task-1" },
          });

        // Progress to not_initialized state
        yield* sessionProcessService.toNotInitializedState({
          sessionProcessId: sessionProcess.def.sessionProcessId,
          rawUserMessage: "test message",
        });

        // Stop the task
        yield* lifeCycleService.stopTask(sessionProcess.def.sessionProcessId);

        // Verify process is completed
        const updatedProcess = yield* sessionProcessService.getSessionProcess(
          sessionProcess.def.sessionProcessId,
        );

        return updatedProcess;
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result.type).toBe("completed");
    });

    it("should abort the controller when stopping", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;
        const sessionProcessService = yield* ClaudeCodeSessionProcessService;

        // Create a session process
        const sessionDef = createMockSessionProcessDef("process-1");
        const { sessionProcess } =
          yield* sessionProcessService.startSessionProcess({
            sessionDef,
            taskDef: { type: "new", taskId: "task-1" },
          });

        // Progress to not_initialized state
        yield* sessionProcessService.toNotInitializedState({
          sessionProcessId: sessionProcess.def.sessionProcessId,
          rawUserMessage: "test message",
        });

        // Stop the task
        yield* lifeCycleService.stopTask(sessionProcess.def.sessionProcessId);

        // Verify abortController was called
        return sessionProcess.def.abortController.signal.aborted;
      });

      const aborted = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(aborted).toBe(true);
    });

    it("should complete task without error (different from abortTask)", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;
        const sessionProcessService = yield* ClaudeCodeSessionProcessService;

        // Create a session process
        const sessionDef = createMockSessionProcessDef("process-1");
        const { sessionProcess } =
          yield* sessionProcessService.startSessionProcess({
            sessionDef,
            taskDef: { type: "new", taskId: "task-1" },
          });

        // Progress to not_initialized state
        yield* sessionProcessService.toNotInitializedState({
          sessionProcessId: sessionProcess.def.sessionProcessId,
          rawUserMessage: "test message",
        });

        // Stop the task (gracefully)
        yield* lifeCycleService.stopTask(sessionProcess.def.sessionProcessId);

        // Get the updated process to check task status
        const updatedProcess = yield* sessionProcessService.getSessionProcess(
          sessionProcess.def.sessionProcessId,
        );

        return updatedProcess;
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result.type).toBe("completed");

      // Check the task status - for a graceful stop (no error), the task should be "completed"
      const completedTask = result.tasks.find((t) => t.def.taskId === "task-1");
      expect(completedTask?.status).toBe("completed");

      // Ensure there's no error (unlike abortTask which sets an error)
      if (completedTask?.status === "failed") {
        // This should NOT happen for stopTask
        expect(completedTask.status).not.toBe("failed");
      }
    });

    it("should fail with SessionProcessNotFoundError for non-existent process", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;

        const result = yield* Effect.flip(
          lifeCycleService.stopTask("non-existent"),
        );

        return result;
      });

      const error = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(error).toMatchObject({
        _tag: "SessionProcessNotFoundError",
        sessionProcessId: "non-existent",
      });
    });
  });

  describe("abortTask vs stopTask difference", () => {
    it("abortTask should mark task as failed with error", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;
        const sessionProcessService = yield* ClaudeCodeSessionProcessService;

        // Create a session process
        const sessionDef = createMockSessionProcessDef("process-1");
        const { sessionProcess } =
          yield* sessionProcessService.startSessionProcess({
            sessionDef,
            taskDef: { type: "new", taskId: "task-1" },
          });

        // Progress to not_initialized state
        yield* sessionProcessService.toNotInitializedState({
          sessionProcessId: sessionProcess.def.sessionProcessId,
          rawUserMessage: "test message",
        });

        // Abort the task (with error)
        yield* lifeCycleService.abortTask(sessionProcess.def.sessionProcessId);

        // Get the updated process to check task status
        const updatedProcess = yield* sessionProcessService.getSessionProcess(
          sessionProcess.def.sessionProcessId,
        );

        return updatedProcess;
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result.type).toBe("completed");

      // Check the task status - for abort, the task should be "failed"
      const failedTask = result.tasks.find((t) => t.def.taskId === "task-1");
      expect(failedTask?.status).toBe("failed");

      // Ensure there's an error
      if (failedTask?.status === "failed") {
        expect(failedTask.error).toBeDefined();
        expect(failedTask.error).toBeInstanceOf(Error);
      }
    });

    it("stopTask should mark task as completed without error", async () => {
      const program = Effect.gen(function* () {
        const lifeCycleService = yield* ClaudeCodeLifeCycleService;
        const sessionProcessService = yield* ClaudeCodeSessionProcessService;

        // Create a session process
        const sessionDef = createMockSessionProcessDef("process-1");
        const { sessionProcess } =
          yield* sessionProcessService.startSessionProcess({
            sessionDef,
            taskDef: { type: "new", taskId: "task-1" },
          });

        // Progress to not_initialized state
        yield* sessionProcessService.toNotInitializedState({
          sessionProcessId: sessionProcess.def.sessionProcessId,
          rawUserMessage: "test message",
        });

        // Stop the task (gracefully, without error)
        yield* lifeCycleService.stopTask(sessionProcess.def.sessionProcessId);

        // Get the updated process to check task status
        const updatedProcess = yield* sessionProcessService.getSessionProcess(
          sessionProcess.def.sessionProcessId,
        );

        return updatedProcess;
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ClaudeCodeLifeCycleService.Live),
          Effect.provide(ClaudeCodeSessionProcessService.Live),
          Effect.provide(mockClaudeCodePermissionServiceLayer),
          Effect.provide(mockVirtualConversationDatabaseLayer),
          Effect.provide(mockSessionMetaServiceLayer),
          Effect.provide(testSessionRepositoryLayer()),
          Effect.provide(NodeContext.layer),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result.type).toBe("completed");

      // Check the task status - for graceful stop, the task should be "completed"
      const completedTask = result.tasks.find((t) => t.def.taskId === "task-1");
      expect(completedTask?.status).toBe("completed");

      // Ensure there's NO error
      if (completedTask?.status === "failed") {
        // This should NOT happen
        expect.fail("Task should be completed, not failed");
      }
    });
  });
});

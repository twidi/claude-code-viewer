import { Context, Effect, Fiber, Layer, Ref, Schedule } from "effect";
import type { InferEffect } from "../../lib/effect/types";
import { ClaudeCodeLifeCycleService } from "../claude-code/services/ClaudeCodeLifeCycleService";
import { ClaudeCodeSessionProcessService } from "../claude-code/services/ClaudeCodeSessionProcessService";
import { UserConfigService } from "../platform/services/UserConfigService";
import { SessionRepository } from "../session/infrastructure/SessionRepository";

const AUTO_ABORT_CHECK_INTERVAL_MINUTES = 5;

const LayerImpl = Effect.gen(function* () {
  const lifeCycleService = yield* ClaudeCodeLifeCycleService;
  const sessionProcessService = yield* ClaudeCodeSessionProcessService;
  const sessionRepository = yield* SessionRepository;
  const userConfigService = yield* UserConfigService;

  const runningRef = yield* Ref.make(false);
  const fiberRef = yield* Ref.make<Fiber.RuntimeFiber<void, never> | null>(
    null,
  );

  const checkAndAbortExpiredSessions = Effect.gen(function* () {
    const userConfig = yield* userConfigService.getUserConfig();
    const timeoutMinutes = Number.parseInt(
      userConfig.autoAbortAfterMinutes,
      10,
    );
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const now = Date.now();

    const processes = yield* sessionProcessService.getSessionProcesses();
    const pausedProcesses = processes.filter((p) => p.type === "paused");

    if (pausedProcesses.length === 0) {
      return;
    }

    console.log(
      `[AutoAbort] Checking ${pausedProcesses.length} paused session(s) (timeout: ${timeoutMinutes} min)`,
    );

    for (const process of pausedProcesses) {
      if (process.type !== "paused") continue;

      const { sessionId } = process;
      const { projectId } = process.def;

      // Get session metadata to find lastModifiedAt
      const sessionResult = yield* sessionRepository
        .getSession(projectId, sessionId)
        .pipe(
          Effect.map((result) => result.session),
          Effect.option,
        );

      if (sessionResult._tag === "None") {
        console.log(
          `[AutoAbort] Session ${sessionId} not found in repository, skipping`,
        );
        continue;
      }

      const session = sessionResult.value;
      if (session === null) {
        console.log(`[AutoAbort] Session ${sessionId} is null, skipping`);
        continue;
      }
      const lastModifiedAt = new Date(session.lastModifiedAt).getTime();
      const elapsed = now - lastModifiedAt;

      if (elapsed > timeoutMs) {
        const elapsedMinutes = Math.round(elapsed / 60000);
        console.log(
          `[AutoAbort] Aborting session ${sessionId} (idle for ${elapsedMinutes} min)`,
        );

        yield* lifeCycleService.abortTask(process.def.sessionProcessId).pipe(
          Effect.catchAll((error) => {
            console.error(
              `[AutoAbort] Failed to abort session ${sessionId}:`,
              error,
            );
            return Effect.void;
          }),
        );
      }
    }
  });

  const startAutoAbortDaemon = Effect.gen(function* () {
    const isRunning = yield* Ref.get(runningRef);
    if (isRunning) return;

    yield* Ref.set(runningRef, true);

    console.log(
      `[AutoAbort] Starting auto-abort daemon (interval: ${AUTO_ABORT_CHECK_INTERVAL_MINUTES} min)`,
    );

    const daemon = Effect.repeat(
      checkAndAbortExpiredSessions.pipe(
        Effect.catchAll((error) => {
          console.error("[AutoAbort] Error during check:", error);
          return Effect.void;
        }),
      ),
      Schedule.fixed(`${AUTO_ABORT_CHECK_INTERVAL_MINUTES} minutes`),
    ).pipe(Effect.asVoid);

    const fiber = yield* Effect.forkDaemon(daemon);
    yield* Ref.set(fiberRef, fiber);
  });

  const stopAutoAbortDaemon = Effect.gen(function* () {
    const fiber = yield* Ref.get(fiberRef);
    if (fiber !== null) {
      yield* Fiber.interrupt(fiber);
      yield* Ref.set(fiberRef, null);
    }
    yield* Ref.set(runningRef, false);
    console.log("[AutoAbort] Auto-abort daemon stopped");
  });

  return {
    startAutoAbortDaemon,
    stopAutoAbortDaemon,
  };
});

export type IAutoAbortService = InferEffect<typeof LayerImpl>;

export class AutoAbortService extends Context.Tag("AutoAbortService")<
  AutoAbortService,
  IAutoAbortService
>() {
  static Live = Layer.effect(this, LayerImpl);
}

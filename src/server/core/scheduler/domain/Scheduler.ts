import { CommandExecutor, FileSystem, Path } from "@effect/platform";
import {
  Context,
  Cron,
  Data,
  Duration,
  Effect,
  Fiber,
  Layer,
  Ref,
  Schedule,
} from "effect";
import { ulid } from "ulid";
import type { InferEffect } from "../../../lib/effect/types";
import { ClaudeCodeLifeCycleService } from "../../claude-code/services/ClaudeCodeLifeCycleService";
import { EventBus } from "../../events/services/EventBus";
import { CcvOptionsService } from "../../platform/services/CcvOptionsService";
import {
  initializeConfig,
  readConfig,
  SchedulerConfigBaseDir,
  writeConfig,
} from "../config";
import type {
  NewSchedulerJob,
  SchedulerConfig,
  SchedulerJob,
  UpdateSchedulerJob,
} from "../schema";
import {
  calculateReservedDelay,
  executeJob,
  executeQueuedJobsWithService,
} from "./Job";

class SchedulerJobNotFoundError extends Data.TaggedError(
  "SchedulerJobNotFoundError",
)<{
  readonly jobId: string;
}> {}

class InvalidCronExpressionError extends Data.TaggedError(
  "InvalidCronExpressionError",
)<{
  readonly expression: string;
  readonly cause: unknown;
}> {}

const LayerImpl = Effect.gen(function* () {
  const eventBus = yield* EventBus;
  const lifeCycleService = yield* ClaudeCodeLifeCycleService;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const baseDir = yield* SchedulerConfigBaseDir;
  const commandExecutor = yield* CommandExecutor.CommandExecutor;
  const ccvOptionsService = yield* CcvOptionsService;
  const fibersRef = yield* Ref.make<
    Map<string, Fiber.RuntimeFiber<unknown, unknown>>
  >(new Map());
  const runningJobsRef = yield* Ref.make<Set<string>>(new Set());

  // Helper to provide all platform dependencies needed for scheduler operations
  const withAllDependencies = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      | FileSystem.FileSystem
      | Path.Path
      | SchedulerConfigBaseDir
      | CommandExecutor.CommandExecutor
      | CcvOptionsService
    >,
  ) =>
    effect.pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.provideService(SchedulerConfigBaseDir, baseDir),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor),
      Effect.provideService(CcvOptionsService, ccvOptionsService),
    );

  const startJob = (job: SchedulerJob) =>
    Effect.gen(function* () {
      const now = new Date();

      if (job.schedule.type === "cron") {
        const cronResult = Cron.parse(job.schedule.expression);

        if (cronResult._tag === "Left") {
          return yield* Effect.fail(
            new InvalidCronExpressionError({
              expression: job.schedule.expression,
              cause: cronResult.left,
            }),
          );
        }

        const cronSchedule = Schedule.cron(cronResult.right);

        // Wait for the next cron time before starting the repeat loop
        // This prevents immediate execution on job creation/update
        const fiber = yield* Effect.gen(function* () {
          // Get the next scheduled time
          const nextTime = Cron.next(cronResult.right, new Date());
          const nextDelay = Math.max(0, nextTime.getTime() - Date.now());

          // Wait until the next scheduled time
          yield* Effect.sleep(Duration.millis(nextDelay));

          // Then repeat on the cron schedule
          yield* Effect.repeat(runJobWithConcurrencyControl(job), cronSchedule);
        }).pipe(Effect.forkDaemon);

        yield* Ref.update(fibersRef, (fibers) =>
          new Map(fibers).set(job.id, fiber),
        );
      } else if (job.schedule.type === "reserved") {
        // For reserved jobs, skip scheduling if already executed
        if (job.lastRunStatus !== null) {
          console.log(
            `[Scheduler] Skipping reserved job ${job.id} - already executed`,
          );
          return;
        }

        const delay = calculateReservedDelay(job, now);
        console.log(
          `[Scheduler] Reserved job ${job.id} delay: ${delay}ms (scheduled: ${job.schedule.reservedExecutionTime})`,
        );
        const delayDuration = Duration.millis(delay);

        const fiber = yield* Effect.delay(
          runJobWithConcurrencyControl(job),
          delayDuration,
        ).pipe(Effect.forkDaemon);

        yield* Ref.update(fibersRef, (fibers) =>
          new Map(fibers).set(job.id, fiber),
        );
      }
    });

  const runJobWithConcurrencyControl = (job: SchedulerJob) =>
    Effect.gen(function* () {
      // Check concurrency policy (only for cron jobs)
      if (
        job.schedule.type === "cron" &&
        job.schedule.concurrencyPolicy === "skip"
      ) {
        const runningJobs = yield* Ref.get(runningJobsRef);
        if (runningJobs.has(job.id)) {
          return;
        }
      }

      yield* Ref.update(runningJobsRef, (jobs) => new Set(jobs).add(job.id));

      // For reserved jobs, delete after execution without updating status
      if (job.schedule.type === "reserved") {
        console.log(
          `[Scheduler] Executing reserved job: ${job.name} (${job.id})`,
        );
        const result = yield* executeJob(job).pipe(
          Effect.matchEffect({
            onSuccess: () => {
              console.log(
                `[Scheduler] Reserved job ${job.id} completed successfully`,
              );
              return Effect.void;
            },
            onFailure: (error) => {
              console.error(
                `[Scheduler] Reserved job ${job.id} failed:`,
                error,
              );
              return Effect.void;
            },
          }),
        );
        yield* Ref.update(runningJobsRef, (jobs) => {
          const newJobs = new Set(jobs);
          newJobs.delete(job.id);
          return newJobs;
        });

        // Delete reserved job after execution (skip fiber stop, just delete from config)
        yield* deleteJobFromConfig(job.id).pipe(
          Effect.catchAll((error) => {
            console.error(
              `[Scheduler] Failed to delete reserved job ${job.id}:`,
              error,
            );
            return Effect.void;
          }),
        );

        // Notify frontend that the job was deleted
        yield* eventBus.emit("schedulerJobsChanged", { deletedJobId: job.id });

        return result;
      }

      // For non-reserved jobs, update status
      const result = yield* executeJob(job).pipe(
        Effect.matchEffect({
          onSuccess: () =>
            updateJobStatus(job.id, "success", new Date().toISOString()),
          onFailure: () =>
            updateJobStatus(job.id, "failed", new Date().toISOString()),
        }),
      );

      yield* Ref.update(runningJobsRef, (jobs) => {
        const newJobs = new Set(jobs);
        newJobs.delete(job.id);
        return newJobs;
      });

      return result;
    });

  const updateJobStatus = (
    jobId: string,
    status: "success" | "failed",
    runAt: string,
  ) =>
    Effect.gen(function* () {
      const config = yield* readConfig;
      const job = config.jobs.find((j) => j.id === jobId);

      if (job === undefined) {
        return;
      }

      const updatedJob: SchedulerJob = {
        ...job,
        lastRunAt: runAt,
        lastRunStatus: status,
      };

      const updatedConfig: SchedulerConfig = {
        jobs: config.jobs.map((j) => (j.id === jobId ? updatedJob : j)),
      };

      yield* writeConfig(updatedConfig);
    });

  const stopJob = (jobId: string) =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef);
      const fiber = fibers.get(jobId);

      if (fiber !== undefined) {
        yield* Fiber.interrupt(fiber);
        yield* Ref.update(fibersRef, (fibers) => {
          const newFibers = new Map(fibers);
          newFibers.delete(jobId);
          return newFibers;
        });
      }
    });

  const startScheduler = Effect.gen(function* () {
    yield* initializeConfig;
    const config = yield* readConfig;

    console.log(
      `[Scheduler] Starting scheduler with ${config.jobs.length} jobs`,
    );

    // Separate queued jobs from other jobs - queued jobs should be executed immediately on startup
    const queuedJobs = config.jobs.filter(
      (job) => job.schedule.type === "queued" && job.enabled,
    );
    const otherJobs = config.jobs.filter(
      (job) => job.schedule.type !== "queued",
    );

    // Execute queued jobs on startup (server was restarted, session is no longer running)
    // Note: Frontend will refetch scheduler jobs on SSE reconnection, so no need to emit events here
    if (queuedJobs.length > 0) {
      console.log(
        `[Scheduler] Found ${queuedJobs.length} queued job(s) to execute on startup`,
      );

      for (const job of queuedJobs) {
        console.log(
          `[Scheduler] Executing queued job on startup: ${job.name} (${job.id})`,
        );
        yield* executeJob(job).pipe(
          Effect.matchEffect({
            onSuccess: () =>
              Effect.gen(function* () {
                console.log(
                  `[Scheduler] Queued job ${job.id} executed successfully on startup`,
                );
                yield* deleteJobFromConfig(job.id).pipe(
                  Effect.catchAll((error) => {
                    console.error(
                      `[Scheduler] Failed to delete queued job ${job.id} after execution:`,
                      error,
                    );
                    return Effect.void;
                  }),
                );
              }),
            onFailure: (error) => {
              console.error(
                `[Scheduler] Failed to execute queued job ${job.id} on startup:`,
                error,
              );
              return Effect.void;
            },
          }),
        );
      }
    }

    // Start other jobs (cron and reserved)
    for (const job of otherJobs) {
      if (job.enabled) {
        console.log(`[Scheduler] Starting job: ${job.name} (${job.id})`);
        yield* startJob(job).pipe(
          Effect.catchAll((error) => {
            console.error(`[Scheduler] Failed to start job ${job.id}:`, error);
            return Effect.void;
          }),
        );
      }
    }

    // Listen for session process changes to trigger queued jobs
    yield* eventBus.on("sessionProcessChanged", (event) => {
      if (
        event.changed.type === "paused" &&
        event.changed.sessionId !== undefined
      ) {
        // Call the async version that handles the Effect internally
        void executeQueuedJobsForSession({
          sessionId: event.changed.sessionId,
          sessionProcessId: event.changed.def.sessionProcessId,
        });
      }
    });

    console.log("[Scheduler] All jobs started");
  });

  const stopScheduler = Effect.gen(function* () {
    const fibers = yield* Ref.get(fibersRef);

    for (const fiber of fibers.values()) {
      yield* Fiber.interrupt(fiber);
    }

    yield* Ref.set(fibersRef, new Map());
  });

  const getJobs = () =>
    Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.catchTags({
          ConfigFileNotFoundError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          ConfigParseError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
        }),
      );
      return config.jobs;
    });

  const addJob = (newJob: NewSchedulerJob) =>
    Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.catchTags({
          ConfigFileNotFoundError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          ConfigParseError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
        }),
      );
      const job: SchedulerJob = {
        ...newJob,
        id: ulid(),
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        lastRunStatus: null,
      };

      const updatedConfig: SchedulerConfig = {
        jobs: [...config.jobs, job],
      };

      yield* writeConfig(updatedConfig);

      if (job.enabled) {
        yield* startJob(job);
      }

      return job;
    });

  const updateJob = (jobId: string, updates: UpdateSchedulerJob) =>
    Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.catchTags({
          ConfigFileNotFoundError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          ConfigParseError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
        }),
      );
      const job = config.jobs.find((j) => j.id === jobId);

      if (job === undefined) {
        return yield* Effect.fail(new SchedulerJobNotFoundError({ jobId }));
      }

      yield* stopJob(jobId);

      const updatedJob: SchedulerJob = {
        ...job,
        ...updates,
      };

      const updatedConfig: SchedulerConfig = {
        jobs: config.jobs.map((j) => (j.id === jobId ? updatedJob : j)),
      };

      yield* writeConfig(updatedConfig);

      if (updatedJob.enabled) {
        yield* startJob(updatedJob);
      }

      return updatedJob;
    });

  const deleteJobFromConfig = (jobId: string) =>
    Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.catchTags({
          ConfigFileNotFoundError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          ConfigParseError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
        }),
      );
      const job = config.jobs.find((j) => j.id === jobId);

      if (job === undefined) {
        return yield* Effect.fail(new SchedulerJobNotFoundError({ jobId }));
      }

      const updatedConfig: SchedulerConfig = {
        jobs: config.jobs.filter((j) => j.id !== jobId),
      };

      yield* writeConfig(updatedConfig);
    });

  const deleteJob = (jobId: string) =>
    Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.catchTags({
          ConfigFileNotFoundError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          ConfigParseError: () =>
            initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
        }),
      );
      const job = config.jobs.find((j) => j.id === jobId);

      if (job === undefined) {
        return yield* Effect.fail(new SchedulerJobNotFoundError({ jobId }));
      }

      yield* stopJob(jobId);
      yield* deleteJobFromConfig(jobId);
    });

  /**
   * Execute all queued jobs for a session that just paused.
   * This is an internal function that runs within the scheduler's context.
   */
  const executeQueuedJobsForSessionInternal = (options: {
    sessionId: string;
    sessionProcessId: string;
  }) =>
    withAllDependencies(
      Effect.gen(function* () {
        const { sessionId, sessionProcessId } = options;

        const config = yield* readConfig.pipe(
          Effect.catchTags({
            ConfigFileNotFoundError: () =>
              initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
            ConfigParseError: () =>
              initializeConfig.pipe(Effect.map(() => ({ jobs: [] }))),
          }),
        );

        // Find all queued jobs for this session
        const queuedJobs = config.jobs.filter(
          (job) =>
            job.schedule.type === "queued" &&
            job.schedule.targetSessionId === sessionId &&
            job.enabled,
        );

        if (queuedJobs.length === 0) {
          return;
        }

        console.log(
          `[Scheduler] Found ${queuedJobs.length} queued job(s) for session ${sessionId}`,
        );

        // Execute all queued jobs as a single aggregated message
        yield* executeQueuedJobsWithService({
          jobs: queuedJobs,
          sessionProcessId,
          baseSessionId: sessionId,
          lifeCycleService,
        }).pipe(
          Effect.matchEffect({
            onSuccess: () => {
              console.log(
                `[Scheduler] Queued jobs for session ${sessionId} executed successfully`,
              );
              return Effect.void;
            },
            onFailure: (error) => {
              console.error(
                `[Scheduler] Failed to execute queued jobs for session ${sessionId}:`,
                error,
              );
              return Effect.void;
            },
          }),
        );

        // Delete all executed queued jobs
        for (const job of queuedJobs) {
          yield* deleteJobFromConfig(job.id).pipe(
            Effect.catchAll((error) => {
              console.error(
                `[Scheduler] Failed to delete queued job ${job.id}:`,
                error,
              );
              return Effect.void;
            }),
          );
          yield* eventBus.emit("schedulerJobsChanged", {
            deletedJobId: job.id,
          });
        }
      }),
    );

  /**
   * Execute all queued jobs for a session - async version for callbacks.
   * This wraps the internal function and handles errors.
   */
  const executeQueuedJobsForSession = async (options: {
    sessionId: string;
    sessionProcessId: string;
  }): Promise<void> => {
    try {
      await Effect.runPromise(executeQueuedJobsForSessionInternal(options));
    } catch (error) {
      console.error(
        `[Scheduler] Error executing queued jobs for session ${options.sessionId}:`,
        error,
      );
    }
  };

  return {
    startScheduler,
    stopScheduler,
    getJobs,
    addJob,
    updateJob,
    deleteJob,
    executeQueuedJobsForSession,
  };
});

export type ISchedulerService = InferEffect<typeof LayerImpl>;

export class SchedulerService extends Context.Tag("SchedulerService")<
  SchedulerService,
  ISchedulerService
>() {
  static Live = Layer.effect(this, LayerImpl);
}

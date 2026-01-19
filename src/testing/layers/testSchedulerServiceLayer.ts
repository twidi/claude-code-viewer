import { Effect, Layer } from "effect";
import { SchedulerService } from "../../server/core/scheduler/domain/Scheduler";
import type {
  NewSchedulerJob,
  SchedulerJob,
  UpdateSchedulerJob,
} from "../../server/core/scheduler/schema";

export const testSchedulerServiceLayer = (options?: {
  jobs?: SchedulerJob[];
  startScheduler?: () => Effect.Effect<void>;
  stopScheduler?: () => Effect.Effect<void>;
  executeQueuedJobsForSession?: (options: {
    sessionId: string;
    sessionProcessId: string;
  }) => Promise<void>;
}) => {
  const {
    jobs = [],
    startScheduler = () => Effect.void,
    stopScheduler = () => Effect.void,
    executeQueuedJobsForSession = async () => {},
  } = options ?? {};

  return Layer.mock(SchedulerService, {
    startScheduler: startScheduler(),
    stopScheduler: stopScheduler(),
    getJobs: () => Effect.succeed(jobs),
    addJob: (_newJob: NewSchedulerJob) =>
      Effect.succeed({
        id: "test-job-id",
        name: _newJob.name,
        schedule: _newJob.schedule,
        message: _newJob.message,
        enabled: _newJob.enabled,
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        lastRunStatus: null,
      }),
    updateJob: (
      _jobId: string,
      updates: UpdateSchedulerJob,
    ): Effect.Effect<SchedulerJob> =>
      Effect.succeed({
        id: _jobId,
        name: updates.name ?? "Updated Job",
        schedule: updates.schedule ?? {
          type: "cron",
          expression: "0 * * * *",
          concurrencyPolicy: "skip",
        },
        message: updates.message ?? {
          content: "test",
          projectId: "test-project",
          baseSessionId: null,
        },
        enabled: updates.enabled ?? true,
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        lastRunStatus: null,
      }),
    deleteJob: (_jobId: string) => Effect.succeed(undefined),
    executeQueuedJobsForSession,
  });
};

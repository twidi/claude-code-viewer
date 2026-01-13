import { Effect } from "effect";
import {
  ClaudeCodeLifeCycleService,
  type IClaudeCodeLifeCycleService,
} from "../../claude-code/services/ClaudeCodeLifeCycleService";
import { UserConfigService } from "../../platform/services/UserConfigService";
import { ProjectRepository } from "../../project/infrastructure/ProjectRepository";
import type { SchedulerJob } from "../schema";

interface QueuedMessage {
  text: string;
  createdAt: string;
}

/**
 * Formats queued messages into a single string with appropriate context.
 *
 * Single message:
 * [Note: While you were working, the user added a follow-up message:]
 *
 * <message text>
 *
 * Multiple messages:
 * [Note: While you were working, the user added N follow-up messages:
 *
 * [follow-up message 1]
 *
 * <first message text>
 *
 * [follow-up message 2]
 *
 * <second message text>
 */
export function formatQueuedMessages(messages: QueuedMessage[]): string {
  if (messages.length === 0) {
    return "";
  }

  const [firstMessage] = messages;
  if (messages.length === 1 && firstMessage) {
    return `[Note: While you were working, the user added a follow-up message:]

${firstMessage.text}`;
  }

  // Multiple messages
  const header = `[Note: While you were working, the user added ${messages.length} follow-up messages:`;
  const formattedMessages = messages.map((message, index) => {
    return `[follow-up message ${index + 1}]

${message.text}`;
  });

  return `${header}

${formattedMessages.join("\n\n")}`;
}

export const executeJob = (job: SchedulerJob) =>
  Effect.gen(function* () {
    const lifeCycleService = yield* ClaudeCodeLifeCycleService;
    const projectRepository = yield* ProjectRepository;
    const userConfigService = yield* UserConfigService;

    const { message } = job;
    const { project } = yield* projectRepository.getProject(message.projectId);
    const userConfig = yield* userConfigService.getUserConfig();

    if (project.meta.projectPath === null) {
      return yield* Effect.fail(
        new Error(`Project path not found for projectId: ${message.projectId}`),
      );
    }

    yield* lifeCycleService.startTask({
      baseSession: {
        cwd: project.meta.projectPath,
        projectId: message.projectId,
        sessionId: message.baseSessionId ?? undefined,
      },
      userConfig,
      input: {
        text: message.content,
      },
    });
  });

export const shouldExecuteJob = (job: SchedulerJob, now: Date): boolean => {
  if (!job.enabled) {
    return false;
  }

  if (job.schedule.type === "cron") {
    return true;
  }

  if (job.schedule.type === "reserved") {
    // Reserved jobs are one-time, skip if already executed
    if (job.lastRunStatus !== null) {
      return false;
    }

    const scheduledTime = new Date(job.schedule.reservedExecutionTime);
    return now >= scheduledTime;
  }

  return true;
};

export const calculateReservedDelay = (
  job: SchedulerJob,
  now: Date,
): number => {
  if (job.schedule.type !== "reserved") {
    throw new Error("Job schedule type must be reserved");
  }

  const scheduledTime = new Date(job.schedule.reservedExecutionTime);
  const delay = scheduledTime.getTime() - now.getTime();

  return Math.max(0, delay);
};

/**
 * Execute queued jobs for a session that just paused.
 * Aggregates all queued messages into a single formatted message
 * and sends it via continueTask.
 *
 * This version takes the lifeCycleService as a parameter to avoid
 * dependency issues when called from callbacks.
 */
export const executeQueuedJobsWithService = (options: {
  jobs: SchedulerJob[];
  sessionProcessId: string;
  baseSessionId: string;
  lifeCycleService: IClaudeCodeLifeCycleService;
}) =>
  Effect.gen(function* () {
    const { jobs, sessionProcessId, baseSessionId, lifeCycleService } = options;

    if (jobs.length === 0) {
      return;
    }

    // Sort jobs by createdAt to maintain order
    const sortedJobs = [...jobs].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Format all messages into a single aggregated message
    const formattedMessage = formatQueuedMessages(
      sortedJobs.map((job) => ({
        text: job.message.content,
        createdAt: job.createdAt,
      })),
    );

    console.log(
      `[Scheduler] Executing ${jobs.length} queued job(s) for session ${baseSessionId}`,
    );

    // Use continueTask to resume the paused session
    yield* lifeCycleService.continueTask({
      sessionProcessId,
      baseSessionId,
      input: {
        text: formattedMessage,
      },
    });
  });

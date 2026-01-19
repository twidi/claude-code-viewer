import { Effect } from "effect";
import type {
  DocumentBlockParam,
  ImageBlockParam,
} from "../../claude-code/schema";
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
  images?: ImageBlockParam[];
  documents?: DocumentBlockParam[];
}

interface FormattedQueuedMessage {
  text: string;
  images: ImageBlockParam[];
  documents: DocumentBlockParam[];
}

/**
 * Gets the media type from an image or document block.
 */
function getMediaType(block: ImageBlockParam | DocumentBlockParam): string {
  return block.source.media_type;
}

/**
 * Formats the attachment info line for a follow-up message.
 * Returns the line to display, or null if not needed.
 *
 * @param messageImages - Images attached to this specific message
 * @param messageDocuments - Documents attached to this specific message
 * @param startIndex - The starting index for attachments (1-based)
 * @param hasAnyAttachments - Whether any message in the batch has attachments
 */
function formatAttachmentInfo(
  messageImages: ImageBlockParam[],
  messageDocuments: DocumentBlockParam[],
  startIndex: number,
  hasAnyAttachments: boolean,
): string | null {
  const attachments = [...messageImages, ...messageDocuments];

  if (attachments.length === 0) {
    // Only show "No attachments" if at least one other message has attachments
    return hasAnyAttachments ? "No attachments included." : null;
  }

  const attachmentDescriptions = attachments.map((block, i) => {
    const index = startIndex + i;
    const mediaType = getMediaType(block);
    return `#${index} (${mediaType})`;
  });

  return `Attachments included: ${attachmentDescriptions.join(", ")}`;
}

/**
 * Formats queued messages into a single message with aggregated attachments.
 *
 * Single message:
 * [Note: While you were working, the user added a follow-up message:]
 *
 * <message text>
 *
 * Multiple messages (with attachments):
 * [Note: While you were working, the user added N follow-up messages:
 *
 * --- Follow-up message 1 ---
 * Attachments included: #1 (image/png), #2 (application/pdf)
 *
 * <first message text>
 *
 * --- Follow-up message 2 ---
 * No attachments included.
 *
 * <second message text>
 */
export function formatQueuedMessages(
  messages: QueuedMessage[],
): FormattedQueuedMessage {
  if (messages.length === 0) {
    return { text: "", images: [], documents: [] };
  }

  // Aggregate all attachments
  const allImages: ImageBlockParam[] = [];
  const allDocuments: DocumentBlockParam[] = [];
  for (const message of messages) {
    if (message.images) {
      allImages.push(...message.images);
    }
    if (message.documents) {
      allDocuments.push(...message.documents);
    }
  }

  const [firstMessage] = messages;
  if (messages.length === 1 && firstMessage) {
    return {
      text: `[Note: While you were working, the user added a follow-up message:]

${firstMessage.text}`,
      images: allImages,
      documents: allDocuments,
    };
  }

  // Multiple messages
  const hasAnyAttachments = allImages.length > 0 || allDocuments.length > 0;

  // Count how many follow-ups have attachments
  const followUpsWithAttachments = messages.filter(
    (m) => (m.images?.length ?? 0) > 0 || (m.documents?.length ?? 0) > 0,
  ).length;

  // Add clarification note only when 2+ follow-ups have attachments (to avoid ambiguity)
  const attachmentNote =
    followUpsWithAttachments >= 2
      ? " Attachment references in each follow-up refer only to that follow-up's attachments."
      : "";

  const header = `[Note: While you were working, the user added ${messages.length} follow-up messages.${attachmentNote}]`;

  let currentAttachmentIndex = 1;
  const formattedMessages = messages.map((message, index) => {
    const messageImages = message.images ?? [];
    const messageDocuments = message.documents ?? [];
    const attachmentCount = messageImages.length + messageDocuments.length;

    const attachmentInfo = formatAttachmentInfo(
      messageImages,
      messageDocuments,
      currentAttachmentIndex,
      hasAnyAttachments,
    );

    currentAttachmentIndex += attachmentCount;

    const attachmentLine = attachmentInfo ? `${attachmentInfo}\n\n` : "";

    return `--- Follow-up message ${index + 1} ---
${attachmentLine}${message.text}`;
  });

  return {
    text: `${header}

${formattedMessages.join("\n\n")}`,
    images: allImages,
    documents: allDocuments,
  };
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

    // Format all messages into a single aggregated message with attachments
    const formatted = formatQueuedMessages(
      sortedJobs.map((job) => ({
        text: job.message.content,
        createdAt: job.createdAt,
        images: job.message.images,
        documents: job.message.documents,
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
        text: formatted.text,
        images: formatted.images.length > 0 ? formatted.images : undefined,
        documents:
          formatted.documents.length > 0 ? formatted.documents : undefined,
      },
    });
  });

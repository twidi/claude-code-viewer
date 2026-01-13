import { Trans, useLingui } from "@lingui/react";
import { CalendarClockIcon, ClockIcon } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import type { SchedulerJob } from "@/server/core/scheduler/schema";

type ScheduledMessageNoticeProps = {
  scheduledJobs: SchedulerJob[];
};

export const ScheduledMessageNotice: FC<ScheduledMessageNoticeProps> = ({
  scheduledJobs,
}) => {
  const { i18n } = useLingui();

  // Separate reserved and queued jobs
  const reservedJobs = scheduledJobs.filter(
    (job) => job.schedule.type === "reserved",
  );
  const queuedJobs = scheduledJobs.filter(
    (job) => job.schedule.type === "queued",
  );

  if (reservedJobs.length === 0 && queuedJobs.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex justify-start mt-4">
      <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%] px-2 space-y-3">
        {/* Queued Messages Section */}
        {queuedJobs.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
              <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-semibold">
                <Trans id="session.queued_messages.title" />
              </h3>
              <span className="font-normal">
                (<Trans id="session.queued_messages.waiting" />)
              </span>
            </div>
            <div className="space-y-2">
              {queuedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded border border-amber-100 dark:border-amber-900"
                >
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 flex-1">
                    {job.message.content}
                  </p>
                  {!job.enabled && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Trans id="session.scheduled_messages.disabled" />
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reserved (Scheduled) Messages Section */}
        {reservedJobs.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClockIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                <Trans id="session.scheduled_messages.title" />
              </h3>
            </div>
            <div className="space-y-2">
              {reservedJobs.map((job) => {
                if (job.schedule.type !== "reserved") {
                  return null;
                }

                const scheduledTime = new Date(
                  job.schedule.reservedExecutionTime,
                );
                const formattedTime = i18n.date(scheduledTime, {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={job.id}
                    className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-900 rounded border border-blue-100 dark:border-blue-900"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                      >
                        {formattedTime}
                      </Badge>
                      {!job.enabled && (
                        <Badge variant="outline" className="text-xs">
                          <Trans id="session.scheduled_messages.disabled" />
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {job.message.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

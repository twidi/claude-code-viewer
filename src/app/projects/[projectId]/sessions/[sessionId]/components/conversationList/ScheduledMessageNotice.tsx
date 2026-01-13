import { Trans, useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  ClockIcon,
  EditIcon,
  TrashIcon,
} from "lucide-react";
import { type FC, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeleteSchedulerJob,
  useUpdateSchedulerJob,
} from "@/hooks/useScheduler";
import { projectListQuery } from "@/lib/api/queries";
import type {
  EnrichedSchedulerJob,
  NewSchedulerJob,
  SchedulerJob,
} from "@/server/core/scheduler/schema";
import { SchedulerJobDialog } from "../scheduler/SchedulerJobDialog";

type ScheduledMessageNoticeProps = {
  scheduledJobs: SchedulerJob[];
  projectId: string;
  sessionId: string;
  projectName: string;
};

export const ScheduledMessageNotice: FC<ScheduledMessageNoticeProps> = ({
  scheduledJobs,
  projectId,
  sessionId,
  projectName,
}) => {
  const { i18n } = useLingui();

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<EnrichedSchedulerJob | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // API hooks
  const { data: projectsData } = useQuery({
    queryKey: projectListQuery.queryKey,
    queryFn: projectListQuery.queryFn,
  });
  const updateJob = useUpdateSchedulerJob();
  const deleteJob = useDeleteSchedulerJob();

  const handleEditClick = (job: SchedulerJob) => {
    // Convert SchedulerJob to EnrichedSchedulerJob for the dialog
    const enrichedJob: EnrichedSchedulerJob = {
      ...job,
      projectName,
    };
    setEditingJob(enrichedJob);
    setEditDialogOpen(true);
  };

  const handleUpdateJob = (updatedJob: NewSchedulerJob) => {
    if (!editingJob) return;

    updateJob.mutate(
      {
        id: editingJob.id,
        updates: updatedJob,
      },
      {
        onSuccess: () => {
          toast.success(
            i18n._({
              id: "scheduler.job.updated",
              message: "Job updated successfully",
            }),
          );
          setEditDialogOpen(false);
          setEditingJob(null);
        },
        onError: (error) => {
          toast.error(
            i18n._({
              id: "scheduler.job.update_failed",
              message: "Failed to update job",
            }),
            {
              description: error.message,
            },
          );
        },
      },
    );
  };

  const handleDeleteClick = (jobId: string) => {
    setDeletingJobId(jobId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingJobId) return;

    deleteJob.mutate(deletingJobId, {
      onSuccess: () => {
        toast.success(
          i18n._({
            id: "scheduler.job.deleted",
            message: "Job deleted successfully",
          }),
        );
        setDeleteDialogOpen(false);
        setDeletingJobId(null);
      },
      onError: (error) => {
        toast.error(
          i18n._({
            id: "scheduler.job.delete_failed",
            message: "Failed to delete job",
          }),
          {
            description: error.message,
          },
        );
      },
    });
  };

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
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleEditClick(job)}
                    >
                      <EditIcon className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(job.id)}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
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
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditClick(job)}
                        >
                          <EditIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(job.id)}
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
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

      {/* Edit Dialog */}
      <SchedulerJobDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingJob(null);
        }}
        job={editingJob}
        projectId={projectId}
        projectName={projectName}
        projects={projectsData?.projects ?? []}
        currentSessionId={sessionId}
        onSubmit={handleUpdateJob}
        isSubmitting={updateJob.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans id="scheduler.delete_dialog.title" />
            </DialogTitle>
            <DialogDescription>
              <Trans id="scheduler.delete_dialog.description" />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingJobId(null);
              }}
              disabled={deleteJob.isPending}
            >
              <Trans id="common.cancel" />
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteJob.isPending}
            >
              {deleteJob.isPending ? (
                <Trans id="common.deleting" />
              ) : (
                <Trans id="common.delete" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

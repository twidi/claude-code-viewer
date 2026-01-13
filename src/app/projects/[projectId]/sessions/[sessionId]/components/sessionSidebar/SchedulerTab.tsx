import { Trans, useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import {
  EditIcon,
  FolderIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import { type FC, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type EnrichedSchedulerJob,
  type NewSchedulerJob,
  useCreateSchedulerJob,
  useDeleteSchedulerJob,
  useSchedulerJobs,
  useUpdateSchedulerJob,
} from "@/hooks/useScheduler";
import { projectListQuery } from "@/lib/api/queries";
import { Loading } from "../../../../../../../components/Loading";
import { SchedulerJobDialog } from "../scheduler/SchedulerJobDialog";

export const SchedulerTab: FC<{
  projectId: string;
  sessionId: string;
  projectName: string;
}> = ({ projectId, sessionId, projectName }) => {
  const { i18n } = useLingui();
  const {
    data: jobs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useSchedulerJobs();
  const { data: projectsData } = useQuery({
    queryKey: projectListQuery.queryKey,
    queryFn: projectListQuery.queryFn,
  });
  const createJob = useCreateSchedulerJob();
  const updateJob = useUpdateSchedulerJob();
  const deleteJob = useDeleteSchedulerJob();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<EnrichedSchedulerJob | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<
    string | null
  >(null);

  // Get unique projects from jobs for the filter dropdown
  const projectsWithJobs = useMemo(() => {
    if (!jobs) return [];
    const projectMap = new Map<string, string>();
    for (const job of jobs) {
      if (job.message.projectId && job.projectName) {
        projectMap.set(job.message.projectId, job.projectName);
      }
    }
    return Array.from(projectMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [jobs]);

  // Filter jobs by selected project
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!selectedProjectFilter) return jobs;
    return jobs.filter(
      (job) => job.message.projectId === selectedProjectFilter,
    );
  }, [jobs, selectedProjectFilter]);

  const handleCreateJob = (job: NewSchedulerJob) => {
    createJob.mutate(job, {
      onSuccess: () => {
        toast.success(
          i18n._({
            id: "scheduler.job.created",
            message: "Job created successfully",
          }),
        );
        setDialogOpen(false);
      },
      onError: (error) => {
        toast.error(
          i18n._({
            id: "scheduler.job.create_failed",
            message: "Failed to create job",
          }),
          {
            description: error.message,
          },
        );
      },
    });
  };

  const handleUpdateJob = (job: NewSchedulerJob) => {
    if (!editingJob) return;

    updateJob.mutate(
      {
        id: editingJob.id,
        updates: job,
      },
      {
        onSuccess: () => {
          toast.success(
            i18n._({
              id: "scheduler.job.updated",
              message: "Job updated successfully",
            }),
          );
          setDialogOpen(false);
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

  const handleEditClick = (job: EnrichedSchedulerJob) => {
    setEditingJob(job);
    setDialogOpen(true);
  };

  const handleDeleteClick = (jobId: string) => {
    setDeletingJobId(jobId);
    setDeleteDialogOpen(true);
  };

  const formatSchedule = (job: EnrichedSchedulerJob) => {
    if (job.schedule.type === "cron") {
      return `Cron: ${job.schedule.expression}`;
    }
    if (job.schedule.type === "reserved") {
      const date = new Date(job.schedule.reservedExecutionTime);
      return `Reserved: ${date.toLocaleString()}`;
    }
    if (job.schedule.type === "queued") {
      return i18n._({
        id: "scheduler.schedule.queued",
        message: "Queued: Waiting for session to pause",
      });
    }
    return "Unknown schedule type";
  };

  const formatLastRun = (lastRunAt: string | null) => {
    if (!lastRunAt) return "Never";
    const date = new Date(lastRunAt);
    return date.toLocaleString();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-sidebar-foreground">
            <Trans id="scheduler.title" />
          </h2>
          <div className="flex gap-1">
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={isLoading || isFetching}
              title={i18n._({ id: "common.reload", message: "Reload" })}
            >
              <RefreshCwIcon
                className={`w-3 h-3 ${isLoading || isFetching ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={() => {
                setEditingJob(null);
                setDialogOpen(true);
              }}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title={i18n._({
                id: "scheduler.create_job",
                message: "Create Job",
              })}
            >
              <PlusIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>
        {projectsWithJobs.length > 1 && (
          <Select
            value={selectedProjectFilter ?? "all"}
            onValueChange={(value) =>
              setSelectedProjectFilter(value === "all" ? null : value)
            }
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <FolderIcon className="w-3 h-3 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {i18n._({
                  id: "scheduler.filter.all_projects",
                  message: "All projects",
                })}
              </SelectItem>
              {projectsWithJobs.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-muted-foreground">
              <Loading />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500">
            <Trans
              id="scheduler.error.load_failed"
              values={{ error: error.message }}
            />
          </div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Trans id="scheduler.no_jobs" />
          </div>
        )}

        {jobs && jobs.length > 0 && filteredJobs.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Trans id="scheduler.no_jobs_for_project" />
          </div>
        )}

        {filteredJobs.length > 0 && (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 bg-sidebar-accent/50 rounded-md border border-sidebar-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-sidebar-foreground truncate">
                        {job.name}
                      </h3>
                      <Badge
                        variant={job.enabled ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {job.enabled ? (
                          <Trans id="scheduler.status.enabled" />
                        ) : (
                          <Trans id="scheduler.status.disabled" />
                        )}
                      </Badge>
                    </div>
                    {job.projectName && (
                      <div className="flex items-center gap-1 text-xs text-sidebar-foreground/60 mt-1">
                        <FolderIcon className="w-3 h-3" />
                        <span className="truncate">{job.projectName}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatSchedule(job)}
                    </p>
                  </div>
                  <div className="flex gap-1">
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

                {job.lastRunAt && (
                  <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-sidebar-border">
                    <div className="flex items-center justify-between">
                      <span>
                        <Trans id="scheduler.last_run" />
                        <span>{formatLastRun(job.lastRunAt)}</span>
                      </span>
                      {job.lastRunStatus && (
                        <Badge
                          variant={
                            job.lastRunStatus === "success"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {job.lastRunStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <SchedulerJobDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingJob(null);
        }}
        job={editingJob}
        projectId={projectId}
        projectName={projectName}
        projects={projectsData?.projects ?? []}
        currentSessionId={sessionId}
        onSubmit={editingJob ? handleUpdateJob : handleCreateJob}
        isSubmitting={createJob.isPending || updateJob.isPending}
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

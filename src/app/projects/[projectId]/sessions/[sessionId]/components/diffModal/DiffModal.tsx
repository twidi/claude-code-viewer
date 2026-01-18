import { Trans, useLingui } from "@lingui/react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  GitCompareIcon,
  Loader2,
  MessageSquarePlus,
  RefreshCcwIcon,
} from "lucide-react";
import type { FC } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  PersistentDialogShell,
  useDialogShell,
} from "@/components/PersistentDialogShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type CommentsMap,
  hasNonEmptyComment,
  useDiffLineComment,
} from "@/contexts/DiffLineCommentContext";
import { useFileLineComments } from "@/hooks/useFileLineComments";
import { cn } from "@/lib/utils";
import { formatFileLineComments } from "@/lib/utils/fileLineComments";
import {
  useCommitAndPush,
  useCommitFiles,
  useGitCurrentRevisions,
  useGitDiff,
  usePushCommits,
} from "../../hooks/useGit";
import type { DiffViewOptions } from "./DiffViewer";
import {
  DEFAULT_DIFF_OPTIONS,
  DiffOptionToggle,
  DiffViewer,
  getFileElementId,
} from "./DiffViewer";
import type { DiffModalProps, DiffSummary, FileStatus, GitRef } from "./types";

interface FileStatusBadgeProps {
  status: FileStatus;
  className?: string;
}

const FileStatusBadge: FC<FileStatusBadgeProps> = ({ status, className }) => {
  const config: Record<
    FileStatus,
    { label: string; bgClass: string; textClass: string }
  > = {
    added: {
      label: "A",
      bgClass: "bg-green-100 dark:bg-green-900/30",
      textClass: "text-green-700 dark:text-green-400",
    },
    deleted: {
      label: "D",
      bgClass: "bg-red-100 dark:bg-red-900/30",
      textClass: "text-red-700 dark:text-red-400",
    },
    modified: {
      label: "M",
      bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
      textClass: "text-yellow-700 dark:text-yellow-400",
    },
    renamed: {
      label: "R",
      bgClass: "bg-purple-100 dark:bg-purple-900/30",
      textClass: "text-purple-700 dark:text-purple-400",
    },
    copied: {
      label: "C",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
      textClass: "text-blue-700 dark:text-blue-400",
    },
    untracked: {
      label: "U",
      bgClass: "bg-gray-100 dark:bg-gray-700",
      textClass: "text-gray-700 dark:text-gray-300",
    },
  };

  const { label, bgClass, textClass } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold shrink-0",
        bgClass,
        textClass,
        className,
      )}
      title={status}
    >
      {label}
    </span>
  );
};

interface DiffSummaryProps {
  summary: DiffSummary;
  className?: string;
  onFileClick?: (filePath: string) => void;
  comments?: CommentsMap;
}

const DiffSummaryComponent: FC<DiffSummaryProps> = ({
  summary,
  className,
  onFileClick,
  comments,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count non-empty comments per file
  const commentCountByFile = useMemo(() => {
    if (!comments) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const comment of comments.values()) {
      if (hasNonEmptyComment(comment)) {
        const current = counts.get(comment.filePath) ?? 0;
        counts.set(comment.filePath, current + 1);
      }
    }
    return counts;
  }, [comments]);

  // Total non-empty comment count
  const totalCommentCount = useMemo(() => {
    let total = 0;
    for (const count of commentCountByFile.values()) {
      total += count;
    }
    return total;
  }, [commentCountByFile]);

  return (
    <div
      className={cn(
        "bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 flex items-center justify-between text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
          <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="font-medium">
            <span className="hidden sm:inline">
              {summary.filesChanged} <Trans id="diff.files.changed" />
            </span>
            <span className="sm:hidden">
              {summary.filesChanged} <Trans id="diff.files" />
            </span>
          </span>
          {totalCommentCount > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
              {totalCommentCount} 💬
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {summary.insertions > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">
              +{summary.insertions}
            </span>
          )}
          {summary.deletions > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              -{summary.deletions}
            </span>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1 max-h-60 overflow-y-auto">
          {summary.files.map((file) => {
            const fileCommentCount = commentCountByFile.get(file.filePath) ?? 0;
            return (
              <button
                key={file.filePath}
                type="button"
                onClick={() => onFileClick?.(file.filePath)}
                className="w-full text-left px-2 py-1 text-sm font-mono hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
              >
                <FileStatusBadge status={file.status} />
                <span className="truncate flex-1">{file.filePath}</span>
                {fileCommentCount > 0 && (
                  <span className="shrink-0 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                    {fileCommentCount} 💬
                  </span>
                )}
                <span className="shrink-0 text-xs">
                  {file.additions > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      +{file.additions}
                    </span>
                  )}
                  {file.additions > 0 && file.deletions > 0 && " "}
                  {file.deletions > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      -{file.deletions}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface RefSelectorProps {
  label: string;
  value: string;
  onValueChange: (value: GitRef["name"]) => void;
  refs: GitRef[];
}

const RefSelector: FC<RefSelectorProps> = ({
  label,
  value,
  onValueChange,
  refs,
}) => {
  const id = useId();
  const getRefIcon = (type: GitRef["type"]) => {
    switch (type) {
      case "branch":
        return <GitBranch className="h-4 w-4" />;
      case "commit":
        return <span className="text-xs">📝</span>;
      case "working":
        return <span className="text-xs">🚧</span>;
      default:
        return <GitBranch className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent id={id}>
          {refs.map((ref) => (
            <SelectItem key={ref.name} value={ref.name}>
              <div className="flex items-center gap-2">
                {getRefIcon(ref.type)}
                <span>{ref.displayName}</span>
                {ref.sha && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {ref.sha.substring(0, 7)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// ============================================================================
// DiffModalContent - internal component that gets remounted on resetKey change
// ============================================================================

interface DiffModalContentProps {
  projectId: string;
  projectName: string;
  defaultCompareFrom: string;
  defaultCompareTo: string;
  revisionsData: DiffModalProps["revisionsData"];
}

const DiffModalContent: FC<DiffModalContentProps> = ({
  projectId,
  projectName,
  defaultCompareFrom,
  defaultCompareTo,
  revisionsData: parentRevisionsData,
}) => {
  const { i18n } = useLingui();
  const commitMessageId = useId();
  const [compareFrom, setCompareFrom] = useState(defaultCompareFrom);
  const [compareTo, setCompareTo] = useState(defaultCompareTo);

  // Context for inserting line comments into chat
  const { insertText, setNonEmptyCommentCount } = useDiffLineComment();
  const dialogShell = useDialogShell();

  // Use shared hook for comment management
  const {
    comments,
    handleAddComment,
    handleUpdateComment,
    handleRemoveComment,
    resetComments,
    nonEmptyCommentCount,
  } = useFileLineComments({ setContextCommentCount: setNonEmptyCommentCount });

  // File selection state (FR-002: all selected by default)
  const [selectedFiles, setSelectedFiles] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Commit message state
  const [commitMessage, setCommitMessage] = useState("");

  // Commit section collapse state (default: collapsed)
  const [isCommitSectionExpanded, setIsCommitSectionExpanded] = useState(false);

  // Diff view options state
  const [diffOptions, setDiffOptions] =
    useState<DiffViewOptions>(DEFAULT_DIFF_OPTIONS);

  // API hooks - use parent data if available, otherwise fetch
  const { data: fetchedRevisionsData, isLoading: isLoadingRevisions } =
    useGitCurrentRevisions(projectId);
  const revisionsData = parentRevisionsData ?? fetchedRevisionsData;
  const {
    mutate: getDiff,
    data: diffData,
    isPending: isDiffLoading,
    error: diffError,
  } = useGitDiff();
  const commitMutation = useCommitFiles(projectId);
  const pushMutation = usePushCommits(projectId);
  const commitAndPushMutation = useCommitAndPush(projectId);

  // Transform revisions data to GitRef format
  const gitRefs: GitRef[] =
    revisionsData?.success && revisionsData.data
      ? [
          {
            name: "working" as const,
            type: "working" as const,
            displayName: i18n._("Uncommitted changes"),
          },
          {
            name: "HEAD" as const,
            type: "commit" as const,
            displayName: "HEAD",
          },
          // Add base branch if exists
          ...(revisionsData.data.baseBranch
            ? [
                {
                  name: `branch:${revisionsData.data.baseBranch.name}` as const,
                  type: "branch" as const,
                  displayName: `${revisionsData.data.baseBranch.name} (base)`,
                  sha: revisionsData.data.baseBranch.commit,
                },
              ]
            : []),
          // Add current branch if exists
          ...(revisionsData.data.currentBranch
            ? [
                {
                  name: `branch:${revisionsData.data.currentBranch.name}` as const,
                  type: "branch" as const,
                  displayName: `${revisionsData.data.currentBranch.name} (current)`,
                  sha: revisionsData.data.currentBranch.commit,
                },
              ]
            : []),
          // Add commits from current branch
          ...revisionsData.data.commits.map((commit) => ({
            name: `commit:${commit.sha}` as const,
            type: "commit" as const,
            displayName: `${commit.message.substring(0, 50)}${commit.message.length > 50 ? "..." : ""}`,
            sha: commit.sha,
          })),
        ]
      : [];

  const loadDiff = useCallback(() => {
    if (compareFrom && compareTo && compareFrom !== compareTo) {
      getDiff({
        projectId,
        fromRef: compareFrom,
        toRef: compareTo,
      });
    }
  }, [compareFrom, compareTo, getDiff, projectId]);

  // Initialize file selection when diff data changes (FR-002: all selected by default)
  useEffect(() => {
    if (diffData?.success && diffData.data.files.length > 0) {
      const initialSelection = new Map(
        diffData.data.files.map((file) => [file.filePath, true]),
      );
      setSelectedFiles(initialSelection);
    }
  }, [diffData]);

  // Load diff when refs change
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (compareFrom && compareTo) {
      loadDiff();
      hasLoadedRef.current = true;
    }
  }, [compareFrom, compareTo, loadDiff]);

  const handleCompare = () => {
    loadDiff();
  };

  const handleSendAllComments = useCallback(() => {
    if (nonEmptyCommentCount === 0) return;

    const commentsArray = Array.from(comments.values());
    const formatted = formatFileLineComments(commentsArray);
    insertText(formatted);

    // Clear all comments after sending
    resetComments();

    // Close the dialog so user can see the chat input
    dialogShell?.hide();
  }, [comments, insertText, nonEmptyCommentCount, resetComments, dialogShell]);

  // File selection handlers
  const handleToggleFile = (filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      const newValue = !prev.get(filePath);
      next.set(filePath, newValue);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (diffData?.success && diffData.data.files.length > 0) {
      setSelectedFiles(
        new Map(diffData.data.files.map((file) => [file.filePath, true])),
      );
    }
  };

  const handleDeselectAll = () => {
    if (diffData?.success && diffData.data.files.length > 0) {
      setSelectedFiles(
        new Map(diffData.data.files.map((file) => [file.filePath, false])),
      );
    }
  };

  // Commit handler
  const handleCommit = async () => {
    const selected = Array.from(selectedFiles.entries())
      .filter(([_, isSelected]) => isSelected)
      .map(([path]) => path);

    console.log(
      "[DiffModal.handleCommit] Selected files state:",
      selectedFiles,
    );
    console.log("[DiffModal.handleCommit] Filtered selected files:", selected);
    console.log(
      "[DiffModal.handleCommit] Total files:",
      diffData?.success ? diffData.data.files.length : 0,
    );

    try {
      const result = await commitMutation.mutateAsync({
        files: selected,
        message: commitMessage,
      });

      console.log("[DiffModal.handleCommit] Commit result:", result);

      if (result.success) {
        toast.success(
          `Committed ${result.filesCommitted} files (${result.commitSha.slice(0, 7)})`,
        );
        setCommitMessage(""); // Reset message
        // Reload diff to show updated state
        loadDiff();
      } else {
        toast.error(result.error, { description: result.details });
      }
    } catch (_error) {
      console.error("[DiffModal.handleCommit] Error:", _error);
      toast.error(i18n._("Failed to commit"));
    }
  };

  // Push handler
  const handlePush = async () => {
    try {
      const result = await pushMutation.mutateAsync();

      console.log("[DiffModal.handlePush] Push result:", result);

      if (result.success) {
        toast.success(`Pushed to ${result.remote}/${result.branch}`);
      } else {
        toast.error(result.error, { description: result.details });
      }
    } catch (_error) {
      console.error("[DiffModal.handlePush] Error:", _error);
      toast.error(i18n._("Failed to push"));
    }
  };

  // Commit and Push handler
  const handleCommitAndPush = async () => {
    const selected = Array.from(selectedFiles.entries())
      .filter(([_, isSelected]) => isSelected)
      .map(([path]) => path);

    console.log("[DiffModal.handleCommitAndPush] Selected files:", selected);

    try {
      const result = await commitAndPushMutation.mutateAsync({
        files: selected,
        message: commitMessage,
      });

      console.log("[DiffModal.handleCommitAndPush] Result:", result);

      if (result.success) {
        toast.success(`Committed and pushed (${result.commitSha.slice(0, 7)})`);
        setCommitMessage(""); // Reset message
        // Reload diff to show updated state
        loadDiff();
      } else if (
        result.success === false &&
        "commitSucceeded" in result &&
        result.commitSucceeded
      ) {
        // Partial failure: commit succeeded, push failed
        toast.warning(
          `Committed (${result.commitSha?.slice(0, 7)}), but push failed: ${result.error}`,
          {
            action: {
              label: i18n._("Retry Push"),
              onClick: handlePush,
            },
          },
        );
        setCommitMessage(""); // Reset message since commit succeeded
        // Reload diff to show updated state (commit succeeded)
        loadDiff();
      } else {
        toast.error(result.error, { description: result.details });
      }
    } catch (_error) {
      console.error("[DiffModal.handleCommitAndPush] Error:", _error);
      toast.error(i18n._("Failed to commit and push"));
    }
  };

  // Validation
  const selectedCount = Array.from(selectedFiles.values()).filter(
    Boolean,
  ).length;
  const isCommitDisabled =
    selectedCount === 0 ||
    commitMessage.trim().length === 0 ||
    commitMutation.isPending;

  return (
    <>
      <PersistentDialogShell.Header>
        <GitCompareIcon className="w-5 h-5" />
        <span className="font-semibold">
          <Trans id="control.git" /> — {projectName}
        </span>
      </PersistentDialogShell.Header>

      <PersistentDialogShell.Content className="gap-4 px-2 md:px-8 py-6">
        <div className="flex flex-wrap items-end gap-2">
          <RefSelector
            label={i18n._("Compare from")}
            value={compareFrom}
            onValueChange={setCompareFrom}
            refs={gitRefs.filter((ref) => ref.name !== "working")}
          />
          <RefSelector
            label={i18n._("Compare to")}
            value={compareTo}
            onValueChange={setCompareTo}
            refs={gitRefs}
          />
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <DiffOptionToggle
              label={<Trans id="diff.options.split" />}
              checked={diffOptions.mode === "split"}
              onChange={(isSplit) =>
                setDiffOptions((prev) => ({
                  ...prev,
                  mode: isSplit ? "split" : "unified",
                }))
              }
            />
            <DiffOptionToggle
              label={<Trans id="diff.options.wrap" />}
              checked={diffOptions.wrap}
              onChange={(wrap) => setDiffOptions((prev) => ({ ...prev, wrap }))}
            />
            <DiffOptionToggle
              label={<Trans id="diff.options.highlight" />}
              checked={diffOptions.highlight}
              onChange={(highlight) =>
                setDiffOptions((prev) => ({ ...prev, highlight }))
              }
            />
            {compareTo === "working" && (
              <Button
                onClick={() =>
                  setIsCommitSectionExpanded(!isCommitSectionExpanded)
                }
                size="sm"
                variant={isCommitSectionExpanded ? "default" : "outline"}
                title={i18n._("Commit Changes")}
              >
                <GitCommitHorizontal className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={handleCompare}
              disabled={
                isDiffLoading || isLoadingRevisions || compareFrom === compareTo
              }
              size="sm"
            >
              {isDiffLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcwIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {diffError && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400 text-sm">
              {diffError.message}
            </p>
          </div>
        )}

        {diffData?.success && (
          <>
            {/* Commit UI Section - shown when toggle is active */}
            {compareTo === "working" && isCommitSectionExpanded && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg mb-3 border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Trans id="diff.commit.changes" />
                </h3>
                {/* File selection controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSelectAll}
                      disabled={commitMutation.isPending}
                    >
                      <Trans id="diff.select.all" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDeselectAll}
                      disabled={commitMutation.isPending}
                    >
                      <Trans id="diff.deselect.all" />
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedCount} / {diffData.data.files.length} files
                      selected
                    </span>
                  </div>
                </div>

                {/* File list with checkboxes */}
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2">
                  {diffData.data.files.map((file) => (
                    <div
                      key={file.filePath}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={`file-${file.filePath}`}
                        checked={selectedFiles.get(file.filePath) ?? false}
                        onCheckedChange={() => handleToggleFile(file.filePath)}
                        disabled={commitMutation.isPending}
                      />
                      <FileStatusBadge status={file.status} />
                      <label
                        htmlFor={`file-${file.filePath}`}
                        className="text-sm font-mono cursor-pointer flex-1 truncate"
                      >
                        {file.filePath}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Commit message input */}
                <div className="space-y-2">
                  <label
                    htmlFor={commitMessageId}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Trans id="diff.commit.message" />
                  </label>
                  <Textarea
                    id={commitMessageId}
                    placeholder="Enter commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    disabled={commitMutation.isPending}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handleCommit}
                    disabled={isCommitDisabled}
                    className="w-full sm:w-auto"
                  >
                    {commitMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <Trans id="diff.committing" />
                      </>
                    ) : (
                      <Trans id="diff.commit" />
                    )}
                  </Button>
                  <Button
                    onClick={handlePush}
                    disabled={pushMutation.isPending}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {pushMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <Trans id="diff.pushing" />
                      </>
                    ) : (
                      <Trans id="diff.push" />
                    )}
                  </Button>
                  <Button
                    onClick={handleCommitAndPush}
                    disabled={
                      isCommitDisabled || commitAndPushMutation.isPending
                    }
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    {commitAndPushMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <Trans id="diff.committing.pushing" />
                      </>
                    ) : (
                      <Trans id="diff.commit.push" />
                    )}
                  </Button>
                  {isCommitDisabled &&
                    !commitMutation.isPending &&
                    !commitAndPushMutation.isPending && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedCount === 0 ? (
                          <Trans id="diff.select.file" />
                        ) : (
                          <Trans id="diff.enter.message" />
                        )}
                      </span>
                    )}
                </div>
              </div>
            )}

            {/* File summary - outside scrollable area for easy navigation */}
            <DiffSummaryComponent
              summary={{
                filesChanged: diffData.data.summary.totalFiles,
                insertions: diffData.data.summary.totalAdditions,
                deletions: diffData.data.summary.totalDeletions,
                files: diffData.data.files,
              }}
              comments={comments}
              className="mb-3 shrink-0"
              onFileClick={(filePath) => {
                const element = document.getElementById(
                  getFileElementId(filePath),
                );
                element?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />

            {/* Scrollable diff content */}
            <div className="flex-1 overflow-auto min-h-0 relative">
              <DiffViewer
                rawDiff={diffData.data.rawDiff}
                options={diffOptions}
                fileStats={diffData.data.files}
                comments={comments}
                onAddComment={handleAddComment}
                onUpdateComment={handleUpdateComment}
                onRemoveComment={handleRemoveComment}
              />

              {/* Floating button to send all comments (only non-empty ones) */}
              {nonEmptyCommentCount > 0 && (
                <div className="sticky bottom-4 flex justify-end pr-4 pointer-events-none z-10">
                  <Button
                    onClick={handleSendAllComments}
                    className="pointer-events-auto shadow-lg bg-blue-500 hover:bg-blue-600 text-white"
                    size="sm"
                  >
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    <Trans
                      id="diff.line_comment.send_all"
                      values={{ count: nonEmptyCommentCount }}
                    />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {isDiffLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Trans id="diff.loading" />
              </p>
            </div>
          </div>
        )}
      </PersistentDialogShell.Content>
    </>
  );
};

// ============================================================================
// DiffModal - wrapper component that uses PersistentDialogShell
// ============================================================================

export const DiffModal: FC<DiffModalProps> = ({
  projectId,
  projectName,
  branchName,
  defaultCompareFrom = "HEAD",
  defaultCompareTo = "working",
  revisionsData,
}) => {
  // Get nonEmptyCommentCount from context for badge and close confirmation
  const { nonEmptyCommentCount } = useDiffLineComment();

  // Build resetKey: reset when projectId or branchName changes
  const resetKey = branchName ? `${projectId}-${branchName}` : projectId;

  return (
    <PersistentDialogShell
      dialogId="git"
      config={{
        icon: GitCompareIcon,
        label: <Trans id="control.git" />,
        description: projectName,
        badgeCount: nonEmptyCommentCount,
      }}
      resetKey={resetKey}
      fullWidth
      closeConfirmation={{
        shouldConfirm: () => nonEmptyCommentCount > 0,
        title: <Trans id="diff.close_confirm.title" />,
        description: (
          <Trans
            id="diff.close_confirm.description"
            values={{ count: nonEmptyCommentCount }}
          />
        ),
        cancelLabel: <Trans id="diff.close_confirm.cancel" />,
        confirmLabel: <Trans id="diff.close_confirm.confirm" />,
      }}
    >
      <DiffModalContent
        projectId={projectId}
        projectName={projectName}
        defaultCompareFrom={defaultCompareFrom}
        defaultCompareTo={defaultCompareTo}
        revisionsData={revisionsData}
      />
    </PersistentDialogShell>
  );
};

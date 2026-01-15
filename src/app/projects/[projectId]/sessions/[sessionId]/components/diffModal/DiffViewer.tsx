"use client";

import { DiffFile, DiffModeEnum, DiffView } from "@git-diff-view/react";
import { Trans } from "@lingui/react";
import "@git-diff-view/react/styles/diff-view.css";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type FC, useCallback, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import type { FileStatus } from "./types";

export interface DiffViewOptions {
  mode: "split" | "unified";
  wrap: boolean;
  highlight: boolean;
}

// Threshold for considering a diff "large" (in characters)
const LARGE_DIFF_CHAR_THRESHOLD = 5_000;
// Threshold for line count
const LARGE_DIFF_LINE_THRESHOLD = 250;

/**
 * Splits a raw multi-file git diff into individual file diff strings.
 * Each file diff starts with "diff --git"
 */
function splitDiffByFiles(rawDiff: string): string[] {
  if (!rawDiff || rawDiff.trim() === "") {
    return [];
  }

  const fileDiffs: string[] = [];
  const lines = rawDiff.split("\n");
  let currentDiff: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ") && currentDiff.length > 0) {
      fileDiffs.push(currentDiff.join("\n"));
      currentDiff = [];
    }
    currentDiff.push(line);
  }

  if (currentDiff.length > 0) {
    fileDiffs.push(currentDiff.join("\n"));
  }

  return fileDiffs;
}

/**
 * Extracts file name from diff header (prefers new file name)
 */
function extractFileName(diffText: string): string {
  const lines = diffText.split("\n");
  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      const name = line.slice(4).replace(/^b\//, "");
      if (name !== "/dev/null") return name;
    }
  }
  // Fallback: try --- line for deleted files
  for (const line of lines) {
    if (line.startsWith("--- ")) {
      const name = line.slice(4).replace(/^a\//, "");
      if (name !== "/dev/null") return name;
    }
  }
  return "unknown";
}

/**
 * Gets language from file extension
 */
function getLangFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
  };
  return langMap[ext] ?? "text";
}

/**
 * Checks if a diff is considered "large" based on character count or line count
 */
function isLargeDiff(diffText: string): boolean {
  if (diffText.length > LARGE_DIFF_CHAR_THRESHOLD) {
    return true;
  }
  const lineCount = diffText.split("\n").length;
  return lineCount > LARGE_DIFF_LINE_THRESHOLD;
}

/**
 * Formats byte size to human readable string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generates a DOM-safe ID from a file path for scroll targeting
 */
export function getFileElementId(filePath: string): string {
  return `diff-file-${filePath.replace(/[^a-zA-Z0-9-_]/g, "-")}`;
}

interface FileStats {
  additions: number;
  deletions: number;
  status?: FileStatus;
}

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

interface SingleFileDiffProps {
  diffText: string;
  theme: "light" | "dark";
  options: DiffViewOptions;
  stats?: FileStats;
}

interface FileHeaderProps {
  fileName: string;
  isCollapsed: boolean;
  onToggle: () => void;
  stats?: FileStats;
}

const FileHeader: FC<FileHeaderProps> = ({
  fileName,
  isCollapsed,
  onToggle,
  stats,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-mono border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left"
  >
    {isCollapsed ? (
      <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
    ) : (
      <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
    )}
    {stats?.status && <FileStatusBadge status={stats.status} />}
    <span className="truncate flex-1">{fileName}</span>
    {stats && (
      <span className="shrink-0 text-xs">
        {stats.additions > 0 && (
          <span className="text-green-600 dark:text-green-400">
            +{stats.additions}
          </span>
        )}
        {stats.additions > 0 && stats.deletions > 0 && " "}
        {stats.deletions > 0 && (
          <span className="text-red-600 dark:text-red-400">
            -{stats.deletions}
          </span>
        )}
      </span>
    )}
  </button>
);

interface LargeDiffPlaceholderProps {
  fileName: string;
  diffSize: number;
  lineCount: number;
  onLoad: () => void;
  stats?: FileStats;
}

const LargeDiffPlaceholder: FC<LargeDiffPlaceholderProps> = ({
  fileName,
  diffSize,
  lineCount,
  onLoad,
  stats,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      id={getFileElementId(fileName)}
      className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
    >
      <FileHeader
        fileName={fileName}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        stats={stats}
      />
      {!isCollapsed && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 flex items-center justify-between">
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <Trans
              id="diff.large_file.message"
              values={{ size: formatSize(diffSize), lines: lineCount }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoad}
            className="shrink-0 ml-4"
          >
            <ChevronRight className="w-4 h-4 mr-1" />
            <Trans id="diff.large_file.load" />
          </Button>
        </div>
      )}
    </div>
  );
};

const SingleFileDiff: FC<SingleFileDiffProps> = ({
  diffText,
  theme,
  options,
  stats,
}) => {
  const fileName = useMemo(() => extractFileName(diffText), [diffText]);
  const lang = useMemo(() => getLangFromFileName(fileName), [fileName]);
  const large = useMemo(() => isLargeDiff(diffText), [diffText]);
  const [expanded, setExpanded] = useState(!large);

  const diffSize = diffText.length;
  const lineCount = useMemo(() => diffText.split("\n").length, [diffText]);

  const handleLoad = useCallback(() => {
    setExpanded(true);
    // After expanding, scroll to keep the file header at the same visual position
    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(() => {
      const element = document.getElementById(getFileElementId(fileName));
      element?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }, [fileName]);

  // Show placeholder for large diffs that haven't been expanded
  if (large && !expanded) {
    return (
      <LargeDiffPlaceholder
        fileName={fileName}
        diffSize={diffSize}
        lineCount={lineCount}
        onLoad={handleLoad}
        stats={stats}
      />
    );
  }

  return (
    <SingleFileDiffContent
      diffText={diffText}
      theme={theme}
      options={options}
      fileName={fileName}
      lang={lang}
      stats={stats}
    />
  );
};

interface SingleFileDiffContentProps {
  diffText: string;
  theme: "light" | "dark";
  options: DiffViewOptions;
  fileName: string;
  lang: string;
  stats?: FileStats;
}

const SingleFileDiffContent: FC<SingleFileDiffContentProps> = ({
  diffText,
  theme,
  options,
  fileName,
  lang,
  stats,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const diffFile = useMemo(() => {
    // DiffFile expects the full git diff for a single file in the hunks array
    // The library's internal DiffParser will parse it
    const file = DiffFile.createInstance({
      oldFile: {
        fileName: fileName || undefined,
        fileLang: lang,
        content: "",
      },
      newFile: {
        fileName: fileName || undefined,
        fileLang: lang,
        content: "",
      },
      hunks: [diffText], // Pass the full diff string for this file
    });

    file.initTheme(theme);
    file.init();
    file.buildSplitDiffLines();

    return file;
  }, [diffText, theme, fileName, lang]);

  const diffViewMode =
    options.mode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified;

  return (
    <div
      id={getFileElementId(fileName)}
      className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
    >
      <FileHeader
        fileName={fileName}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        stats={stats}
      />
      {!isCollapsed && (
        <DiffView
          diffFile={diffFile}
          diffViewMode={diffViewMode}
          diffViewHighlight={options.highlight}
          diffViewWrap={options.wrap}
        />
      )}
    </div>
  );
};

export const DEFAULT_DIFF_OPTIONS: DiffViewOptions = {
  mode: "unified",
  wrap: true,
  highlight: false,
};

interface OptionToggleProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const DiffOptionToggle: FC<OptionToggleProps> = ({
  label,
  checked,
  onChange,
}) => {
  const id = useId();
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <label
        htmlFor={id}
        className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none"
      >
        {label}
      </label>
    </div>
  );
};

export interface DiffFileStats {
  filePath: string;
  additions: number;
  deletions: number;
  status: FileStatus;
}

interface DiffViewerProps {
  rawDiff: string;
  options: DiffViewOptions;
  className?: string;
  fileStats?: DiffFileStats[];
}

export const DiffViewer: FC<DiffViewerProps> = ({
  rawDiff,
  options,
  className,
  fileStats,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = isDark ? "dark" : "light";

  const fileDiffs = useMemo(() => splitDiffByFiles(rawDiff), [rawDiff]);

  // Create a map for quick stats lookup by file path
  const statsMap = useMemo(() => {
    if (!fileStats) return new Map<string, FileStats>();
    return new Map(
      fileStats.map((f) => [
        f.filePath,
        { additions: f.additions, deletions: f.deletions, status: f.status },
      ]),
    );
  }, [fileStats]);

  if (fileDiffs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
        No changes to display
      </div>
    );
  }

  return (
    <div className={className}>
      {fileDiffs.map((diffText) => {
        const fileName = extractFileName(diffText);
        return (
          <SingleFileDiff
            key={fileName}
            diffText={diffText}
            theme={theme}
            options={options}
            stats={statsMap.get(fileName)}
          />
        );
      })}
    </div>
  );
};

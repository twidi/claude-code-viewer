import type React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type FileSearchEntry,
  FileSearchResults,
  type FileSearchResultsRef,
} from "../../../../../components/FileSearchResults";
import {
  Collapsible,
  CollapsibleContent,
} from "../../../../../components/ui/collapsible";
import { cn } from "../../../../../lib/utils";

type FileCompletionProps = {
  projectId: string;
  inputValue: string;
  cursorIndex: number;
  onFileSelect: (newMessage: string, newCursorPosition: number) => void;
  className?: string;
};

export type FileCompletionRef = {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
};

// Parse the @ completion from input value, considering cursor position
const parseFileCompletionFromInput = (input: string, cursorIndex: number) => {
  // Find the last @ symbol BEFORE the cursor
  const textBeforeCursor = input.slice(0, cursorIndex);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return {
      shouldShow: false,
      searchPath: "",
      beforeAt: "",
      textAfterCursor: "",
    };
  }

  // Get the text before @
  const beforeAt = input.slice(0, lastAtIndex);

  // The search path is the text between @ and cursor
  const searchPath = input.slice(lastAtIndex + 1, cursorIndex);

  // Text after the cursor (to preserve when selecting)
  const textAfterCursor = input.slice(cursorIndex);

  // Don't show completion if there's whitespace in the search path
  // (means user moved cursor past a completed path)
  const hasSpaceInSearchPath = /\s/.test(searchPath);

  return {
    shouldShow: !hasSpaceInSearchPath,
    searchPath,
    beforeAt,
    textAfterCursor,
  };
};

export const FileCompletion = forwardRef<
  FileCompletionRef,
  FileCompletionProps
>(({ projectId, inputValue, cursorIndex, onFileSelect, className }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  // Track the searchPath when user dismissed with Escape to prevent auto-reopen
  const [dismissedSearchPath, setDismissedSearchPath] = useState<string | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<FileSearchResultsRef>(null);

  // Parse the input to extract the path being completed
  const { shouldShow, searchPath, beforeAt, textAfterCursor } = useMemo(
    () => parseFileCompletionFromInput(inputValue, cursorIndex),
    [inputValue, cursorIndex],
  );

  // Track previous shouldShow to detect when completion is newly triggered
  const prevShouldShowRef = useRef(shouldShow);

  // Reset dismissed state when:
  // 1. searchPath changes (user typed something new after @)
  // 2. shouldShow transitions from false to true (user typed a new @)
  useEffect(() => {
    const prevShouldShow = prevShouldShowRef.current;
    prevShouldShowRef.current = shouldShow;

    if (dismissedSearchPath !== null) {
      if (
        searchPath !== dismissedSearchPath ||
        (!prevShouldShow && shouldShow)
      ) {
        setDismissedSearchPath(null);
      }
    }
  }, [searchPath, dismissedSearchPath, shouldShow]);

  // Determine if completion should be shown
  const isDismissed = dismissedSearchPath === searchPath;
  const shouldBeOpen = shouldShow && !isDismissed;

  // Update open state
  useEffect(() => {
    setIsOpen(shouldBeOpen);
  }, [shouldBeOpen]);

  // Handle file/directory selection
  const handleEntrySelect = useCallback(
    (entry: FileSearchEntry) => {
      const fullPath = entry.path;

      // For directories: add "/" to continue completion
      // For files or select-folder: add " " to end completion
      const isDirectory = entry.type === "directory";

      let newMessage: string;
      let newCursorPosition: number;

      if (isDirectory) {
        // Directory: add "/" and preserve text after cursor
        newMessage = `${beforeAt}@${fullPath}/${textAfterCursor}`;
        newCursorPosition = beforeAt.length + 1 + fullPath.length + 1;
      } else {
        // File or select-folder: add space (if needed) and preserve text after cursor
        const needsSpace =
          textAfterCursor.length === 0 || !/^\s/.test(textAfterCursor);
        const spacer = needsSpace ? " " : "";
        newMessage = `${beforeAt}@${fullPath}${spacer}${textAfterCursor}`;
        newCursorPosition =
          beforeAt.length + 1 + fullPath.length + spacer.length;
      }

      onFileSelect(newMessage, newCursorPosition);

      // Close completion if it's a file or select-folder
      if (entry.type === "file" || entry.type === "select-folder") {
        setIsOpen(false);
        setDismissedSearchPath(fullPath);
      }
    },
    [beforeAt, textAfterCursor, onFileSelect],
  );

  // Handle dismiss (Escape)
  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    setDismissedSearchPath(searchPath);
  }, [searchPath]);

  // Handle clicks outside the component
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Expose keyboard handler to parent
  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown: (e: React.KeyboardEvent) => {
        return searchResultsRef.current?.handleKeyDown(e) ?? false;
      },
    }),
    [],
  );

  if (!shouldShow) {
    return null;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="absolute z-50 w-full">
            <FileSearchResults
              ref={searchResultsRef}
              projectId={projectId}
              searchQuery={searchPath}
              onSelect={handleEntrySelect}
              onDismiss={handleDismiss}
              isOpen={isOpen}
              fixedHeight="20rem"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

FileCompletion.displayName = "FileCompletion";

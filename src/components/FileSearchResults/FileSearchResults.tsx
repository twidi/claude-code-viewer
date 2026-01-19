import { useLingui } from "@lingui/react";
import {
  CheckIcon,
  FileIcon,
  FolderCheckIcon,
  FolderIcon,
  SearchIcon,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useFileCompletion } from "@/hooks/useFileCompletion";
import { useFuzzyFileSearch } from "@/hooks/useFuzzyFileSearch";
import { cn } from "@/lib/utils";

/**
 * Entry type combining fuzzy search and directory browsing results
 */
export type FileSearchEntry = {
  name: string;
  type: "file" | "directory" | "select-folder";
  path: string;
  source: "fuzzy" | "directory" | "action";
  score?: number;
};

export type FileSearchResultsProps = {
  /** Project ID for API calls */
  projectId: string;
  /** Current search query (e.g., "src/com" or just "utils") */
  searchQuery: string;
  /** Called when user selects an entry */
  onSelect: (entry: FileSearchEntry) => void;
  /** Called when user presses Escape */
  onDismiss?: () => void;
  /** Whether the component is visible/active */
  isOpen: boolean;
  /** Optional fixed height. If not provided, height is based on content */
  fixedHeight?: string;
  /** Optional max height when using variable height */
  maxHeight?: string;
  /** Optional className for the container */
  className?: string;
};

export type FileSearchResultsRef = {
  /** Handle keyboard navigation. Returns true if event was handled. */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Reset selection to first item */
  resetSelection: () => void;
};

/**
 * Parse search query to extract base path and filter term.
 * Examples:
 * - "src/com" -> basePath="/src/", filterTerm="com"
 * - "utils" -> basePath="/", filterTerm="utils"
 * - "src/components/" -> basePath="/src/components/", filterTerm=""
 */
const parseSearchQuery = (query: string) => {
  if (!query) {
    return { basePath: "/", filterTerm: "" };
  }

  const lastSlashIndex = query.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return { basePath: "/", filterTerm: query };
  }

  const path = query.slice(0, lastSlashIndex + 1);
  const term = query.slice(lastSlashIndex + 1);
  return {
    basePath: path.startsWith("/") ? path : `/${path}`,
    filterTerm: term,
  };
};

/**
 * FileSearchResults - Reusable file search results component.
 *
 * This is a "pure" component that:
 * - Receives a search query string
 * - Fetches and combines fuzzy search + directory browsing results
 * - Renders the results list with keyboard navigation
 * - Calls onSelect when user picks an entry
 *
 * It does NOT handle:
 * - Input field rendering (parent provides searchQuery)
 * - Positioning (parent handles where to place this)
 * - Parsing special characters like @ (parent does that)
 */
export const FileSearchResults = forwardRef<
  FileSearchResultsRef,
  FileSearchResultsProps
>(
  (
    {
      projectId,
      searchQuery,
      onSelect,
      onDismiss,
      isOpen,
      fixedHeight,
      maxHeight = "20rem",
      className,
    },
    ref,
  ) => {
    const { i18n } = useLingui();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Parse query to get base path and filter
    const { basePath, filterTerm } = useMemo(
      () => parseSearchQuery(searchQuery),
      [searchQuery],
    );

    // Fetch directory contents for current path
    const { data: completionData, isLoading: isLoadingCompletion } =
      useFileCompletion(projectId, basePath, isOpen);

    // Fetch fuzzy search results (only when there's a search term)
    const { data: fuzzyData, isLoading: isLoadingFuzzy } = useFuzzyFileSearch(
      projectId,
      "/", // Always search from root
      searchQuery, // Full query for fuzzy matching
      10,
      isOpen && searchQuery.length > 0,
    );

    // Filter directory entries based on filter term
    const filteredDirectoryEntries = useMemo(() => {
      if (!completionData?.entries) return [];

      if (!filterTerm) {
        return completionData.entries;
      }

      return completionData.entries.filter((entry) =>
        entry.name.toLowerCase().includes(filterTerm.toLowerCase()),
      );
    }, [completionData?.entries, filterTerm]);

    // Convert to combined entries format
    const directoryEntries: FileSearchEntry[] = useMemo(
      () =>
        filteredDirectoryEntries.map((entry) => ({
          ...entry,
          source: "directory" as const,
        })),
      [filteredDirectoryEntries],
    );

    // Get fuzzy search entries (excluding entries already in current directory)
    const fuzzyEntries: FileSearchEntry[] = useMemo(() => {
      if (!fuzzyData?.entries || !searchQuery) return [];

      const directoryPaths = new Set(directoryEntries.map((e) => e.path));

      return fuzzyData.entries
        .filter((entry) => !directoryPaths.has(entry.path))
        .map((entry) => ({
          ...entry,
          source: "fuzzy" as const,
        }));
    }, [fuzzyData?.entries, directoryEntries, searchQuery]);

    // Create "Select this folder" action when inside a directory
    const selectFolderEntry: FileSearchEntry | null = useMemo(() => {
      if (basePath === "/" || !basePath || filterTerm) return null;
      const folderPath = basePath.endsWith("/")
        ? basePath.slice(0, -1)
        : basePath;
      const folderName = folderPath.split("/").pop() || folderPath;
      return {
        name: folderName,
        type: "select-folder" as const,
        path: folderPath,
        source: "action" as const,
      };
    }, [basePath, filterTerm]);

    // Combine all lists
    const allEntries = useMemo(() => {
      const entries: FileSearchEntry[] = [];
      if (selectFolderEntry) {
        entries.push(selectFolderEntry);
      }
      entries.push(...fuzzyEntries, ...directoryEntries);
      return entries;
    }, [selectFolderEntry, fuzzyEntries, directoryEntries]);

    // Reset selection when entries change
    useEffect(() => {
      if (allEntries.length > 0) {
        setSelectedIndex(0);
      }
    }, [allEntries.length]);

    // Scroll to selected entry
    const scrollToSelected = useCallback((index: number) => {
      if (index >= 0 && listRef.current) {
        const buttons = listRef.current.querySelectorAll(
          'button[role="option"]',
        );
        const selectedButton = buttons[index] as HTMLElement | undefined;
        if (selectedButton) {
          selectedButton.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }
    }, []);

    // Handle entry selection
    const handleEntrySelect = useCallback(
      (entry: FileSearchEntry) => {
        onSelect(entry);
      },
      [onSelect],
    );

    // Keyboard navigation
    const handleKeyboardNavigation = useCallback(
      (e: React.KeyboardEvent): boolean => {
        if (!isOpen || allEntries.length === 0) return false;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) => {
              const newIndex = prev < allEntries.length - 1 ? prev + 1 : 0;
              requestAnimationFrame(() => scrollToSelected(newIndex));
              return newIndex;
            });
            return true;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) => {
              const newIndex = prev > 0 ? prev - 1 : allEntries.length - 1;
              requestAnimationFrame(() => scrollToSelected(newIndex));
              return newIndex;
            });
            return true;
          case "Home":
            e.preventDefault();
            setSelectedIndex(0);
            requestAnimationFrame(() => scrollToSelected(0));
            return true;
          case "End":
            e.preventDefault();
            setSelectedIndex(allEntries.length - 1);
            requestAnimationFrame(() =>
              scrollToSelected(allEntries.length - 1),
            );
            return true;
          case "Enter":
          case "Tab":
            if (selectedIndex >= 0 && selectedIndex < allEntries.length) {
              e.preventDefault();
              const selectedEntry = allEntries[selectedIndex];
              if (selectedEntry) {
                handleEntrySelect(selectedEntry);
              }
              return true;
            }
            break;
          case "Escape":
            e.preventDefault();
            onDismiss?.();
            return true;
        }
        return false;
      },
      [
        isOpen,
        allEntries,
        selectedIndex,
        handleEntrySelect,
        scrollToSelected,
        onDismiss,
      ],
    );

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        handleKeyDown: handleKeyboardNavigation,
        resetSelection: () => setSelectedIndex(0),
      }),
      [handleKeyboardNavigation],
    );

    const isLoading = isLoadingCompletion || (searchQuery && isLoadingFuzzy);

    if (!isOpen || isLoading || allEntries.length === 0) {
      return null;
    }

    // Track global index for keyboard navigation
    let globalIndex = 0;

    const heightStyle = fixedHeight ? { height: fixedHeight } : { maxHeight };

    return (
      <div
        ref={listRef}
        className={cn(
          "bg-popover border border-border rounded-lg shadow-xl overflow-y-auto",
          className,
        )}
        style={heightStyle}
        role="listbox"
        aria-label={i18n._("Available files and directories")}
      >
        {/* Select this folder action */}
        {selectFolderEntry &&
          (() => {
            const currentIndex = globalIndex++;
            return (
              <div className="p-1.5 border-b border-border/50">
                <Button
                  key="select-folder"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-mono text-sm h-9 px-3 min-w-0 transition-colors duration-150",
                    currentIndex === selectedIndex
                      ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-foreground border border-green-500/20"
                      : "hover:bg-accent/50",
                  )}
                  onClick={() => handleEntrySelect(selectFolderEntry)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                  role="option"
                  aria-selected={currentIndex === selectedIndex}
                  aria-label={i18n._("Select folder {name}", {
                    name: selectFolderEntry.name,
                  })}
                  title={selectFolderEntry.path}
                >
                  <FolderCheckIcon className="w-3.5 h-3.5 mr-2 text-green-600 dark:text-green-500 flex-shrink-0" />
                  <span className="font-medium truncate min-w-0">
                    {i18n._("Select this folder")}
                  </span>
                  <span className="text-xs text-muted-foreground/70 ml-2 truncate">
                    ({selectFolderEntry.path})
                  </span>
                  {currentIndex === selectedIndex && (
                    <CheckIcon className="w-3.5 h-3.5 ml-auto text-green-600 dark:text-green-500 flex-shrink-0" />
                  )}
                </Button>
              </div>
            );
          })()}

        {/* Fuzzy search results section */}
        {fuzzyEntries.length > 0 && (
          <div className="p-1.5 border-b border-border/50">
            <div
              className="px-3 py-2 text-xs font-semibold text-muted-foreground/80 mb-1 flex items-center gap-2"
              role="presentation"
            >
              <SearchIcon className="w-3.5 h-3.5" />
              {i18n._("Search Results")} ({fuzzyEntries.length})
            </div>
            {fuzzyEntries.map((entry) => {
              const currentIndex = globalIndex++;
              return (
                <Button
                  key={`fuzzy-${entry.path}`}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-mono text-sm h-9 px-3 min-w-0 transition-colors duration-150",
                    currentIndex === selectedIndex
                      ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-foreground border border-blue-500/20"
                      : "hover:bg-accent/50",
                  )}
                  onClick={() => handleEntrySelect(entry)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                  role="option"
                  aria-selected={currentIndex === selectedIndex}
                  aria-label={`${entry.type}: ${entry.name}`}
                  title={entry.path}
                >
                  {entry.type === "directory" ? (
                    <FolderIcon className="w-3.5 h-3.5 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <FileIcon className="w-3.5 h-3.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="font-medium truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground/70 truncate">
                      {entry.path}
                    </span>
                  </span>
                  {entry.type === "directory" && (
                    <span className="text-muted-foreground ml-1 flex-shrink-0">
                      /
                    </span>
                  )}
                  {currentIndex === selectedIndex && (
                    <CheckIcon className="w-3.5 h-3.5 ml-auto text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* Directory entries section */}
        {directoryEntries.length > 0 && (
          <div className="p-1.5">
            <div
              className="px-3 py-2 text-xs font-semibold text-muted-foreground/80 mb-1 flex items-center gap-2"
              role="presentation"
            >
              <FileIcon className="w-3.5 h-3.5" />
              {basePath === "/"
                ? i18n._("Files & Directories")
                : i18n._("In {path}", { path: basePath })}{" "}
              ({directoryEntries.length})
            </div>
            {directoryEntries.map((entry) => {
              const currentIndex = globalIndex++;
              return (
                <Button
                  key={`dir-${entry.path}`}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-mono text-sm h-9 px-3 min-w-0 transition-colors duration-150",
                    currentIndex === selectedIndex
                      ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-foreground border border-blue-500/20"
                      : "hover:bg-accent/50",
                  )}
                  onClick={() => handleEntrySelect(entry)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                  role="option"
                  aria-selected={currentIndex === selectedIndex}
                  aria-label={`${entry.type}: ${entry.name}`}
                  title={entry.path}
                >
                  {entry.type === "directory" ? (
                    <FolderIcon className="w-3.5 h-3.5 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <FileIcon className="w-3.5 h-3.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate min-w-0">
                    {entry.name}
                  </span>
                  {entry.type === "directory" && (
                    <span className="text-muted-foreground ml-1 flex-shrink-0">
                      /
                    </span>
                  )}
                  {currentIndex === selectedIndex && (
                    <CheckIcon className="w-3.5 h-3.5 ml-auto text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

FileSearchResults.displayName = "FileSearchResults";

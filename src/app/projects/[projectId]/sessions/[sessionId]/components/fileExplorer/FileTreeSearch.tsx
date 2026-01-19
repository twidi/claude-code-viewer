import { useLingui } from "@lingui/react";
import { SearchIcon, XIcon } from "lucide-react";
import type { FC, KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";
import {
  type FileSearchEntry,
  FileSearchResults,
  type FileSearchResultsRef,
} from "@/components/FileSearchResults";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FileTreeSearchProps {
  /** Project ID for API calls */
  projectId: string;
  /** Called when a file is selected from search results */
  onFileSelect: (filePath: string) => void;
  /** Called when a directory is selected (to expand it in tree) */
  onDirectorySelect?: (dirPath: string) => void;
  /** Optional className */
  className?: string;
}

/**
 * FileTreeSearch - Search input with dropdown results for the FileTree.
 *
 * Appears at the top of the FileTree panel, allows fuzzy searching
 * through all project files. Uses the shared FileSearchResults component.
 */
export const FileTreeSearch: FC<FileTreeSearchProps> = ({
  projectId,
  onFileSelect,
  onDirectorySelect,
  className,
}) => {
  const { i18n } = useLingui();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<FileSearchResultsRef>(null);

  // Show results when input is focused and has content
  const isOpen = isFocused && searchQuery.length > 0;

  // Handle entry selection
  const handleSelect = useCallback(
    (entry: FileSearchEntry) => {
      if (entry.type === "directory") {
        // For directories, navigate into them (update search query)
        setSearchQuery(`${entry.path}/`);
        // Also notify parent to expand the directory in tree
        onDirectorySelect?.(entry.path);
      } else {
        // For files and select-folder, select and clear
        onFileSelect(entry.path);
        setSearchQuery("");
        inputRef.current?.blur();
      }
    },
    [onFileSelect, onDirectorySelect],
  );

  // Handle dismiss (Escape)
  const handleDismiss = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.blur();
  }, []);

  // Handle keyboard events on input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Let FileSearchResults handle navigation keys
      if (searchResultsRef.current?.handleKeyDown(e)) {
        return;
      }

      // Handle Escape when no results
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    },
    [handleDismiss],
  );

  // Clear button handler
  const handleClear = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Search input */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={i18n._("Search files...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay blur to allow click on results
            setTimeout(() => setIsFocused(false), 150);
          }}
          className="pl-8 pr-8 h-8 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={i18n._("Clear search")}
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      <FileSearchResults
        ref={searchResultsRef}
        projectId={projectId}
        searchQuery={searchQuery}
        onSelect={handleSelect}
        onDismiss={handleDismiss}
        isOpen={isOpen}
        maxHeight="16rem"
        className="absolute top-full left-0 right-0 mt-1 z-50"
      />
    </div>
  );
};

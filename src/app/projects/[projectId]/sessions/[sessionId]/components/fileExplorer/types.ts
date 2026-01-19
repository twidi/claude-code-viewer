/**
 * View options for the file content viewer.
 * These control how the file content is displayed.
 */
export interface FileViewOptions {
  /** Enable text wrapping (line breaks at viewport edge) */
  wrap: boolean;
  /** Enable syntax highlighting */
  highlight: boolean;
}

/**
 * Default view options for file content viewing.
 * Wrap is enabled by default for readability.
 * Highlighting is disabled by default for performance.
 */
export const DEFAULT_FILE_VIEW_OPTIONS: FileViewOptions = {
  wrap: true,
  highlight: false,
};

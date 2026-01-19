import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

/**
 * Maximum file size for content reading (1MB)
 */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Response type for successful file content retrieval
 */
export interface FileContentResponse {
  content: string;
  encoding: "utf-8" | "base64";
  mimeType: string;
  size: number;
  fileType: "text" | "image" | "binary";
}

/**
 * Error types for file content retrieval
 */
export type FileContentErrorType =
  | "path_traversal"
  | "not_found"
  | "not_file"
  | "read_error";

/**
 * Error response type
 */
export interface FileContentError {
  type: "error";
  error: FileContentErrorType;
  message: string;
}

/**
 * Success response type
 */
export interface FileContentSuccess {
  type: "success";
  data: FileContentResponse;
}

/**
 * Union type for getFileContent result
 */
export type FileContentResult = FileContentSuccess | FileContentError;

/**
 * MIME type mapping for common file extensions
 */
const MIME_TYPE_MAP: Record<string, string> = {
  // Text files
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  js: "application/javascript",
  mjs: "application/javascript",
  cjs: "application/javascript",
  ts: "application/typescript",
  tsx: "application/typescript",
  jsx: "application/javascript",
  css: "text/css",
  scss: "text/x-scss",
  sass: "text/x-sass",
  less: "text/x-less",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
  svg: "image/svg+xml",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  toml: "application/toml",
  ini: "text/plain",
  conf: "text/plain",
  cfg: "text/plain",
  sh: "application/x-sh",
  bash: "application/x-sh",
  zsh: "application/x-sh",
  fish: "application/x-sh",
  py: "text/x-python",
  rb: "text/x-ruby",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  kts: "text/x-kotlin",
  scala: "text/x-scala",
  c: "text/x-c",
  cpp: "text/x-c++",
  cc: "text/x-c++",
  cxx: "text/x-c++",
  h: "text/x-c",
  hpp: "text/x-c++",
  hxx: "text/x-c++",
  cs: "text/x-csharp",
  swift: "text/x-swift",
  php: "text/x-php",
  pl: "text/x-perl",
  pm: "text/x-perl",
  lua: "text/x-lua",
  r: "text/x-r",
  sql: "application/sql",
  graphql: "application/graphql",
  gql: "application/graphql",
  vue: "text/x-vue",
  svelte: "text/x-svelte",
  astro: "text/x-astro",
  env: "text/plain",
  gitignore: "text/plain",
  dockerignore: "text/plain",
  editorconfig: "text/plain",
  dockerfile: "text/plain",
  makefile: "text/plain",
  cmake: "text/plain",
  lock: "text/plain",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",

  // Binary/Other
  pdf: "application/pdf",
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  wasm: "application/wasm",
};

/**
 * Extensions that should be treated as text files
 */
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "cfg",
  "sh",
  "bash",
  "zsh",
  "fish",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "kts",
  "scala",
  "c",
  "cpp",
  "cc",
  "cxx",
  "h",
  "hpp",
  "hxx",
  "cs",
  "swift",
  "php",
  "pl",
  "pm",
  "lua",
  "r",
  "sql",
  "graphql",
  "gql",
  "vue",
  "svelte",
  "astro",
  "env",
  "gitignore",
  "dockerignore",
  "editorconfig",
  "dockerfile",
  "makefile",
  "cmake",
  "lock",
]);

/**
 * Extensions that should be treated as image files
 */
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "tiff",
  "tif",
  "avif",
  "svg",
]);

/**
 * Get the MIME type from a file path based on its extension
 *
 * @param filePath - The file path to analyze
 * @returns The MIME type string
 */
export const getMimeTypeFromPath = (filePath: string): string => {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPE_MAP[extension] ?? "application/octet-stream";
};

/**
 * Determine the file type category based on extension
 *
 * @param filePath - The file path to analyze
 * @returns The file type: "text", "image", or "binary"
 */
const getFileTypeFromPath = (filePath: string): "text" | "image" | "binary" => {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "binary";
};

/**
 * Validate that the file path does not escape the project directory
 *
 * @param projectPath - The project root path
 * @param filePath - The relative file path
 * @param pathService - The Effect Path service
 * @returns true if the path is valid, false if it escapes
 */
const isPathWithinProject = (
  projectPath: string,
  filePath: string,
  pathService: Path.Path,
): boolean => {
  // Normalize the file path to prevent directory traversal
  const normalizedFilePath = filePath.startsWith("/")
    ? filePath.slice(1)
    : filePath;

  // Resolve the full path
  const fullPath = pathService.resolve(projectPath, normalizedFilePath);
  const resolvedProjectPath = pathService.resolve(projectPath);

  // Check if the resolved path is within the project directory
  // Must use path separator to prevent sibling directory attacks
  // e.g., "/project/root-admin" should NOT be considered within "/project/root"
  return (
    fullPath === resolvedProjectPath ||
    fullPath.startsWith(resolvedProjectPath + pathService.sep)
  );
};

/**
 * Read file content from the project directory
 *
 * This function reads file content with the following behavior:
 * - Validates path traversal attempts
 * - Detects MIME type from file extension
 * - Text files (< 1MB): read as UTF-8
 * - Images: read as base64
 * - Binary or files > 1MB: return metadata only
 *
 * @param projectPath - The absolute path to the project directory
 * @param filePath - The relative path to the file within the project
 * @returns Effect that yields FileContentResult
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   getFileContent("/path/to/project", "src/file.ts")
 *     .pipe(Effect.provide(FileSystem.layer), Effect.provide(Path.layer))
 * );
 * ```
 */
export const getFileContent = (
  projectPath: string,
  filePath: string,
): Effect.Effect<FileContentResult, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    // Validate path traversal
    if (!isPathWithinProject(projectPath, filePath, pathService)) {
      return {
        type: "error",
        error: "path_traversal",
        message: "Invalid path: outside project directory",
      } satisfies FileContentError;
    }

    // Normalize and resolve the full path
    const normalizedFilePath = filePath.startsWith("/")
      ? filePath.slice(1)
      : filePath;
    const fullPath = pathService.resolve(projectPath, normalizedFilePath);

    // Get file stats
    const statResult = yield* fs.stat(fullPath).pipe(
      Effect.map((info) => ({ success: true, info }) as const),
      Effect.catchAll(() =>
        Effect.succeed({ success: false, error: "not_found" } as const),
      ),
    );

    if (!statResult.success) {
      return {
        type: "error",
        error: "not_found",
        message: "File not found",
      } satisfies FileContentError;
    }

    const stat = statResult.info;

    // Check if it's a file
    if (stat.type !== "File") {
      return {
        type: "error",
        error: "not_file",
        message: "Path is not a file",
      } satisfies FileContentError;
    }

    // Convert branded Size to number
    const fileSize = Number(stat.size);
    const mimeType = getMimeTypeFromPath(fullPath);
    const fileType = getFileTypeFromPath(fullPath);

    // Handle binary files or files > 1MB - return metadata only
    if (fileType === "binary" || fileSize > MAX_FILE_SIZE) {
      return {
        type: "success",
        data: {
          content: "",
          encoding: "utf-8",
          mimeType,
          size: fileSize,
          fileType: "binary",
        },
      } satisfies FileContentSuccess;
    }

    // Read file content
    const readResult = yield* fs.readFile(fullPath).pipe(
      Effect.map((bytes) => ({ success: true, bytes }) as const),
      Effect.catchAll(() =>
        Effect.succeed({ success: false, error: "read_error" } as const),
      ),
    );

    if (!readResult.success) {
      return {
        type: "error",
        error: "read_error",
        message: "Failed to read file",
      } satisfies FileContentError;
    }

    const fileBytes = readResult.bytes;

    // Handle image files - return as base64
    if (fileType === "image") {
      const base64Content = Buffer.from(fileBytes).toString("base64");
      return {
        type: "success",
        data: {
          content: base64Content,
          encoding: "base64",
          mimeType,
          size: fileSize,
          fileType: "image",
        },
      } satisfies FileContentSuccess;
    }

    // Handle text files - return as UTF-8
    const textContent = new TextDecoder("utf-8").decode(fileBytes);
    return {
      type: "success",
      data: {
        content: textContent,
        encoding: "utf-8",
        mimeType,
        size: fileSize,
        fileType: "text",
      },
    } satisfies FileContentSuccess;
  });

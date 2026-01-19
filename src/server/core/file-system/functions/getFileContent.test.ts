import { FileSystem, Path } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { Effect, type Layer, Option } from "effect";
import { describe, expect, test } from "vitest";
import { getFileContent, getMimeTypeFromPath } from "./getFileContent";

/**
 * Helper function to create a FileSystem mock layer
 */
const makeFileSystemMock = (
  overrides: Partial<FileSystem.FileSystem>,
): Layer.Layer<FileSystem.FileSystem> => {
  return FileSystem.layerNoop(overrides);
};

/**
 * Helper function to create a Path mock layer
 */
const makePathMock = (): Layer.Layer<Path.Path> => {
  return Path.layer;
};

/**
 * Helper function to create a valid FileSystem.File.Info object
 */
const makeFileInfo = (
  size: number,
  type: "File" | "Directory" = "File",
): FileSystem.File.Info => ({
  type,
  size: FileSystem.Size(BigInt(size)),
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  blksize: Option.none(),
  blocks: Option.none(),
});

describe("getMimeTypeFromPath", () => {
  test("returns correct MIME type for text files", () => {
    expect(getMimeTypeFromPath("/path/to/file.txt")).toBe("text/plain");
    expect(getMimeTypeFromPath("/path/to/file.md")).toBe("text/markdown");
    expect(getMimeTypeFromPath("/path/to/file.json")).toBe("application/json");
    expect(getMimeTypeFromPath("/path/to/file.js")).toBe(
      "application/javascript",
    );
    expect(getMimeTypeFromPath("/path/to/file.ts")).toBe(
      "application/typescript",
    );
    expect(getMimeTypeFromPath("/path/to/file.tsx")).toBe(
      "application/typescript",
    );
    expect(getMimeTypeFromPath("/path/to/file.css")).toBe("text/css");
    expect(getMimeTypeFromPath("/path/to/file.html")).toBe("text/html");
    expect(getMimeTypeFromPath("/path/to/file.xml")).toBe("application/xml");
    expect(getMimeTypeFromPath("/path/to/file.yaml")).toBe(
      "application/x-yaml",
    );
    expect(getMimeTypeFromPath("/path/to/file.yml")).toBe("application/x-yaml");
    expect(getMimeTypeFromPath("/path/to/file.sh")).toBe("application/x-sh");
  });

  test("returns correct MIME type for image files", () => {
    expect(getMimeTypeFromPath("/path/to/image.png")).toBe("image/png");
    expect(getMimeTypeFromPath("/path/to/image.jpg")).toBe("image/jpeg");
    expect(getMimeTypeFromPath("/path/to/image.jpeg")).toBe("image/jpeg");
    expect(getMimeTypeFromPath("/path/to/image.gif")).toBe("image/gif");
    expect(getMimeTypeFromPath("/path/to/image.webp")).toBe("image/webp");
    expect(getMimeTypeFromPath("/path/to/image.svg")).toBe("image/svg+xml");
    expect(getMimeTypeFromPath("/path/to/image.ico")).toBe("image/x-icon");
  });

  test("returns application/octet-stream for unknown extensions", () => {
    expect(getMimeTypeFromPath("/path/to/file.unknown")).toBe(
      "application/octet-stream",
    );
    expect(getMimeTypeFromPath("/path/to/file.bin")).toBe(
      "application/octet-stream",
    );
    expect(getMimeTypeFromPath("/path/to/file")).toBe(
      "application/octet-stream",
    );
  });
});

describe("getFileContent", () => {
  describe("path traversal validation", () => {
    test("returns error when filePath tries to escape project directory with ../", async () => {
      const FileSystemMock = makeFileSystemMock({});
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "../../../etc/passwd").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toBe("path_traversal");
        expect(result.message).toBe("Invalid path: outside project directory");
      }
    });

    test("returns error when resolved path escapes project directory", async () => {
      const FileSystemMock = makeFileSystemMock({});
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "subdir/../../other/file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toBe("path_traversal");
      }
    });

    test("returns error for sibling directory with similar prefix (path traversal attack)", async () => {
      // This tests against sibling directory attacks where:
      // projectPath = "/project/root"
      // filePath resolves to "/project/root-admin/secrets.txt"
      // Without proper path separator check, this would pass startsWith("/project/root")
      const FileSystemMock = makeFileSystemMock({});
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "../root-admin/secrets.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toBe("path_traversal");
        expect(result.message).toBe("Invalid path: outside project directory");
      }
    });

    test("allows valid paths within project directory", async () => {
      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(100)),
        readFile: () =>
          Effect.succeed(new TextEncoder().encode("file content")),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "src/file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
    });
  });

  describe("file not found", () => {
    test("returns not_found error when file does not exist", async () => {
      const FileSystemMock = makeFileSystemMock({
        stat: (path: string) =>
          Effect.fail(
            new SystemError({
              module: "FileSystem",
              method: "stat",
              pathOrDescriptor: path,
              reason: "NotFound",
              description: "File not found",
            }),
          ),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "nonexistent.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toBe("not_found");
        expect(result.message).toBe("File not found");
      }
    });
  });

  describe("text file handling", () => {
    test("reads text file as UTF-8 when size < 1MB", async () => {
      const content = "Hello, World!";
      const contentBytes = new TextEncoder().encode(content);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(contentBytes.length)),
        readFile: () => Effect.succeed(contentBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe(content);
        expect(result.data.encoding).toBe("utf-8");
        expect(result.data.mimeType).toBe("text/plain");
        expect(result.data.fileType).toBe("text");
        expect(result.data.size).toBe(contentBytes.length);
      }
    });

    test("handles TypeScript files correctly", async () => {
      const content = 'const x: string = "hello";';
      const contentBytes = new TextEncoder().encode(content);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(contentBytes.length)),
        readFile: () => Effect.succeed(contentBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "src/index.ts").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe(content);
        expect(result.data.mimeType).toBe("application/typescript");
        expect(result.data.fileType).toBe("text");
      }
    });
  });

  describe("image file handling", () => {
    test("reads image file as base64", async () => {
      // Minimal valid PNG header bytes
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(pngBytes.length)),
        readFile: () => Effect.succeed(pngBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "images/logo.png").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // Verify base64 encoding
        const expectedBase64 = Buffer.from(pngBytes).toString("base64");
        expect(result.data.content).toBe(expectedBase64);
        expect(result.data.encoding).toBe("base64");
        expect(result.data.mimeType).toBe("image/png");
        expect(result.data.fileType).toBe("image");
        expect(result.data.size).toBe(pngBytes.length);
      }
    });

    test("handles JPEG files correctly", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(jpegBytes.length)),
        readFile: () => Effect.succeed(jpegBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "photo.jpg").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.encoding).toBe("base64");
        expect(result.data.mimeType).toBe("image/jpeg");
        expect(result.data.fileType).toBe("image");
      }
    });
  });

  describe("binary file handling", () => {
    test("returns metadata only for binary files", async () => {
      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(1024)),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "program.exe").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe("");
        expect(result.data.encoding).toBe("utf-8");
        expect(result.data.mimeType).toBe("application/octet-stream");
        expect(result.data.fileType).toBe("binary");
        expect(result.data.size).toBe(1024);
      }
    });
  });

  describe("large file handling", () => {
    test("returns metadata only for files > 1MB", async () => {
      const largeFileSize = 1024 * 1024 + 1; // 1MB + 1 byte

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(largeFileSize)),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "large-file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe("");
        expect(result.data.fileType).toBe("binary");
        expect(result.data.size).toBe(largeFileSize);
      }
    });

    test("reads text file at exactly 1MB boundary", async () => {
      const exactlyOneMB = 1024 * 1024;
      const content = "x".repeat(100); // We'll mock the file size separately
      const contentBytes = new TextEncoder().encode(content);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(exactlyOneMB)),
        readFile: () => Effect.succeed(contentBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // At exactly 1MB, file should still be readable
        expect(result.data.fileType).toBe("text");
        expect(result.data.encoding).toBe("utf-8");
      }
    });
  });

  describe("edge cases", () => {
    test("handles file paths with leading slash", async () => {
      const content = "content";
      const contentBytes = new TextEncoder().encode(content);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(contentBytes.length)),
        readFile: () => Effect.succeed(contentBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "/src/file.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
    });

    test("handles empty file", async () => {
      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(0)),
        readFile: () => Effect.succeed(new Uint8Array(0)),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "empty.txt").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe("");
        expect(result.data.size).toBe(0);
        expect(result.data.fileType).toBe("text");
      }
    });

    test("handles nested directory paths correctly", async () => {
      const content = "nested content";
      const contentBytes = new TextEncoder().encode(content);

      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(contentBytes.length)),
        readFile: () => Effect.succeed(contentBytes),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent(
          "/project/root",
          "src/components/deep/nested/Component.tsx",
        ).pipe(Effect.provide(FileSystemMock), Effect.provide(PathMock)),
      );

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.data.content).toBe(content);
        expect(result.data.mimeType).toBe("application/typescript");
      }
    });

    test("returns error when trying to read a directory", async () => {
      const FileSystemMock = makeFileSystemMock({
        stat: () => Effect.succeed(makeFileInfo(4096, "Directory")),
      });
      const PathMock = makePathMock();

      const result = await Effect.runPromise(
        getFileContent("/project/root", "some-directory").pipe(
          Effect.provide(FileSystemMock),
          Effect.provide(PathMock),
        ),
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toBe("not_file");
        expect(result.message).toBe("Path is not a file");
      }
    });
  });
});

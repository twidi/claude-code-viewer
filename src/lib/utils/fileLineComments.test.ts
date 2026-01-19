import { describe, expect, test } from "vitest";
import {
  createFileLineCommentKey,
  type FileLineCommentFormatData,
  formatFileLineComment,
  formatFileLineComments,
  getLangFromFilePath,
  LANG_BY_EXTENSION,
} from "./fileLineComments";

describe("LANG_BY_EXTENSION", () => {
  test("contains common language mappings", () => {
    expect(LANG_BY_EXTENSION.ts).toBe("typescript");
    expect(LANG_BY_EXTENSION.tsx).toBe("typescript");
    expect(LANG_BY_EXTENSION.js).toBe("javascript");
    expect(LANG_BY_EXTENSION.jsx).toBe("javascript");
    expect(LANG_BY_EXTENSION.py).toBe("python");
    expect(LANG_BY_EXTENSION.go).toBe("go");
    expect(LANG_BY_EXTENSION.rs).toBe("rust");
    expect(LANG_BY_EXTENSION.md).toBe("markdown");
  });

  test("maps header file extensions correctly", () => {
    expect(LANG_BY_EXTENSION.h).toBe("c");
    expect(LANG_BY_EXTENSION.hpp).toBe("cpp");
    expect(LANG_BY_EXTENSION.c).toBe("c");
    expect(LANG_BY_EXTENSION.cpp).toBe("cpp");
  });

  test("handles yaml variations", () => {
    expect(LANG_BY_EXTENSION.yaml).toBe("yaml");
    expect(LANG_BY_EXTENSION.yml).toBe("yaml");
  });
});

describe("getLangFromFilePath", () => {
  test("returns language for known extensions", () => {
    expect(getLangFromFilePath("src/index.ts")).toBe("typescript");
    expect(getLangFromFilePath("src/App.tsx")).toBe("typescript");
    expect(getLangFromFilePath("script.js")).toBe("javascript");
    expect(getLangFromFilePath("component.jsx")).toBe("javascript");
    expect(getLangFromFilePath("main.py")).toBe("python");
    expect(getLangFromFilePath("README.md")).toBe("markdown");
    expect(getLangFromFilePath("config.json")).toBe("json");
  });

  test("returns default fallback for unknown extensions", () => {
    expect(getLangFromFilePath("file.unknown")).toBe("");
    expect(getLangFromFilePath("file.xyz")).toBe("");
    expect(getLangFromFilePath("Makefile")).toBe("");
  });

  test("returns custom fallback for unknown extensions when provided", () => {
    expect(getLangFromFilePath("file.unknown", "text")).toBe("text");
    expect(getLangFromFilePath("Makefile", "makefile")).toBe("makefile");
  });

  test("handles files with multiple dots", () => {
    expect(getLangFromFilePath("file.test.ts")).toBe("typescript");
    expect(getLangFromFilePath("my.component.tsx")).toBe("typescript");
    expect(getLangFromFilePath("styles.module.css")).toBe("css");
  });

  test("handles case-insensitive extensions", () => {
    expect(getLangFromFilePath("FILE.TS")).toBe("typescript");
    expect(getLangFromFilePath("FILE.Py")).toBe("python");
    expect(getLangFromFilePath("file.JSON")).toBe("json");
  });

  test("handles paths with directories", () => {
    expect(getLangFromFilePath("/home/user/project/src/index.ts")).toBe(
      "typescript",
    );
    expect(getLangFromFilePath("./relative/path/file.py")).toBe("python");
    expect(getLangFromFilePath("C:\\Windows\\path\\file.js")).toBe(
      "javascript",
    );
  });

  test("handles empty string", () => {
    expect(getLangFromFilePath("")).toBe("");
    expect(getLangFromFilePath("", "text")).toBe("text");
  });

  test("handles files without extension", () => {
    expect(getLangFromFilePath("Dockerfile")).toBe("");
    expect(getLangFromFilePath(".gitignore")).toBe("");
    expect(getLangFromFilePath("LICENSE")).toBe("");
  });
});

describe("createFileLineCommentKey", () => {
  test("creates key with format filePath:lineNumber:side", () => {
    expect(createFileLineCommentKey("src/index.ts", 10, "new")).toBe(
      "src/index.ts:10:new",
    );
    expect(createFileLineCommentKey("src/index.ts", 10, "old")).toBe(
      "src/index.ts:10:old",
    );
  });

  test("handles paths with special characters", () => {
    expect(createFileLineCommentKey("path/to/my-file.ts", 5, "new")).toBe(
      "path/to/my-file.ts:5:new",
    );
    expect(createFileLineCommentKey("path with spaces/file.ts", 1, "old")).toBe(
      "path with spaces/file.ts:1:old",
    );
  });

  test("handles line number 0", () => {
    expect(createFileLineCommentKey("file.ts", 0, "new")).toBe("file.ts:0:new");
  });

  test("handles large line numbers", () => {
    expect(createFileLineCommentKey("file.ts", 99999, "new")).toBe(
      "file.ts:99999:new",
    );
  });
});

describe("formatFileLineComment", () => {
  test("formats comment with code block and language", () => {
    const data: FileLineCommentFormatData = {
      filePath: "src/index.ts",
      lineNumber: 10,
      lineContent: "const x = 1;",
      comment: "This is a comment",
    };

    const result = formatFileLineComment(data);

    expect(result).toBe(`---

src/index.ts:10
\`\`\`typescript
const x = 1;
\`\`\`

This is a comment`);
  });

  test("formats comment without user comment text", () => {
    const data: FileLineCommentFormatData = {
      filePath: "src/index.ts",
      lineNumber: 10,
      lineContent: "const x = 1;",
      comment: "",
    };

    const result = formatFileLineComment(data);

    expect(result).toBe(`---

src/index.ts:10
\`\`\`typescript
const x = 1;
\`\`\``);
  });

  test("trims trailing whitespace from line content", () => {
    const data: FileLineCommentFormatData = {
      filePath: "file.js",
      lineNumber: 5,
      lineContent: "const y = 2;   \t",
      comment: "Note",
    };

    const result = formatFileLineComment(data);

    expect(result).toContain("const y = 2;");
    expect(result).not.toContain("const y = 2;   ");
  });

  test("handles multiline user comments", () => {
    const data: FileLineCommentFormatData = {
      filePath: "file.py",
      lineNumber: 1,
      lineContent: "def foo():",
      comment: "Line 1\nLine 2\nLine 3",
    };

    const result = formatFileLineComment(data);

    expect(result).toContain("Line 1\nLine 2\nLine 3");
  });

  test("uses empty string for unknown extensions", () => {
    const data: FileLineCommentFormatData = {
      filePath: "Makefile",
      lineNumber: 1,
      lineContent: "all: build",
      comment: "Build target",
    };

    const result = formatFileLineComment(data);

    expect(result).toContain("```\n");
    expect(result).not.toContain("```text");
  });

  test("preserves leading whitespace in line content", () => {
    const data: FileLineCommentFormatData = {
      filePath: "file.ts",
      lineNumber: 10,
      lineContent: "    return value;",
      comment: "Indented line",
    };

    const result = formatFileLineComment(data);

    expect(result).toContain("    return value;");
  });
});

describe("formatFileLineComments", () => {
  test("formats multiple comments separated by double newlines", () => {
    const comments: FileLineCommentFormatData[] = [
      {
        filePath: "file1.ts",
        lineNumber: 1,
        lineContent: "line 1",
        comment: "Comment 1",
      },
      {
        filePath: "file2.ts",
        lineNumber: 2,
        lineContent: "line 2",
        comment: "Comment 2",
      },
    ];

    const result = formatFileLineComments(comments);

    expect(result).toContain("Comment 1");
    expect(result).toContain("Comment 2");
    expect(result.split("\n\n---").length).toBe(2);
  });

  test("filters out comments with empty text by default", () => {
    const comments: FileLineCommentFormatData[] = [
      {
        filePath: "file1.ts",
        lineNumber: 1,
        lineContent: "line 1",
        comment: "Has content",
      },
      {
        filePath: "file2.ts",
        lineNumber: 2,
        lineContent: "line 2",
        comment: "",
      },
      {
        filePath: "file3.ts",
        lineNumber: 3,
        lineContent: "line 3",
        comment: "   ",
      },
    ];

    const result = formatFileLineComments(comments);

    expect(result).toContain("Has content");
    expect(result).not.toContain("file2.ts:2");
    expect(result).not.toContain("file3.ts:3");
  });

  test("uses custom hasContent filter when provided", () => {
    const comments: FileLineCommentFormatData[] = [
      {
        filePath: "file1.ts",
        lineNumber: 1,
        lineContent: "line 1",
        comment: "",
      },
      {
        filePath: "file2.ts",
        lineNumber: 2,
        lineContent: "line 2",
        comment: "",
      },
    ];

    // Custom filter that includes all comments
    const result = formatFileLineComments(comments, () => true);

    expect(result).toContain("file1.ts:1");
    expect(result).toContain("file2.ts:2");
  });

  test("returns empty string for empty array", () => {
    const result = formatFileLineComments([]);

    expect(result).toBe("");
  });

  test("returns empty string when all comments are filtered out", () => {
    const comments: FileLineCommentFormatData[] = [
      {
        filePath: "file1.ts",
        lineNumber: 1,
        lineContent: "line 1",
        comment: "",
      },
      {
        filePath: "file2.ts",
        lineNumber: 2,
        lineContent: "line 2",
        comment: "  ",
      },
    ];

    const result = formatFileLineComments(comments);

    expect(result).toBe("");
  });

  test("handles single comment", () => {
    const comments: FileLineCommentFormatData[] = [
      {
        filePath: "file.ts",
        lineNumber: 5,
        lineContent: "const x = 1;",
        comment: "Single comment",
      },
    ];

    const result = formatFileLineComments(comments);

    expect(result).toContain("Single comment");
    expect(result.startsWith("---")).toBe(true);
  });
});

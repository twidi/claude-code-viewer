import { describe, expect, test } from "vitest";
import { generatePseudoDiff } from "./pseudoDiff";

describe("generatePseudoDiff", () => {
  describe("required headers", () => {
    test("generates diff with all required git headers", () => {
      const content = "const x = 1;";
      const fileName = "src/file.ts";

      const result = generatePseudoDiff(content, fileName);

      // Check all required headers are present
      expect(result).toContain("diff --git a/src/file.ts b/src/file.ts");
      expect(result).toContain("new file mode 100644");
      expect(result).toContain("--- /dev/null");
      expect(result).toContain("+++ b/src/file.ts");
      expect(result).toContain("@@ -0,0 +1,1 @@");
    });

    test("headers appear in correct order", () => {
      const content = "line1";
      const fileName = "test.js";

      const result = generatePseudoDiff(content, fileName);
      const lines = result.split("\n");

      expect(lines[0]).toBe("diff --git a/test.js b/test.js");
      expect(lines[1]).toBe("new file mode 100644");
      expect(lines[2]).toBe("--- /dev/null");
      expect(lines[3]).toBe("+++ b/test.js");
      expect(lines[4]).toMatch(/^@@ -0,0 \+1,\d+ @@$/);
      expect(lines[5]).toBe("+line1");
    });
  });

  describe("basic content handling", () => {
    test("handles single line content", () => {
      const content = "console.log('hello');";
      const fileName = "hello.js";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain("@@ -0,0 +1,1 @@");
      expect(result).toContain("+console.log('hello');");
    });

    test("handles multiple lines content", () => {
      const content = "const x = 1;\nconst y = 2;\nreturn x + y;";
      const fileName = "math.ts";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain("@@ -0,0 +1,3 @@");
      expect(result).toContain("+const x = 1;");
      expect(result).toContain("+const y = 2;");
      expect(result).toContain("+return x + y;");
    });

    test("prefixes each line with + symbol", () => {
      const content = "line1\nline2\nline3";
      const fileName = "lines.txt";

      const result = generatePseudoDiff(content, fileName);
      const lines = result.split("\n");

      // Lines after the hunk header should be prefixed with +
      const contentLines = lines.slice(5); // Skip headers
      expect(contentLines[0]).toBe("+line1");
      expect(contentLines[1]).toBe("+line2");
      expect(contentLines[2]).toBe("+line3");
    });
  });

  describe("empty content", () => {
    test("handles empty string content", () => {
      const content = "";
      const fileName = "empty.txt";

      const result = generatePseudoDiff(content, fileName);

      // Empty string still creates one "line" when split by \n
      expect(result).toContain("@@ -0,0 +1,1 @@");
      expect(result).toContain("diff --git a/empty.txt b/empty.txt");
      expect(result).toContain("--- /dev/null");
      expect(result).toContain("+++ b/empty.txt");

      // The empty content becomes a single "+" line
      const lines = result.split("\n");
      expect(lines[lines.length - 1]).toBe("+");
    });
  });

  describe("trailing newline handling", () => {
    test("handles content with trailing newline", () => {
      const content = "line1\nline2\n";
      const fileName = "trailing.txt";

      const result = generatePseudoDiff(content, fileName);

      // Content with trailing newline splits into 3 elements: ["line1", "line2", ""]
      expect(result).toContain("@@ -0,0 +1,3 @@");
      expect(result).toContain("+line1");
      expect(result).toContain("+line2");

      const lines = result.split("\n");
      // Last line should be "+" (from the empty string after trailing newline)
      expect(lines[lines.length - 1]).toBe("+");
    });

    test("handles content with multiple trailing newlines", () => {
      const content = "line1\n\n";
      const fileName = "multi-trailing.txt";

      const result = generatePseudoDiff(content, fileName);

      // Splits into ["line1", "", ""]
      expect(result).toContain("@@ -0,0 +1,3 @@");
    });

    test("handles content with no trailing newline", () => {
      const content = "line1\nline2";
      const fileName = "no-trailing.txt";

      const result = generatePseudoDiff(content, fileName);

      // Splits into ["line1", "line2"]
      expect(result).toContain("@@ -0,0 +1,2 @@");
    });
  });

  describe("special characters", () => {
    test("handles content with special regex characters", () => {
      const content = "const regex = /^test.*$/;";
      const fileName = "regex.ts";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain("+const regex = /^test.*$/;");
    });

    test("handles content with unicode characters", () => {
      const content = "const greeting = '你好世界 👋';";
      const fileName = "unicode.ts";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain("+const greeting = '你好世界 👋';");
    });

    test("handles content with HTML/JSX special characters", () => {
      const content = '<div className="test">&lt;Hello&gt;</div>';
      const fileName = "component.tsx";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain('+<div className="test">&lt;Hello&gt;</div>');
    });

    test("handles content with tab characters", () => {
      const content = "\tindented\n\t\tdouble";
      const fileName = "tabs.txt";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain("+\tindented");
      expect(result).toContain("+\t\tdouble");
    });

    test("handles content with carriage return characters", () => {
      const content = "line1\r\nline2";
      const fileName = "crlf.txt";

      const result = generatePseudoDiff(content, fileName);

      // \r is preserved since we only split on \n
      expect(result).toContain("+line1\r");
      expect(result).toContain("+line2");
    });

    test("handles filename with special path characters", () => {
      const content = "content";
      const fileName = "path/to/my-file_v2.spec.ts";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain(
        "diff --git a/path/to/my-file_v2.spec.ts b/path/to/my-file_v2.spec.ts",
      );
      expect(result).toContain("+++ b/path/to/my-file_v2.spec.ts");
    });

    test("handles filename with spaces", () => {
      const content = "content";
      const fileName = "my file name.txt";

      const result = generatePseudoDiff(content, fileName);

      expect(result).toContain(
        "diff --git a/my file name.txt b/my file name.txt",
      );
      expect(result).toContain("+++ b/my file name.txt");
    });
  });

  describe("line count accuracy", () => {
    test("hunk header shows correct line count for various sizes", () => {
      const testCases = [
        { lines: 1, content: "a" },
        { lines: 5, content: "a\nb\nc\nd\ne" },
        { lines: 10, content: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10" },
        {
          lines: 100,
          content: Array.from({ length: 100 }, (_, i) => String(i + 1)).join(
            "\n",
          ),
        },
      ];

      for (const { lines, content } of testCases) {
        const result = generatePseudoDiff(content, "test.txt");
        expect(result).toContain(`@@ -0,0 +1,${lines} @@`);
      }
    });
  });
});

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export type FuzzySearchEntry = {
  name: string;
  type: "file" | "directory";
  path: string;
  score: number;
};

export type FuzzySearchResult = {
  entries: FuzzySearchEntry[];
  basePath: string;
  projectPath: string;
  query: string;
};

/**
 * Calculate a fuzzy match score between a query and a target string.
 * Returns 0 if no match, higher scores for better matches.
 * Scoring:
 * - Exact match: highest score
 * - Prefix match: high score
 * - Contains match: medium score
 * - Fuzzy character match: lower score based on gaps
 */
const calculateFuzzyScore = (query: string, target: string): number => {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (targetLower === queryLower) {
    return 1000;
  }

  // Prefix match
  if (targetLower.startsWith(queryLower)) {
    return 800 + (queryLower.length / targetLower.length) * 100;
  }

  // Contains match
  if (targetLower.includes(queryLower)) {
    const index = targetLower.indexOf(queryLower);
    return 500 + (1 - index / targetLower.length) * 100;
  }

  // Fuzzy character matching
  let queryIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;

  for (
    let i = 0;
    i < targetLower.length && queryIndex < queryLower.length;
    i++
  ) {
    if (targetLower[i] === queryLower[queryIndex]) {
      // Bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        consecutiveMatches++;
        score += 10 + consecutiveMatches * 5;
      } else {
        consecutiveMatches = 0;
        score += 10;
      }

      // Bonus for matching at word boundaries (after /, -, _, or uppercase)
      if (
        i === 0 ||
        "/\\-_.".includes(target[i - 1] ?? "") ||
        (target[i] !== undefined &&
          target[i] === target[i]?.toUpperCase() &&
          target[i] !== target[i]?.toLowerCase())
      ) {
        score += 15;
      }

      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // All query characters must be found
  if (queryIndex < queryLower.length) {
    return 0;
  }

  // Penalize based on target length (prefer shorter matches)
  score =
    score *
    (1 - (targetLower.length - queryLower.length) / (targetLower.length * 2));

  return Math.max(1, score);
};

/**
 * Recursively search for files matching a fuzzy query
 * @param projectPath - The root project path
 * @param basePath - The relative path from project root to start search
 * @param query - The fuzzy search query
 * @param limit - Maximum number of results to return
 * @returns Matching files and directories sorted by score
 */
export const fuzzySearchFiles = async (
  projectPath: string,
  basePath: string,
  query: string,
  limit = 10,
): Promise<FuzzySearchResult> => {
  // Normalize basePath
  const normalizedBasePath = basePath.startsWith("/")
    ? basePath.slice(1)
    : basePath;
  const targetPath = resolve(projectPath, normalizedBasePath);

  // Security check: ensure target path is within project directory
  if (!targetPath.startsWith(resolve(projectPath))) {
    throw new Error("Invalid path: outside project directory");
  }

  // Check if the target path exists
  if (!existsSync(targetPath)) {
    return {
      entries: [],
      basePath: normalizedBasePath,
      projectPath,
      query,
    };
  }

  const results: FuzzySearchEntry[] = [];
  const maxDepth = 10; // Prevent too deep recursion
  const maxFilesToScan = 5000; // Limit total files scanned for performance
  let filesScanned = 0;

  const searchRecursively = async (
    currentPath: string,
    relativePath: string,
    depth: number,
  ): Promise<void> => {
    if (depth > maxDepth || filesScanned >= maxFilesToScan) {
      return;
    }

    try {
      const dirents = await readdir(currentPath, { withFileTypes: true });

      for (const dirent of dirents) {
        if (filesScanned >= maxFilesToScan) {
          break;
        }

        // Skip hidden files and directories
        if (dirent.name.startsWith(".")) {
          continue;
        }

        // Skip common large directories
        if (
          dirent.isDirectory() &&
          [
            "node_modules",
            "dist",
            "build",
            ".git",
            "__pycache__",
            "vendor",
            "target",
          ].includes(dirent.name)
        ) {
          continue;
        }

        filesScanned++;

        const entryPath = join(relativePath, dirent.name);
        const fullPath = join(currentPath, dirent.name);

        // Calculate the search path relative to the base path
        // If basePath is "src/app/", and entryPath is "src/app/projects/foo.tsx"
        // then searchablePath should be "projects/foo.tsx"
        const searchablePath = normalizedBasePath
          ? entryPath.startsWith(normalizedBasePath)
            ? entryPath.slice(normalizedBasePath.length).replace(/^\//, "")
            : entryPath
          : entryPath;

        // Calculate score based on the full relative path (not just filename)
        const score = calculateFuzzyScore(query, searchablePath);

        if (score > 0) {
          results.push({
            name: dirent.name,
            type: dirent.isDirectory() ? "directory" : "file",
            path: entryPath,
            score,
          });
        }

        // Recurse into directories
        if (dirent.isDirectory()) {
          await searchRecursively(fullPath, entryPath, depth + 1);
        }
      }
    } catch {
      // Ignore permission errors and continue
    }
  };

  await searchRecursively(targetPath, normalizedBasePath, 0);

  // Sort by: directories first, then by score (descending), then by path length (shorter first), then alphabetically
  results.sort((a, b) => {
    // Directories come first
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    // Then by score (descending)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Then by path length (shorter paths first)
    if (a.path.length !== b.path.length) {
      return a.path.length - b.path.length;
    }
    // Finally alphabetically
    return a.path.localeCompare(b.path);
  });

  return {
    entries: results.slice(0, limit),
    basePath: normalizedBasePath,
    projectPath,
    query,
  };
};

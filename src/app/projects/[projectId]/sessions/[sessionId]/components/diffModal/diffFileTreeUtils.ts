import type { DiffFileSummary } from "./types";

/**
 * Represents a node in the diff file tree.
 * Can be either a directory (with children) or a file (with file data).
 */
export interface DiffTreeNode {
  /** Display name - may be combined path like "src/server" for collapsed directories */
  name: string;
  /** Full path from root */
  fullPath: string;
  /** Whether this is a directory or file */
  type: "directory" | "file";
  /** Child nodes (only for directories) */
  children: DiffTreeNode[];
  /** File data (only for files) */
  fileData?: DiffFileSummary;
}

/**
 * Internal node used during tree construction before collapsing.
 */
interface BuildNode {
  name: string;
  fullPath: string;
  children: Map<string, BuildNode>;
  fileData?: DiffFileSummary;
}

/**
 * Build a tree structure from a flat list of file paths.
 * This creates the full tree without any path collapsing.
 */
function buildRawTree(files: DiffFileSummary[]): BuildNode {
  const root: BuildNode = {
    name: "",
    fullPath: "",
    children: new Map(),
  };

  for (const file of files) {
    const parts = file.filePath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;

      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let child = current.children.get(part);
      if (!child) {
        child = {
          name: part,
          fullPath: currentPath,
          children: new Map(),
          fileData: isFile ? file : undefined,
        };
        current.children.set(part, child);
      } else if (isFile) {
        // Update existing node with file data
        child.fileData = file;
      }

      current = child;
    }
  }

  return root;
}

/**
 * Collapse single-child directory chains.
 * Example: if "src" only contains "server" which only contains "api",
 * collapse to a single node with name "src/server/api".
 */
function collapseNode(node: BuildNode): DiffTreeNode[] {
  const results: DiffTreeNode[] = [];

  for (const child of node.children.values()) {
    // If this is a file, add it directly
    if (child.fileData) {
      results.push({
        name: child.name,
        fullPath: child.fullPath,
        type: "file",
        children: [],
        fileData: child.fileData,
      });
      continue;
    }

    // This is a directory - check if we should collapse
    let current = child;
    let collapsedName = child.name;
    let collapsedPath = child.fullPath;

    // Keep collapsing while:
    // 1. Current node has exactly one child
    // 2. That child is a directory (not a file)
    while (current.children.size === 1) {
      const childrenArray = Array.from(current.children.values());
      const onlyChild = childrenArray[0];
      if (!onlyChild) break;

      // Stop if the only child is a file
      if (onlyChild.fileData) {
        break;
      }
      // Collapse: combine names
      collapsedName = `${collapsedName}/${onlyChild.name}`;
      collapsedPath = onlyChild.fullPath;
      current = onlyChild;
    }

    // Recursively process children of the (potentially collapsed) node
    const collapsedChildren = collapseNode(current);

    results.push({
      name: collapsedName,
      fullPath: collapsedPath,
      type: "directory",
      children: collapsedChildren,
    });
  }

  return results;
}

/**
 * Sort tree nodes: directories first, then files, both alphabetically.
 */
function sortNodes(nodes: DiffTreeNode[]): DiffTreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.type === "directory" ? sortNodes(node.children) : [],
    }))
    .sort((a, b) => {
      // Directories first
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      // Then alphabetically by name
      return a.name.localeCompare(b.name);
    });
}

/**
 * Build a collapsed, sorted tree from a list of diff files.
 *
 * This function:
 * 1. Builds a full tree from file paths
 * 2. Collapses single-child directory chains (e.g., src/server/api -> "src/server/api")
 * 3. Sorts directories before files, both alphabetically
 *
 * @param files - List of diff file summaries
 * @returns Array of root-level tree nodes
 */
export function buildDiffFileTree(files: DiffFileSummary[]): DiffTreeNode[] {
  if (files.length === 0) {
    return [];
  }

  const rawTree = buildRawTree(files);
  const collapsedTree = collapseNode(rawTree);
  return sortNodes(collapsedTree);
}

/**
 * Get all directory paths in the tree (for initializing expanded state).
 */
export function getAllDirectoryPaths(nodes: DiffTreeNode[]): Set<string> {
  const paths = new Set<string>();

  function traverse(nodeList: DiffTreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "directory") {
        paths.add(node.fullPath);
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return paths;
}

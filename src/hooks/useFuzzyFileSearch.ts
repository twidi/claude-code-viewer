import { useQuery } from "@tanstack/react-query";
import { fuzzySearchFilesQuery } from "../lib/api/queries";

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

export const useFuzzyFileSearch = (
  projectId: string,
  basePath: string,
  query: string,
  limit = 10,
  enabled = true,
) => {
  return useQuery({
    queryKey: fuzzySearchFilesQuery(projectId, basePath, query, limit).queryKey,
    queryFn: fuzzySearchFilesQuery(projectId, basePath, query, limit).queryFn,
    enabled: enabled && !!projectId && query.length > 0,
    staleTime: 1000 * 30, // 30 seconds cache for search results
  });
};

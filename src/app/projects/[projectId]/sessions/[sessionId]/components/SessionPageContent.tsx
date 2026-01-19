import type { FC } from "react";
import { useEffect, useState } from "react";
import { useBrowserPreview } from "@/hooks/useBrowserPreview";

import { SessionPageMainWrapper } from "./SessionPageMainWrapper";
import type { Tab } from "./sessionSidebar/schema";

export const SessionPageContent: FC<{
  projectId: string;
  sessionId?: string;
  tab: Tab;
}> = ({ projectId, sessionId, tab }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const { previewUrl, previewWidth } = useBrowserPreview();

  const mainContentWidth = previewUrl ? 100 - previewWidth : 100;

  // Open sidebar when tab changes via URL (e.g., clicking project badge)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally react to tab changes
  useEffect(() => {
    setIsMobileSidebarOpen(true);
  }, [tab]);

  // Handle mobile keyboard visibility using Visual Viewport API
  // Firefox Mobile scrolls the visual viewport when keyboard opens,
  // so we need to track both height and offset to position correctly
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateLayout = () => {
      // Only apply when keyboard is likely open
      // (visual viewport is significantly smaller than window height)
      const heightDiff = window.innerHeight - viewport.height;
      if (heightDiff > 100) {
        setViewportHeight(viewport.height + viewport.offsetTop);
      } else {
        setViewportHeight(null);
      }
    };

    viewport.addEventListener("resize", updateLayout);
    viewport.addEventListener("scroll", updateLayout);

    return () => {
      viewport.removeEventListener("resize", updateLayout);
      viewport.removeEventListener("scroll", updateLayout);
    };
  }, []);

  return (
    <div
      className="flex overflow-hidden transition-all duration-200"
      style={{
        width: `${mainContentWidth}%`,
        height: viewportHeight ? `${viewportHeight}px` : "100dvh",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100dvh",
      }}
    >
      <SessionPageMainWrapper
        projectId={projectId}
        sessionId={sessionId}
        tab={tab}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
      />
    </div>
  );
};

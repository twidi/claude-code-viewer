import type { FC } from "react";
import { useEffect, useState } from "react";

import { SessionPageMainWrapper } from "./SessionPageMainWrapper";
import type { Tab } from "./sessionSidebar/schema";

export const SessionPageContent: FC<{
  projectId: string;
  sessionId?: string;
  tab: Tab;
}> = ({ projectId, sessionId, tab }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Open sidebar when tab changes via URL (e.g., clicking project badge)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally react to tab changes
  useEffect(() => {
    setIsMobileSidebarOpen(true);
  }, [tab]);

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
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

import type { FC } from "react";
import { Suspense } from "react";
import { TerminalDialog } from "@/components/terminal/TerminalDialog";
import { DiffLineCommentProvider } from "@/contexts/DiffLineCommentContext";
import { FileExplorerCommentProvider } from "@/contexts/FileExplorerCommentContext";
import { PersistentDialogsProvider } from "@/contexts/PersistentDialogsContext";
import { TerminalCommentProvider } from "@/contexts/TerminalCommentContext";
import { Loading } from "../../../../../../components/Loading";
import { useProject } from "../../../hooks/useProject";
import { useGitCurrentRevisions } from "../hooks/useGit";
import { DiffModal } from "./diffModal";
import { FileExplorerDialog } from "./fileExplorer/FileExplorerDialog";
import { SessionPageMain } from "./SessionPageMain";
import { SessionSidebar } from "./sessionSidebar/SessionSidebar";
import type { Tab } from "./sessionSidebar/schema";

export const SessionPageMainWrapper: FC<{
  projectId: string;
  sessionId?: string;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  tab: Tab;
}> = ({
  projectId,
  sessionId,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  tab,
}) => {
  const { data: projectData } = useProject(projectId);
  const { data: revisionsData } = useGitCurrentRevisions(projectId);
  const firstPage = projectData.pages[0];
  if (firstPage === undefined) {
    return null;
  }
  const project = firstPage.project;

  const projectPath = project.meta.projectPath ?? project.claudeProjectPath;
  const projectName = project.meta.projectName ?? "Untitled Project";
  const currentBranch = revisionsData?.success
    ? revisionsData.data.currentBranch?.name
    : undefined;

  return (
    <PersistentDialogsProvider>
      <DiffLineCommentProvider>
        <FileExplorerCommentProvider>
          <Suspense fallback={<Loading />}>
            <SessionSidebar
              currentSessionId={sessionId}
              projectId={projectId}
              projectName={projectName}
              isMobileOpen={isMobileSidebarOpen}
              onMobileOpenChange={setIsMobileSidebarOpen}
              initialTab={tab}
            />
          </Suspense>

          {/* Dialogs rendered outside SessionPageMain - they stay mounted across session changes */}
          <DiffModal
            projectId={projectId}
            projectName={projectName}
            branchName={currentBranch}
            revisionsData={revisionsData}
          />
          {projectPath && (
            <FileExplorerDialog
              projectId={projectId}
              projectPath={projectPath}
              projectName={projectName}
              branchName={currentBranch}
            />
          )}
          <TerminalCommentProvider>
            <TerminalDialog />

            <Suspense fallback={<Loading />}>
              <SessionPageMain
                key={sessionId}
                projectId={projectId}
                sessionId={sessionId}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                projectPath={projectPath}
                currentBranch={currentBranch}
                revisionsData={revisionsData}
                projectName={projectName}
              />
            </Suspense>
          </TerminalCommentProvider>
        </FileExplorerCommentProvider>
      </DiffLineCommentProvider>
    </PersistentDialogsProvider>
  );
};

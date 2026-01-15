import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { sortSessionsByStatusAndDate } from "../../../../lib/session-sorting";
import type { PublicSessionProcess } from "../../../../types/session-process";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { computeClaudeProjectFilePath } from "../../claude-code/functions/computeClaudeProjectFilePath";
import * as CCSessionProcess from "../../claude-code/models/CCSessionProcess";
import { ClaudeCodeLifeCycleService } from "../../claude-code/services/ClaudeCodeLifeCycleService";
import { ApplicationContext } from "../../platform/services/ApplicationContext";
import { UserConfigService } from "../../platform/services/UserConfigService";
import { SessionRepository } from "../../session/infrastructure/SessionRepository";
import { StarredSessionService } from "../../starred-session/StarredSessionService";
import { encodeProjectId } from "../functions/id";
import { ProjectRepository } from "../infrastructure/ProjectRepository";

const LayerImpl = Effect.gen(function* () {
  const projectRepository = yield* ProjectRepository;
  const claudeCodeLifeCycleService = yield* ClaudeCodeLifeCycleService;
  const userConfigService = yield* UserConfigService;
  const sessionRepository = yield* SessionRepository;
  const starredSessionService = yield* StarredSessionService;
  const context = yield* ApplicationContext;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const getProjects = () =>
    Effect.gen(function* () {
      const { projects } = yield* projectRepository.getProjects();
      return {
        status: 200,
        response: { projects },
      } as const satisfies ControllerResponse;
    });

  const getPublicSessionProcesses = () =>
    Effect.gen(function* () {
      const processes =
        yield* claudeCodeLifeCycleService.getPublicSessionProcesses();
      const publicProcesses: PublicSessionProcess[] = [];
      for (const p of processes) {
        const sessionId = CCSessionProcess.getSessionId(p);
        if (sessionId !== undefined) {
          publicProcesses.push({
            id: p.def.sessionProcessId,
            projectId: p.def.projectId,
            sessionId,
            status: CCSessionProcess.getPublicStatus(p),
            permissionMode: p.def.permissionMode,
          });
        }
      }
      return publicProcesses;
    });

  const getProject = (options: { projectId: string; cursor?: string }) =>
    Effect.gen(function* () {
      const { projectId, cursor } = options;
      const pageSize = 20;

      const userConfig = yield* userConfigService.getUserConfig();

      const { project } = yield* projectRepository.getProject(projectId);

      // Get all sessions without pagination to sort by status first
      const { sessions: allSessions } = yield* sessionRepository.getSessions(
        projectId,
        {
          maxCount: Number.MAX_SAFE_INTEGER,
        },
      );

      // Get active session processes
      const sessionProcesses = yield* getPublicSessionProcesses();
      const projectProcesses = sessionProcesses.filter(
        (p) => p.projectId === projectId,
      );

      // Get starred session IDs
      const starredSessionIds =
        yield* starredSessionService.getStarredSessionIds();

      // Sort sessions by status (active/paused first), then starred, then by date
      const sortedSessions = sortSessionsByStatusAndDate(
        allSessions,
        projectProcesses,
        new Set(starredSessionIds),
      );

      // Apply user config filters
      let filteredSessions = sortedSessions;

      // Filter sessions based on hideNoUserMessageSession setting
      if (userConfig.hideNoUserMessageSession) {
        filteredSessions = filteredSessions.filter((session) => {
          return session.meta.firstUserMessage !== null;
        });
      }

      // Unify sessions with same title if unifySameTitleSession is enabled
      if (userConfig.unifySameTitleSession) {
        const sessionMap = new Map<string, (typeof filteredSessions)[0]>();

        for (const session of filteredSessions) {
          // Generate title for comparison
          const title =
            session.meta.firstUserMessage !== null
              ? (() => {
                  const cmd = session.meta.firstUserMessage;
                  switch (cmd.kind) {
                    case "command":
                      return cmd.commandArgs === undefined
                        ? cmd.commandName
                        : `${cmd.commandName} ${cmd.commandArgs}`;
                    case "local-command":
                      return cmd.stdout;
                    case "text":
                      return cmd.content;
                    default:
                      return session.id;
                  }
                })()
              : session.id;

          const existingSession = sessionMap.get(title);
          if (existingSession) {
            // Keep the session with the latest modification date
            if (session.lastModifiedAt && existingSession.lastModifiedAt) {
              if (session.lastModifiedAt > existingSession.lastModifiedAt) {
                sessionMap.set(title, session);
              }
            } else if (
              session.lastModifiedAt &&
              !existingSession.lastModifiedAt
            ) {
              sessionMap.set(title, session);
            }
            // If no modification dates, keep the existing one
          } else {
            sessionMap.set(title, session);
          }
        }

        filteredSessions = Array.from(sessionMap.values());
        // Re-sort after unification to maintain status-based ordering
        filteredSessions = sortSessionsByStatusAndDate(
          filteredSessions,
          projectProcesses,
          new Set(starredSessionIds),
        );
      }

      // Apply cursor-based pagination
      let startIndex = 0;
      if (cursor) {
        const cursorIndex = filteredSessions.findIndex((s) => s.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const sessionsToReturn = filteredSessions.slice(
        startIndex,
        startIndex + pageSize,
      );
      const hasMore = startIndex + pageSize < filteredSessions.length;

      return {
        status: 200,
        response: {
          project,
          sessions: sessionsToReturn,
          nextCursor: hasMore ? sessionsToReturn.at(-1)?.id : undefined,
        },
      } as const satisfies ControllerResponse;
    });

  const getProjectLatestSession = (options: { projectId: string }) =>
    Effect.gen(function* () {
      const { projectId } = options;
      const { sessions } = yield* sessionRepository.getSessions(projectId, {
        maxCount: 1,
      });

      return {
        status: 200,
        response: {
          latestSession: sessions[0] ?? null,
        },
      } as const satisfies ControllerResponse;
    });

  const getRecentSessions = (options: { limit?: number; cursor?: string }) =>
    Effect.gen(function* () {
      const { limit = 10, cursor } = options;
      const userConfig = yield* userConfigService.getUserConfig();

      // Get all projects
      const { projects } = yield* projectRepository.getProjects();

      // Get active session processes
      const sessionProcesses = yield* getPublicSessionProcesses();

      // Get starred session IDs
      const starredSessionIds =
        yield* starredSessionService.getStarredSessionIds();

      // Get sessions from all projects (first page only, limited per project)
      const allSessionsEffects = projects.map((project) =>
        Effect.gen(function* () {
          const { sessions } = yield* sessionRepository.getSessions(
            project.id,
            {
              maxCount: 20, // Get more to have enough after filtering
            },
          );

          // Filter sessions based on hideNoUserMessageSession setting
          let filteredSessions = sessions;
          if (userConfig.hideNoUserMessageSession) {
            filteredSessions = filteredSessions.filter((session) => {
              return session.meta.firstUserMessage !== null;
            });
          }

          // Add project info to each session
          return filteredSessions.map((session) => ({
            ...session,
            projectId: project.id,
            projectName: project.meta.projectName,
          }));
        }).pipe(Effect.catchAll(() => Effect.succeed([]))),
      );

      const sessionsPerProject = yield* Effect.all(allSessionsEffects, {
        concurrency: "unbounded",
      });

      // Flatten and sort by status (active/paused first), then starred, then by date
      const allSessions = sortSessionsByStatusAndDate(
        sessionsPerProject.flat(),
        sessionProcesses,
        new Set(starredSessionIds),
      );

      // Apply cursor-based pagination
      let startIndex = 0;
      if (cursor) {
        const cursorIndex = allSessions.findIndex((s) => s.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const sessionsToReturn = allSessions.slice(
        startIndex,
        startIndex + limit,
      );
      const hasMore = startIndex + limit < allSessions.length;

      return {
        status: 200,
        response: {
          sessions: sessionsToReturn,
          nextCursor: hasMore ? sessionsToReturn.at(-1)?.id : undefined,
        },
      } as const satisfies ControllerResponse;
    });

  const createProject = (options: { projectPath: string }) =>
    Effect.gen(function* () {
      const { projectPath } = options;

      // No project validation needed - startTask will create a new project
      // if it doesn't exist when running /init command
      const claudeProjectFilePath = yield* computeClaudeProjectFilePath({
        projectPath,
        claudeProjectsDirPath: (yield* context.claudeCodePaths)
          .claudeProjectsDirPath,
      });
      const projectId = encodeProjectId(claudeProjectFilePath);
      const userConfig = yield* userConfigService.getUserConfig();

      // Check if CLAUDE.md exists in the project directory
      const claudeMdPath = path.join(projectPath, "CLAUDE.md");
      const claudeMdExists = yield* fileSystem.exists(claudeMdPath);

      const result = yield* claudeCodeLifeCycleService.startTask({
        baseSession: {
          cwd: projectPath,
          projectId,
          sessionId: undefined,
        },
        userConfig,
        input: {
          text: claudeMdExists ? "describe this project" : "/init",
        },
      });

      const { sessionId } = yield* result.yieldSessionFileCreated();

      return {
        status: 201,
        response: {
          projectId,
          sessionId,
        },
      } as const satisfies ControllerResponse;
    });

  return {
    getProjects,
    getProject,
    getProjectLatestSession,
    getRecentSessions,
    createProject,
  };
});

export type IProjectController = InferEffect<typeof LayerImpl>;
export class ProjectController extends Context.Tag("ProjectController")<
  ProjectController,
  IProjectController
>() {
  static Live = Layer.effect(this, LayerImpl);
}

import { Context, Effect, Layer } from "effect";
import type { PublicSessionProcess } from "../../../../types/session-process";
import type { UserConfig } from "../../../lib/config/config";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { UserConfigService } from "../../platform/services/UserConfigService";
import { ProjectRepository } from "../../project/infrastructure/ProjectRepository";
import type { UserMessageInput } from "../functions/createMessageGenerator";
import { ClaudeCodeLifeCycleService } from "../services/ClaudeCodeLifeCycleService";
import { SessionProcessNotFoundError } from "../services/ClaudeCodeSessionProcessService";

const LayerImpl = Effect.gen(function* () {
  const projectRepository = yield* ProjectRepository;
  const claudeCodeLifeCycleService = yield* ClaudeCodeLifeCycleService;
  const userConfigService = yield* UserConfigService;

  const getSessionProcesses = () =>
    Effect.gen(function* () {
      const publicSessionProcesses =
        yield* claudeCodeLifeCycleService.getPublicSessionProcesses();

      return {
        response: {
          processes: publicSessionProcesses.map(
            (p): PublicSessionProcess => ({
              id: p.def.sessionProcessId,
              projectId: p.def.projectId,
              sessionId: p.sessionId,
              status: p.type === "paused" ? "paused" : "running",
              permissionMode: p.def.permissionMode,
            }),
          ),
        },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const createSessionProcess = (options: {
    projectId: string;
    input: UserMessageInput;
    baseSessionId?: string | undefined;
    permissionModeOverride?: NonNullable<UserConfig["permissionMode"]>;
  }) =>
    Effect.gen(function* () {
      const { projectId, input, baseSessionId, permissionModeOverride } =
        options;

      const { project } = yield* projectRepository.getProject(projectId);
      const userConfig = yield* userConfigService.getUserConfig();

      if (project.meta.projectPath === null) {
        return {
          response: { error: "Project path not found" },
          status: 400 as const,
        } as const satisfies ControllerResponse;
      }

      // Use override if provided, otherwise use userConfig
      const effectiveUserConfig = permissionModeOverride
        ? { ...userConfig, permissionMode: permissionModeOverride }
        : userConfig;

      const result = yield* claudeCodeLifeCycleService.startTask({
        baseSession: {
          cwd: project.meta.projectPath,
          projectId,
          sessionId: baseSessionId,
        },
        userConfig: effectiveUserConfig,
        input,
      });

      const { sessionId } = yield* result.yieldSessionInitialized();

      return {
        status: 201 as const,
        response: {
          sessionProcess: {
            id: result.sessionProcess.def.sessionProcessId,
            projectId,
            sessionId,
          },
        },
      } as const satisfies ControllerResponse;
    });

  const continueSessionProcess = (options: {
    projectId: string;
    input: UserMessageInput;
    baseSessionId: string;
    sessionProcessId: string;
  }) =>
    Effect.gen(function* () {
      const { projectId, input, baseSessionId, sessionProcessId } = options;

      const { project } = yield* projectRepository.getProject(projectId);

      if (project.meta.projectPath === null) {
        return {
          response: { error: "Project path not found" },
          status: 400,
        } as const satisfies ControllerResponse;
      }

      const continueResult = yield* claudeCodeLifeCycleService
        .continueTask({
          sessionProcessId,
          input,
          baseSessionId,
        })
        .pipe(Effect.either);

      // If session process not found (e.g., server restarted), fallback to starting a new process
      if (
        continueResult._tag === "Left" &&
        continueResult.left instanceof SessionProcessNotFoundError
      ) {
        console.log(
          `Session process ${sessionProcessId} not found, falling back to startTask`,
        );
        const userConfig = yield* userConfigService.getUserConfig();
        const startResult = yield* claudeCodeLifeCycleService.startTask({
          baseSession: {
            cwd: project.meta.projectPath,
            projectId,
            sessionId: baseSessionId,
          },
          userConfig,
          input,
        });

        const { sessionId } = yield* startResult.yieldSessionInitialized();

        return {
          response: {
            sessionProcess: {
              id: startResult.sessionProcess.def.sessionProcessId,
              projectId,
              sessionId,
            },
          },
          status: 201,
        } as const satisfies ControllerResponse;
      }

      // Re-throw other errors
      if (continueResult._tag === "Left") {
        return yield* Effect.fail(continueResult.left);
      }

      const result = continueResult.right;

      return {
        response: {
          sessionProcess: {
            id: result.sessionProcess.def.sessionProcessId,
            projectId: result.sessionProcess.def.projectId,
            sessionId: baseSessionId,
          },
        },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  return {
    getSessionProcesses,
    createSessionProcess,
    continueSessionProcess,
  };
});

export type IClaudeCodeSessionProcessController = InferEffect<typeof LayerImpl>;
export class ClaudeCodeSessionProcessController extends Context.Tag(
  "ClaudeCodeSessionProcessController",
)<ClaudeCodeSessionProcessController, IClaudeCodeSessionProcessController>() {
  static Live = Layer.effect(this, LayerImpl);
}

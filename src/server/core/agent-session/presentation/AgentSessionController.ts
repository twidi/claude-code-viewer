import { Context, Effect, Layer } from "effect";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { AgentSessionRepository } from "../infrastructure/AgentSessionRepository";

const LayerImpl = Effect.gen(function* () {
  const repository = yield* AgentSessionRepository;

  /**
   * Get agent session by agentId.
   * Reads agent session file with subagents→flat path fallback.
   */
  const getAgentSession = (params: {
    projectId: string;
    sessionId: string;
    agentId: string;
  }) =>
    Effect.gen(function* () {
      const { projectId, sessionId, agentId } = params;

      // Read conversations directly using agentId with subagents→flat fallback
      const conversations = yield* repository.getAgentSessionByAgentId(
        projectId,
        sessionId,
        agentId,
      );

      if (conversations === null) {
        return {
          status: 200,
          response: {
            agentSessionId: null,
            conversations: [],
          },
        } as const satisfies ControllerResponse;
      }

      return {
        status: 200,
        response: {
          agentSessionId: agentId,
          conversations,
        },
      } as const satisfies ControllerResponse;
    });

  /**
   * Find a pending agent session by matching prompt and timestamp.
   *
   * This endpoint is a workaround for foreground Task execution where the agentId
   * is not available in the session's tool_use message until the task completes.
   * The frontend calls this to find the matching agent file when viewing a
   * running Task's details.
   *
   * @see AgentSessionRepository.findPendingAgentSession for matching logic
   */
  const findPendingAgentSession = (params: {
    projectId: string;
    sessionId: string;
    prompt: string;
    toolUseTimestamp: string;
    knownAgentIds: string[];
  }) =>
    Effect.gen(function* () {
      const { projectId, sessionId, prompt, toolUseTimestamp, knownAgentIds } =
        params;

      const agentId = yield* repository.findPendingAgentSession(
        projectId,
        sessionId,
        prompt,
        toolUseTimestamp,
        knownAgentIds,
      );

      return {
        status: 200,
        response: {
          agentId,
        },
      } as const satisfies ControllerResponse;
    });

  return {
    getAgentSession,
    findPendingAgentSession,
  };
});

export type IAgentSessionController = InferEffect<typeof LayerImpl>;

export class AgentSessionController extends Context.Tag(
  "AgentSessionController",
)<AgentSessionController, IAgentSessionController>() {
  static Live = Layer.effect(this, LayerImpl);
}

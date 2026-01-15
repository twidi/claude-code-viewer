import { Context, Effect, Layer } from "effect";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { StarredSessionService } from "../StarredSessionService";

const LayerImpl = Effect.gen(function* () {
  const starredSessionService = yield* StarredSessionService;

  const getStarredSessionIds = () =>
    Effect.gen(function* () {
      const starredIds = yield* starredSessionService.getStarredSessionIds();
      return {
        response: { starredSessionIds: starredIds },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const toggleStar = (options: { sessionId: string }) =>
    Effect.gen(function* () {
      const result = yield* starredSessionService.toggleStar(options.sessionId);
      return {
        response: result,
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const addStar = (options: { sessionId: string }) =>
    Effect.gen(function* () {
      yield* starredSessionService.addStar(options.sessionId);
      return {
        response: { success: true },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const removeStar = (options: { sessionId: string }) =>
    Effect.gen(function* () {
      yield* starredSessionService.removeStar(options.sessionId);
      return {
        response: { success: true },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  return {
    getStarredSessionIds,
    toggleStar,
    addStar,
    removeStar,
  };
});

export type IStarredSessionController = InferEffect<typeof LayerImpl>;

export class StarredSessionController extends Context.Tag(
  "StarredSessionController",
)<StarredSessionController, IStarredSessionController>() {
  static Live = Layer.effect(this, LayerImpl);
}

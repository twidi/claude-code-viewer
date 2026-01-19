import { Context, Effect, Layer, Ref } from "effect";
import type { InferEffect } from "../../lib/effect/types";
import {
  initializeConfig,
  StarredSessionsConfigBaseDir,
  writeConfig,
} from "./config";
import type { StarredSessionsConfig } from "./schema";

const LayerImpl = Effect.gen(function* () {
  const configRef = yield* Ref.make<StarredSessionsConfig>({
    starredSessionIds: [],
  });

  // Initialize config from file
  const config = yield* initializeConfig;
  yield* Ref.set(configRef, config);

  const getStarredSessionIds = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configRef);
      return config.starredSessionIds;
    });

  const isStarred = (sessionId: string) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configRef);
      return config.starredSessionIds.includes(sessionId);
    });

  const addStar = (sessionId: string) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configRef);
      if (config.starredSessionIds.includes(sessionId)) {
        return;
      }
      const newConfig: StarredSessionsConfig = {
        starredSessionIds: [...config.starredSessionIds, sessionId],
      };
      yield* Ref.set(configRef, newConfig);
      yield* writeConfig(newConfig);
    });

  const removeStar = (sessionId: string) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configRef);
      const newConfig: StarredSessionsConfig = {
        starredSessionIds: config.starredSessionIds.filter(
          (id) => id !== sessionId,
        ),
      };
      yield* Ref.set(configRef, newConfig);
      yield* writeConfig(newConfig);
    });

  const toggleStar = (sessionId: string) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configRef);
      const isCurrentlyStarred = config.starredSessionIds.includes(sessionId);

      if (isCurrentlyStarred) {
        yield* removeStar(sessionId);
        return { isStarred: false };
      }

      yield* addStar(sessionId);
      return { isStarred: true };
    });

  return {
    getStarredSessionIds,
    isStarred,
    addStar,
    removeStar,
    toggleStar,
  };
});

export type IStarredSessionService = InferEffect<typeof LayerImpl>;

export class StarredSessionService extends Context.Tag("StarredSessionService")<
  StarredSessionService,
  IStarredSessionService
>() {
  static Live = Layer.effect(this, LayerImpl).pipe(
    Layer.provide(StarredSessionsConfigBaseDir.Live),
  );
}

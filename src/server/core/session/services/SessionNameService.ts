import { Context, Effect, Layer } from "effect";
import { z } from "zod";
import {
  FileCacheStorage,
  makeFileCacheStorageLayer,
} from "../../../lib/storage/FileCacheStorage";
import { PersistentService } from "../../../lib/storage/FileCacheStorage/PersistentService";

const sessionCustomNameSchema = z.string().min(1).max(200);

export class SessionNameService extends Context.Tag("SessionNameService")<
  SessionNameService,
  {
    readonly getSessionName: (
      sessionId: string,
    ) => Effect.Effect<string | undefined>;
    readonly setSessionName: (
      sessionId: string,
      name: string,
    ) => Effect.Effect<void>;
    readonly deleteSessionName: (sessionId: string) => Effect.Effect<void>;
    readonly getAllSessionNames: () => Effect.Effect<Map<string, string>>;
  }
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const sessionNamesCache = yield* FileCacheStorage<string>();

      return {
        getSessionName: (sessionId: string) => sessionNamesCache.get(sessionId),

        setSessionName: (sessionId: string, name: string) =>
          sessionNamesCache.set(sessionId, name),

        deleteSessionName: (sessionId: string) =>
          sessionNamesCache.invalidate(sessionId),

        getAllSessionNames: () => sessionNamesCache.getAll(),
      };
    }),
  ).pipe(
    Layer.provide(
      makeFileCacheStorageLayer("session-names-cache", sessionCustomNameSchema),
    ),
    Layer.provide(PersistentService.Live),
  );
}

export type ISessionNameService = Context.Tag.Service<
  typeof SessionNameService
>;

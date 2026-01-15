import { homedir } from "node:os";
import { FileSystem, Path } from "@effect/platform";
import { Context, Data, Effect, Layer } from "effect";
import {
  type StarredSessionsConfig,
  starredSessionsConfigSchema,
} from "./schema";

class ConfigFileNotFoundError extends Data.TaggedError(
  "ConfigFileNotFoundError",
)<{
  readonly path: string;
}> {}

class ConfigParseError extends Data.TaggedError("ConfigParseError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

const CONFIG_FILE = "starred-sessions.json";

export class StarredSessionsConfigBaseDir extends Context.Tag(
  "StarredSessionsConfigBaseDir",
)<StarredSessionsConfigBaseDir, string>() {
  static Live = Layer.succeed(this, `${homedir()}/.claude-code-viewer`);
}

export const getConfigPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  const baseDir = yield* StarredSessionsConfigBaseDir;
  return path.join(baseDir, CONFIG_FILE);
});

export const readConfig = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const configPath = yield* getConfigPath;

  const exists = yield* fs.exists(configPath);
  if (!exists) {
    return yield* Effect.fail(
      new ConfigFileNotFoundError({ path: configPath }),
    );
  }

  const content = yield* fs.readFileString(configPath);

  const jsonResult = yield* Effect.try({
    try: () => JSON.parse(content),
    catch: (error) =>
      new ConfigParseError({
        path: configPath,
        cause: error,
      }),
  });

  const parsed = starredSessionsConfigSchema.safeParse(jsonResult);

  if (!parsed.success) {
    return yield* Effect.fail(
      new ConfigParseError({
        path: configPath,
        cause: parsed.error,
      }),
    );
  }

  return parsed.data;
});

export const writeConfig = (config: StarredSessionsConfig) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const configPath = yield* getConfigPath;
    const configDir = path.dirname(configPath);

    yield* fs.makeDirectory(configDir, { recursive: true });

    const content = JSON.stringify(config, null, 2);
    yield* fs.writeFileString(configPath, content);
  });

export const initializeConfig = Effect.gen(function* () {
  const result = yield* readConfig.pipe(
    Effect.catchTags({
      ConfigFileNotFoundError: () =>
        Effect.gen(function* () {
          const initialConfig: StarredSessionsConfig = {
            starredSessionIds: [],
          };
          yield* writeConfig(initialConfig);
          return initialConfig;
        }),
      ConfigParseError: () =>
        Effect.gen(function* () {
          const initialConfig: StarredSessionsConfig = {
            starredSessionIds: [],
          };
          yield* writeConfig(initialConfig);
          return initialConfig;
        }),
    }),
  );

  return result;
});

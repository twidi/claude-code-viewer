import { Context, Effect, Layer } from "effect";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { SessionNameService } from "../services/SessionNameService";

const LayerImpl = Effect.gen(function* () {
  const sessionNameService = yield* SessionNameService;

  const getAllSessionNames = () =>
    Effect.gen(function* () {
      const names = yield* sessionNameService.getAllSessionNames();
      return {
        response: { names: Object.fromEntries(names) },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const getSessionName = (options: { sessionId: string }) =>
    Effect.gen(function* () {
      const name = yield* sessionNameService.getSessionName(options.sessionId);
      return {
        response: { name: name ?? null },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const setSessionName = (options: { sessionId: string; name: string }) =>
    Effect.gen(function* () {
      yield* sessionNameService.setSessionName(options.sessionId, options.name);
      return {
        response: { success: true },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  const deleteSessionName = (options: { sessionId: string }) =>
    Effect.gen(function* () {
      yield* sessionNameService.deleteSessionName(options.sessionId);
      return {
        response: { success: true },
        status: 200,
      } as const satisfies ControllerResponse;
    });

  return {
    getAllSessionNames,
    getSessionName,
    setSessionName,
    deleteSessionName,
  };
});

export type ISessionNameController = InferEffect<typeof LayerImpl>;

export class SessionNameController extends Context.Tag("SessionNameController")<
  SessionNameController,
  ISessionNameController
>() {
  static Live = Layer.effect(this, LayerImpl);
}

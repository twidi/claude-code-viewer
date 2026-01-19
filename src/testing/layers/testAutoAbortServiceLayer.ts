import { Effect, Layer } from "effect";
import { AutoAbortService } from "../../server/core/auto-abort/AutoAbortService";

export const testAutoAbortServiceLayer = (options?: {
  startAutoAbortDaemon?: () => Effect.Effect<void>;
  stopAutoAbortDaemon?: () => Effect.Effect<void>;
}) => {
  const {
    startAutoAbortDaemon = () => Effect.void,
    stopAutoAbortDaemon = () => Effect.void,
  } = options ?? {};

  return Layer.mock(AutoAbortService, {
    startAutoAbortDaemon: startAutoAbortDaemon(),
    stopAutoAbortDaemon: stopAutoAbortDaemon(),
  });
};

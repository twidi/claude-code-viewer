import { Effect, Layer } from "effect";
import { SessionRepository } from "../../server/core/session/infrastructure/SessionRepository";
import type { Session, SessionDetail } from "../../server/core/types";

export const testSessionRepositoryLayer = (options?: {
  sessions?: Array<Session>;
  sessionDetails?: Map<string, SessionDetail>;
}) => {
  const { sessions = [], sessionDetails = new Map() } = options ?? {};

  return Layer.mock(SessionRepository, {
    getSessions: () => {
      return Effect.succeed({ sessions });
    },
    getSession: (_projectId: string, sessionId: string) => {
      const detail = sessionDetails.get(sessionId);
      if (detail) {
        return Effect.succeed({ session: detail });
      }
      return Effect.succeed({ session: null });
    },
  });
};

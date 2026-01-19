import { SystemError } from "@effect/platform/Error";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { testFileSystemLayer } from "../../../../testing/layers/testFileSystemLayer";
import { testPlatformLayer } from "../../../../testing/layers/testPlatformLayer";
import { AgentSessionRepository } from "./AgentSessionRepository";

describe("AgentSessionRepository", () => {
  describe("getAgentSessionByAgentId", () => {
    const projectId = Buffer.from("/test/project").toString("base64url");
    const sessionId = "test-session-id";
    const agentId = "test-agent-id";

    const subagentsPath = `/test/project/${sessionId}/subagents/agent-${agentId}.jsonl`;
    const flatPath = `/test/project/agent-${agentId}.jsonl`;

    const mockJsonlContent =
      '{"type":"user","message":{"role":"user","content":"Hello"}}\n{"type":"assistant","message":{"role":"assistant","content":"Hi"}}';

    it("reads from subagents path when it exists", async () => {
      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === subagentsPath),
        readFileString: (path: string) =>
          path === subagentsPath
            ? Effect.succeed(mockJsonlContent)
            : Effect.fail(
                new SystemError({
                  method: "readFileString",
                  reason: "NotFound",
                  module: "FileSystem",
                  cause: undefined,
                }),
              ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.getAgentSessionByAgentId(
          projectId,
          sessionId,
          agentId,
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it("falls back to flat path when subagents path does not exist", async () => {
      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === flatPath),
        readFileString: (path: string) =>
          path === flatPath
            ? Effect.succeed(mockJsonlContent)
            : Effect.fail(
                new SystemError({
                  method: "readFileString",
                  reason: "NotFound",
                  module: "FileSystem",
                  cause: undefined,
                }),
              ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.getAgentSessionByAgentId(
          projectId,
          sessionId,
          agentId,
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it("returns null when neither subagents nor flat path exists", async () => {
      const FileSystemMock = testFileSystemLayer({
        exists: () => Effect.succeed(false),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.getAgentSessionByAgentId(
          projectId,
          sessionId,
          agentId,
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBeNull();
    });

    it("prefers subagents path when both paths exist", async () => {
      // Track which path was read
      let readPath: string | null = null;

      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) =>
          Effect.succeed(path === subagentsPath || path === flatPath),
        readFileString: (path: string) => {
          readPath = path;
          if (path === subagentsPath) return Effect.succeed(mockJsonlContent);
          if (path === flatPath) return Effect.succeed(mockJsonlContent);
          return Effect.fail(
            new SystemError({
              method: "readFileString",
              reason: "NotFound",
              module: "FileSystem",
              cause: undefined,
            }),
          );
        },
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.getAgentSessionByAgentId(
          projectId,
          sessionId,
          agentId,
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).not.toBeNull();
      // Subagents path should be read, not flat path
      expect(readPath).toBe(subagentsPath);
    });
  });

  describe("findPendingAgentSession", () => {
    const projectId = Buffer.from("/test/project").toString("base64url");
    const sessionId = "test-session-id";
    const subagentsDir = `/test/project/${sessionId}/subagents`;

    const makeAgentFirstMessage = (
      agentId: string,
      timestamp: string,
      prompt: string,
    ) =>
      JSON.stringify({
        agentId,
        timestamp,
        message: { role: "user", content: prompt },
      });

    it("finds agent matching prompt and timestamp", async () => {
      const targetAgentId = "target-agent";
      const targetPrompt = "Do the task";
      const toolUseTimestamp = "2026-01-18T22:00:00.000Z";

      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === subagentsDir),
        readDirectory: () => Effect.succeed([`agent-${targetAgentId}.jsonl`]),
        readFileString: () =>
          Effect.succeed(
            makeAgentFirstMessage(
              targetAgentId,
              "2026-01-18T22:00:01.000Z",
              targetPrompt,
            ),
          ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.findPendingAgentSession(
          projectId,
          sessionId,
          targetPrompt,
          toolUseTimestamp,
          [],
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBe(targetAgentId);
    });

    it("excludes agents with timestamp before toolUseTimestamp", async () => {
      const agentId = "old-agent";
      const prompt = "Do the task";
      const toolUseTimestamp = "2026-01-18T22:00:00.000Z";

      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === subagentsDir),
        readDirectory: () => Effect.succeed([`agent-${agentId}.jsonl`]),
        readFileString: () =>
          // Agent timestamp is BEFORE tool_use timestamp
          Effect.succeed(
            makeAgentFirstMessage(agentId, "2026-01-18T21:59:59.000Z", prompt),
          ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.findPendingAgentSession(
          projectId,
          sessionId,
          prompt,
          toolUseTimestamp,
          [],
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBeNull();
    });

    it("excludes agents in knownAgentIds", async () => {
      const agentId = "known-agent";
      const prompt = "Do the task";
      const toolUseTimestamp = "2026-01-18T22:00:00.000Z";

      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === subagentsDir),
        readDirectory: () => Effect.succeed([`agent-${agentId}.jsonl`]),
        readFileString: () =>
          Effect.succeed(
            makeAgentFirstMessage(agentId, "2026-01-18T22:00:01.000Z", prompt),
          ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.findPendingAgentSession(
          projectId,
          sessionId,
          prompt,
          toolUseTimestamp,
          [agentId], // Agent is already known
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBeNull();
    });

    it("returns null when prompt does not match", async () => {
      const agentId = "some-agent";
      const toolUseTimestamp = "2026-01-18T22:00:00.000Z";

      const FileSystemMock = testFileSystemLayer({
        exists: (path: string) => Effect.succeed(path === subagentsDir),
        readDirectory: () => Effect.succeed([`agent-${agentId}.jsonl`]),
        readFileString: () =>
          Effect.succeed(
            makeAgentFirstMessage(
              agentId,
              "2026-01-18T22:00:01.000Z",
              "Different prompt",
            ),
          ),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.findPendingAgentSession(
          projectId,
          sessionId,
          "Expected prompt",
          toolUseTimestamp,
          [],
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBeNull();
    });

    it("returns null when subagents directory does not exist", async () => {
      const FileSystemMock = testFileSystemLayer({
        exists: () => Effect.succeed(false),
      });

      const program = Effect.gen(function* () {
        const repo = yield* AgentSessionRepository;
        return yield* repo.findPendingAgentSession(
          projectId,
          sessionId,
          "Any prompt",
          "2026-01-18T22:00:00.000Z",
          [],
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(AgentSessionRepository.Live),
          Effect.provide(FileSystemMock),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toBeNull();
    });
  });
});

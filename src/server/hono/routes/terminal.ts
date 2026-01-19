import * as os from "node:os";
import type { createNodeWebSocket } from "@hono/node-ws";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

/**
 * Terminal route for WebSocket-based PTY communication.
 *
 * Design notes:
 * - Singleton PTY: One shell process for the entire app, persists across WebSocket disconnections
 * - The PTY process is only killed when the app exits or the shell process itself exits
 * - Multiple WebSocket connections can interact with the same PTY (though typically only one at a time)
 */

// Lazy import node-pty to avoid loading native module during type checking
// This also prevents issues if the module fails to load
let ptyModule: typeof import("@homebridge/node-pty-prebuilt-multiarch") | null =
  null;

async function getPtyModule() {
  if (!ptyModule) {
    ptyModule = await import("@homebridge/node-pty-prebuilt-multiarch");
  }
  return ptyModule;
}

// Type for the PTY instance
type IPty = import("@homebridge/node-pty-prebuilt-multiarch").IPty;

// Singleton PTY instance - one shell for the entire app
let ptyProcess: IPty | null = null;

// Track all active data listeners for cleanup when PTY exits
const activeDataDisposables = new Set<{ dispose(): void }>();

async function getOrCreatePty(): Promise<IPty> {
  if (!ptyProcess) {
    const pty = await getPtyModule();
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const homeDir = os.homedir();

    // biome-ignore lint/style/noProcessEnv: PTY requires inheriting the full environment for proper shell behavior
    const env = process.env;

    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: homeDir || process.cwd(),
      env,
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[Terminal] PTY exited with code ${exitCode}`);
      ptyProcess = null;
      // Dispose all data listeners when PTY exits to prevent memory leaks
      for (const disposable of activeDataDisposables) {
        disposable.dispose();
      }
      activeDataDisposables.clear();
    });
  }
  return ptyProcess;
}

// Zod schema for resize request
const resizeSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

type UpgradeWebSocket = ReturnType<
  typeof createNodeWebSocket
>["upgradeWebSocket"];

export function terminalRoutes(upgradeWebSocket: UpgradeWebSocket) {
  const app = new Hono();

  // WebSocket endpoint for terminal communication
  app.get(
    "/ws/terminal",
    upgradeWebSocket(() => {
      // Track if this connection should receive data
      let isActive = true;
      // Connection-local disposable to avoid race conditions with other connections
      let connectionDataDisposable: { dispose(): void } | null = null;

      return {
        onOpen: async (_, ws) => {
          try {
            const term = await getOrCreatePty();

            // PTY -> WebSocket: forward terminal output to the client
            // Each connection has its own listener tracked in a closure variable
            connectionDataDisposable = term.onData((data: string) => {
              if (isActive && ws.readyState === 1) {
                // 1 = WebSocket.OPEN
                ws.send(data);
              }
            });
            // Track in global set for cleanup when PTY exits
            activeDataDisposables.add(connectionDataDisposable);
          } catch (error) {
            console.error("[Terminal] Failed to initialize PTY:", error);
            ws.close(1011, "PTY initialization failed");
          }
        },

        onMessage: async (evt) => {
          try {
            const term = await getOrCreatePty();
            // WebSocket -> PTY: forward keyboard input to the terminal
            if (typeof evt.data === "string") {
              term.write(evt.data);
            }
          } catch (error) {
            console.error("[Terminal] Failed to write to PTY:", error);
          }
        },

        onClose: () => {
          // Mark this connection as inactive but don't kill the PTY
          // The PTY persists for the next connection
          isActive = false;

          // Clean up only this connection's data listener
          if (connectionDataDisposable) {
            connectionDataDisposable.dispose();
            activeDataDisposables.delete(connectionDataDisposable);
            connectionDataDisposable = null;
          }
        },

        onError: (error) => {
          console.error("[Terminal] WebSocket error:", error);
          isActive = false;
        },
      };
    }),
  );

  // REST endpoint for resizing the terminal
  app.post("/terminal/resize", zValidator("json", resizeSchema), async (c) => {
    const { cols, rows } = c.req.valid("json");

    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
        return c.json({ ok: true });
      } catch (error) {
        console.error("[Terminal] Failed to resize PTY:", error);
        return c.json({ ok: false, error: "Failed to resize terminal" }, 500);
      }
    }

    // No PTY process yet - that's okay, resize will apply when it's created
    return c.json({ ok: true, note: "No active terminal" });
  });

  return app;
}

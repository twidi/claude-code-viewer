import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { UserConfig } from "../lib/config/config";

export type HonoContext = {
  Variables: {
    userConfig: UserConfig;
  };
};

export const honoApp = new Hono<HonoContext>();

// WebSocket support for terminal and other real-time features
export const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
  app: honoApp,
});

export type HonoAppType = typeof honoApp;

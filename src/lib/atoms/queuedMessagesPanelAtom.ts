import { atom } from "jotai";

/**
 * Stores the sessionId of the session whose queued messages panel is currently open.
 * Used by the global session transitions hook to avoid auto-sending messages
 * when the user has the panel open for review/editing.
 *
 * null = no panel is open
 * string = sessionId of the session with open panel
 */
export const queuedMessagesPanelOpenForSessionAtom = atom<string | null>(null);

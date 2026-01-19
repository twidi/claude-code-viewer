"use client";

import { createCommentCountContext } from "./createCommentCountContext";

/**
 * Context for inserting terminal selection text into the chat textarea.
 *
 * Unlike Diff and FileExplorer contexts, the terminal doesn't track "comments"
 * but still uses the same factory to get the insertText capability.
 * The nonEmptyCommentCount is not used for terminal (always 0).
 */

// Create context using factory
const { Provider, useCommentCount } = createCommentCountContext("Terminal");

/**
 * Provider for terminal comment context.
 * Wrap your component tree with this to enable insert-to-chat functionality.
 */
export const TerminalCommentProvider = Provider;

/**
 * Hook to access terminal comment context.
 * Must be used within a TerminalCommentProvider.
 */
export const useTerminalComment = useCommentCount;

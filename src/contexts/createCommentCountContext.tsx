"use client";

import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Factory function to create a comment count context with Provider and hook.
 *
 * @param name - Display name for the context (used in error messages)
 * @returns Provider component and useCommentCount hook
 */
export function createCommentCountContext(name: string) {
  type InsertTextCallback = (text: string) => void;

  interface ContextValue {
    /**
     * Register a callback to insert text into the chat textarea.
     * Returns an unregister function.
     */
    registerInsertCallback: (callback: InsertTextCallback) => () => void;
    /**
     * Insert text into the chat textarea at cursor position or at the end.
     */
    insertText: (text: string) => void;
    /**
     * Count of non-empty comments (set by dialog, read by badge components)
     */
    nonEmptyCommentCount: number;
    /**
     * Update the non-empty comment count (called by dialog)
     */
    setNonEmptyCommentCount: (count: number) => void;
  }

  const Context = createContext<ContextValue | null>(null);

  const Provider: FC<{ children: ReactNode }> = ({ children }) => {
    const callbackRef = useRef<InsertTextCallback | null>(null);
    const [nonEmptyCommentCount, setNonEmptyCommentCount] = useState(0);

    const registerInsertCallback = useCallback((cb: InsertTextCallback) => {
      callbackRef.current = cb;
      return () => {
        callbackRef.current = null;
      };
    }, []);

    const insertText = useCallback((text: string) => {
      callbackRef.current?.(text);
    }, []);

    const value = useMemo(
      () => ({
        registerInsertCallback,
        insertText,
        nonEmptyCommentCount,
        setNonEmptyCommentCount,
      }),
      [registerInsertCallback, insertText, nonEmptyCommentCount],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  Provider.displayName = `${name}Provider`;

  const useCommentCount = (): ContextValue => {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error(
        `use${name}Comment must be used within ${name}CommentProvider`,
      );
    }
    return ctx;
  };

  return { Provider, useCommentCount };
}

/**
 * The context value type returned by the factory.
 * Exported for type annotations in consuming code.
 */
export interface CommentCountContextValue {
  registerInsertCallback: (callback: (text: string) => void) => () => void;
  insertText: (text: string) => void;
  nonEmptyCommentCount: number;
  setNonEmptyCommentCount: (count: number) => void;
}

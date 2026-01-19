"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef } from "react";

/**
 * TerminalPanel - Singleton-based xterm.js terminal component.
 *
 * Design decisions:
 * - Uses module-level singletons for WebSocket, Terminal, and FitAddon
 * - These survive re-renders and route changes (the terminal never resets)
 * - Auto-reconnects WebSocket after 2 seconds if disconnected
 * - Resize events trigger both FitAddon.fit() and POST to /api/terminal/resize
 *
 * Note: The resize endpoint uses raw fetch instead of Hono RPC because:
 * 1. It's a fire-and-forget operation that doesn't need caching
 * 2. WebSocket communication already bypasses the normal API pattern
 * 3. The resize endpoint is tightly coupled to the terminal's real-time state
 */

// ===========================================================================
// Module-level singletons - survive re-renders and route changes
// ===========================================================================

let globalWs: WebSocket | null = null;
let globalTerminal: Terminal | null = null;
let globalFitAddon: FitAddon | null = null;

// Track if the terminal has been opened in the DOM
let terminalAttached = false;

// Track active data disposable to clean up on reconnection
let dataDisposable: { dispose(): void } | null = null;

// Track touch position for mobile scrolling
let touchStartY: number | null = null;

// Track touch selection start position (for select mode)
let selectStartRow: number | null = null;
let selectStartCol: number | null = null;

// Touch mode: "scroll" for scrolling, "select" for text selection
export type TouchMode = "scroll" | "select";

// Helper to convert screen coordinates to terminal row/col (buffer coordinates)
function screenToTerminalCoords(
  terminal: Terminal,
  clientX: number,
  clientY: number,
): { row: number; col: number } | null {
  // Use xterm's internal element to get accurate cell dimensions
  const xtermElement = terminal.element;
  if (!xtermElement) return null;

  // Find the xterm-screen element which contains the actual terminal content
  const screenElement = xtermElement.querySelector(".xterm-screen");
  if (!screenElement) return null;

  const rect = screenElement.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // Calculate cell dimensions from the actual screen element
  const cellWidth = rect.width / terminal.cols;
  const cellHeight = rect.height / terminal.rows;

  const col = Math.floor(x / cellWidth);
  const viewportRow = Math.floor(y / cellHeight);

  // Clamp to valid viewport range
  if (
    col < 0 ||
    col >= terminal.cols ||
    viewportRow < 0 ||
    viewportRow >= terminal.rows
  ) {
    return null;
  }

  // Convert viewport row to buffer row by adding viewportY
  const bufferRow = viewportRow + terminal.buffer.active.viewportY;

  return { row: bufferRow, col };
}

// ===========================================================================
// Helper functions
// ===========================================================================

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/terminal`;
}

function sendResizeToBackend(cols: number, rows: number): void {
  // Fire-and-forget resize notification to backend
  // Using raw fetch here because this is a real-time terminal operation
  // that doesn't fit the query/mutation pattern
  fetch("/api/terminal/resize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cols, rows }),
  }).catch((error) => {
    // Non-critical - just log and continue
    console.error("[Terminal] Failed to send resize:", error);
  });
}

// ===========================================================================
// TerminalPanel Component
// ===========================================================================

export interface TerminalPanelProps {
  /** Touch mode: "scroll" for scrolling (default), "select" for text selection */
  touchMode?: TouchMode;
  /** Callback when selection changes (for showing copy button), includes char count */
  onSelectionChange?: (hasSelection: boolean, charCount: number) => void;
}

/** Fallback copy using a temporary textarea and execCommand */
function fallbackCopyToClipboard(text: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
    console.log(
      "[Terminal] execCommand fallback:",
      success ? "success" : "failed",
    );
  } catch (err) {
    console.error("[Terminal] execCommand fallback error:", err);
  }
  document.body.removeChild(textArea);
  return success;
}

/** Copy the current terminal selection to clipboard and return char count, or null if failed */
export function copyTerminalSelection(): number | null {
  if (!globalTerminal) {
    console.error("[Terminal] No terminal instance");
    return null;
  }
  const selection = globalTerminal.getSelection();
  if (!selection || selection.length === 0) {
    console.error("[Terminal] No selection to copy");
    return null;
  }

  const charCount = selection.length;

  // Use fallback directly since clipboard API often fails on mobile
  // The fallback is synchronous and more reliable
  const success = fallbackCopyToClipboard(selection);

  if (success) {
    globalTerminal.clearSelection();
    return charCount;
  }

  // Try clipboard API as secondary option
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(selection).then(
      () => {
        console.log("[Terminal] Copied via clipboard API");
        globalTerminal?.clearSelection();
      },
      (err) => {
        console.error("[Terminal] Clipboard API also failed:", err);
      },
    );
    // Return charCount optimistically since we can't wait for async
    return charCount;
  }

  return null;
}

/** Get the current selection char count */
export function getTerminalSelectionLength(): number {
  if (!globalTerminal) return 0;
  const selection = globalTerminal.getSelection();
  return selection?.length ?? 0;
}

/** Get the current terminal selection text */
export function getTerminalSelection(): string | null {
  if (!globalTerminal) return null;
  const selection = globalTerminal.getSelection();
  return selection && selection.length > 0 ? selection : null;
}

/** Clear the current terminal selection */
export function clearTerminalSelection(): void {
  globalTerminal?.clearSelection();
}

/** Clear the terminal screen */
export function clearTerminal(): void {
  globalTerminal?.clear();
}

export function TerminalPanel({
  touchMode = "scroll",
  onSelectionChange,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  /**
   * Initialize terminal and WebSocket connection.
   * This function is idempotent - safe to call multiple times.
   */
  const initTerminal = useCallback(() => {
    if (!containerRef.current) return;

    // Create terminal instance if it doesn't exist
    if (!globalTerminal) {
      globalTerminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: "#1e1e1e",
          foreground: "#d4d4d4",
        },
        // Improve scrolling behavior
        smoothScrollDuration: 100,
      });
      globalFitAddon = new FitAddon();
      globalTerminal.loadAddon(globalFitAddon);
    }

    // Attach to DOM if not already attached
    if (!terminalAttached && containerRef.current.children.length === 0) {
      globalTerminal.open(containerRef.current);
      terminalAttached = true;
    }

    // Fit terminal to container
    globalFitAddon?.fit();

    // Create WebSocket if needed
    if (!globalWs || globalWs.readyState === WebSocket.CLOSED) {
      globalWs = new WebSocket(getWebSocketUrl());

      globalWs.onopen = () => {
        globalTerminal?.write("\x1b[32m*** Connected ***\x1b[0m\r\n");
      };

      globalWs.onmessage = (event: MessageEvent<unknown>) => {
        // Validate that data is a string before writing
        if (typeof event.data === "string") {
          globalTerminal?.write(event.data);
        }
      };

      globalWs.onclose = () => {
        globalTerminal?.write("\r\n\x1b[31m*** Disconnected ***\x1b[0m\r\n");

        // Auto-reconnect after 2 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (globalWs?.readyState === WebSocket.CLOSED) {
            initTerminal();
          }
        }, 2000);
      };

      globalWs.onerror = () => {
        globalTerminal?.write(
          "\r\n\x1b[31m*** Connection error ***\x1b[0m\r\n",
        );
      };
    }

    // Set up terminal input -> WebSocket
    // Clean up previous listener if any
    if (dataDisposable) {
      dataDisposable.dispose();
    }

    if (globalTerminal) {
      dataDisposable = globalTerminal.onData((data: string) => {
        if (globalWs?.readyState === WebSocket.OPEN) {
          globalWs.send(data);
        }
      });
    }

    // Return cleanup function
    return () => {
      if (dataDisposable) {
        dataDisposable.dispose();
        dataDisposable = null;
      }
      // Do NOT close WebSocket or dispose terminal - they are singletons
    };
  }, []);

  useEffect(() => {
    const cleanup = initTerminal();

    // Handle resize from any source (window resize or container size change)
    const handleResize = () => {
      globalFitAddon?.fit();
      if (globalTerminal && globalWs?.readyState === WebSocket.OPEN) {
        sendResizeToBackend(globalTerminal.cols, globalTerminal.rows);
      }
    };

    window.addEventListener("resize", handleResize);

    // Mobile touch support
    // xterm.js doesn't natively support touch scrolling or selection well
    // (see github.com/xtermjs/xterm.js/issues/5377)
    // We implement custom handlers for both modes
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch || !globalTerminal) return;

      if (touchMode === "scroll") {
        touchStartY = touch.clientY;
      } else {
        // Select mode: start selection
        const coords = screenToTerminalCoords(
          globalTerminal,
          touch.clientX,
          touch.clientY,
        );
        if (coords) {
          selectStartRow = coords.row;
          selectStartCol = coords.col;
          globalTerminal.clearSelection();
          onSelectionChange?.(false, 0);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch || !globalTerminal) return;

      if (touchMode === "scroll") {
        if (touchStartY === null) return;

        const currentY = touch.clientY;
        const deltaY = touchStartY - currentY;

        // Scroll threshold: ~20px per line
        const linesToScroll = Math.round(deltaY / 20);
        if (linesToScroll !== 0) {
          globalTerminal.scrollLines(linesToScroll);
          touchStartY = currentY; // Reset for continuous scrolling
        }

        // Prevent default to avoid browser scroll interference
        e.preventDefault();
      } else {
        // Select mode: extend selection
        if (selectStartRow === null || selectStartCol === null) return;

        const coords = screenToTerminalCoords(
          globalTerminal,
          touch.clientX,
          touch.clientY,
        );
        if (coords) {
          // Calculate selection length from start to current position
          const startOffset =
            selectStartRow * globalTerminal.cols + selectStartCol;
          const currentOffset = coords.row * globalTerminal.cols + coords.col;
          const length = currentOffset - startOffset;

          if (length > 0) {
            globalTerminal.select(selectStartCol, selectStartRow, length);
          } else if (length < 0) {
            // Selecting backwards
            globalTerminal.select(coords.col, coords.row, -length);
          }

          // Get actual selection text to count characters
          const selectionText = globalTerminal.getSelection();
          const charCount = selectionText?.length ?? 0;
          onSelectionChange?.(charCount > 0, charCount);
        }

        // Prevent default to avoid browser scroll interference
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      touchStartY = null;
      selectStartRow = null;
      selectStartCol = null;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      container.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      container.addEventListener("touchend", handleTouchEnd, { passive: true });
    }

    // Listen to xterm.js native selection changes (mouse selection on desktop)
    let selectionDisposable: { dispose(): void } | null = null;
    if (globalTerminal && onSelectionChange) {
      selectionDisposable = globalTerminal.onSelectionChange(() => {
        const selection = globalTerminal?.getSelection();
        const charCount = selection?.length ?? 0;
        onSelectionChange(charCount > 0, charCount);
      });
    }

    // Use ResizeObserver to detect when dialog becomes visible (visibility: hidden -> visible)
    // or when the container size changes for any reason
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        // Only fit if the container has non-zero dimensions (i.e., is visible)
        if (
          containerRef.current &&
          containerRef.current.offsetWidth > 0 &&
          containerRef.current.offsetHeight > 0
        ) {
          handleResize();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    // Initial fit after DOM stabilizes
    const fitTimeout = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
      }
      selectionDisposable?.dispose();
      resizeObserver?.disconnect();
      clearTimeout(fitTimeout);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanup?.();
    };
  }, [initTerminal, touchMode, onSelectionChange]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#1e1e1e]"
      style={{ padding: "8px" }}
    />
  );
}

// Global error handlers to prevent server crashes from unhandled errors
// These catch errors that escape async boundaries (e.g., AbortError from SDK)
// This file MUST be imported first before any other modules

/**
 * Check if an error is an AbortError.
 * Handles both:
 * - Native AbortError (DOMException with name === "AbortError")
 * - SDK's custom AbortError class (extends Error without setting name property,
 *   so error.name === "Error" but error.constructor.name === "AbortError")
 */
const isAbortError = (error: Error): boolean => {
  return (
    error.name === "AbortError" || error.constructor?.name === "AbortError"
  );
};

process.on("uncaughtException", (error) => {
  // AbortError is expected when user aborts a Claude Code process
  if (isAbortError(error)) {
    console.log(
      "Claude Code process aborted (uncaughtException):",
      error.message,
    );
    return;
  }
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  // AbortError is expected when user aborts a Claude Code process
  if (reason instanceof Error && isAbortError(reason)) {
    console.log(
      "Claude Code process aborted (unhandledRejection):",
      reason.message,
    );
    return;
  }
  console.error("Unhandled rejection:", reason);
});

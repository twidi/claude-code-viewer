// Global error handlers to prevent server crashes from unhandled errors
// These catch errors that escape async boundaries (e.g., AbortError from SDK)
// This file MUST be imported first before any other modules

process.on("uncaughtException", (error) => {
  // AbortError is expected when user aborts a Claude Code process
  if (error.name === "AbortError") {
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
  if (reason instanceof Error && reason.name === "AbortError") {
    console.log(
      "Claude Code process aborted (unhandledRejection):",
      reason.message,
    );
    return;
  }
  console.error("Unhandled rejection:", reason);
});

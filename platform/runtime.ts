/**
 * Process-wide state. Next.js compiles instrumentation and the app as separate
 * module graphs, so a file-level `let` is not a singleton. `globalThis` is.
 */
export function voxaRuntime(): Record<string, unknown> {
  const globalState = globalThis as typeof globalThis & {
    __voxaRuntime?: Record<string, unknown>;
  };
  if (!globalState.__voxaRuntime) {
    globalState.__voxaRuntime = {};
  }
  return globalState.__voxaRuntime;
}

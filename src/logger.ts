/**
 * Minimal logger with elapsed time since startup. Lets you follow the
 * progress of a slow flow (login, post) step by step.
 */
export interface Logger {
  /** Main step of the flow. */
  step(msg: string): void;
  /** Detail / sub-step. */
  info(msg: string): void;
}

export function createLogger(enabled: boolean): Logger {
  const start = Date.now();
  const ts = () => `+${((Date.now() - start) / 1000).toFixed(1)}s`;
  const write = (prefix: string, msg: string) => {
    if (enabled) process.stdout.write(`[fb ${ts()}] ${prefix}${msg}\n`);
  };
  return {
    step: (msg) => write("", msg),
    info: (msg) => write("  - ", msg),
  };
}

/** Silent logger (default for library use without verbosity). */
export const NOOP_LOGGER: Logger = { step: () => {}, info: () => {} };

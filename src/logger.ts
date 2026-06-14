/**
 * Logger minimal avec temps ecoule depuis le demarrage. Permet de suivre la
 * progression d'un flux lent (login, publication) etape par etape.
 */
export interface Logger {
  /** Etape principale du flux. */
  step(msg: string): void;
  /** Detail / sous-etape. */
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

/** Logger silencieux (defaut pour usage librairie sans verbosite). */
export const NOOP_LOGGER: Logger = { step: () => {}, info: () => {} };

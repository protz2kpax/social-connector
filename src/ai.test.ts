import { describe, it, expect } from "vitest";
import { resolveProvider } from "./ai.js";

describe("resolveProvider", () => {
  it("prefers explicit over env", () => {
    expect(resolveProvider("anthropic")).toBe("anthropic");
  });
  it("falls back to openai when only OPENAI_API_KEY is set", () => {
    const prev = { o: process.env.OPENAI_API_KEY, a: process.env.ANTHROPIC_API_KEY, p: process.env.AI_PROVIDER };
    delete process.env.AI_PROVIDER; delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "x";
    expect(resolveProvider()).toBe("openai");
    Object.assign(process.env, { OPENAI_API_KEY: prev.o, ANTHROPIC_API_KEY: prev.a, AI_PROVIDER: prev.p });
  });
});

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.js";

function fakeManager() {
  return {
    get: vi.fn(async () => ({ isLoggedIn: async () => true, post: vi.fn(async () => {}) })),
    run: vi.fn((_p: any, fn: any) => fn()),
    newConnector: vi.fn(),
    set: vi.fn(),
  } as any;
}

describe("POST /api/broadcast", () => {
  it("rejects WhatsApp selected without a target", async () => {
    const app = createApp(fakeManager());
    const res = await request(app).post("/api/broadcast").send({ message: "hi", providers: ["whatsapp"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/target/i);
  });

  it("accepts a valid request and returns a runId", async () => {
    const app = createApp(fakeManager());
    const res = await request(app).post("/api/broadcast").send({ message: "hi", providers: ["facebook"] });
    expect(res.status).toBe(200);
    expect(typeof res.body.runId).toBe("string");
  });
});

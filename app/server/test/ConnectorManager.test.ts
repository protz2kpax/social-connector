import { describe, it, expect, vi } from "vitest";
import { ConnectorManager } from "../src/ConnectorManager.js";

function fakeConnector() {
  return {
    started: false,
    closed: false,
    isLoggedIn: vi.fn(async () => true),
    close: vi.fn(async function (this: any) { this.closed = true; }),
  };
}

describe("ConnectorManager", () => {
  it("lazily creates one connector per provider and reuses it", async () => {
    const made: any[] = [];
    const m = new ConnectorManager({
      factory: () => { const c = fakeConnector(); made.push(c); return c as any; },
      idleMs: 10_000,
    });
    const a = await m.get("whatsapp");
    const b = await m.get("whatsapp");
    expect(a).toBe(b);
    expect(made).toHaveLength(1);
    await m.shutdown();
  });

  it("serializes actions on the same provider", async () => {
    const order: string[] = [];
    const m = new ConnectorManager({ factory: () => fakeConnector() as any, idleMs: 10_000 });
    const slow = (tag: string) => m.run("whatsapp", async () => {
      order.push(`start-${tag}`);
      await new Promise((r) => setTimeout(r, 20));
      order.push(`end-${tag}`);
    });
    await Promise.all([slow("a"), slow("b")]);
    expect(order).toEqual(["start-a", "end-a", "start-b", "end-b"]);
    await m.shutdown();
  });

  it("runs different providers concurrently", async () => {
    const m = new ConnectorManager({ factory: () => fakeConnector() as any, idleMs: 10_000 });
    const order: string[] = [];
    const job = (p: any, tag: string) => m.run(p, async () => {
      order.push(`start-${tag}`);
      await new Promise((r) => setTimeout(r, 20));
      order.push(`end-${tag}`);
    });
    await Promise.all([job("whatsapp", "w"), job("facebook", "f")]);
    expect(order.slice(0, 2).sort()).toEqual(["start-f", "start-w"]);
    await m.shutdown();
  });
});

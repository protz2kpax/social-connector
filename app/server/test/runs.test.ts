import { describe, it, expect } from "vitest";
import { RunRegistry } from "../src/runs.js";

describe("RunRegistry", () => {
  it("buffers events and replays them to a late subscriber", () => {
    const r = new RunRegistry();
    const id = r.create();
    r.emit(id, { type: "progress", data: { step: "one" } });
    const seen: any[] = [];
    r.subscribe(id, (e) => seen.push(e));
    expect(seen).toEqual([{ type: "progress", data: { step: "one" } }]);
  });

  it("resolves a pending confirm via decide()", async () => {
    const r = new RunRegistry();
    const id = r.create();
    const p = r.awaitDecision(id, "c1");
    r.decide(id, "c1", true);
    expect(await p).toBe(true);
  });
});

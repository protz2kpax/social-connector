import { randomUUID } from "node:crypto";

export interface RunEvent { type: string; data?: unknown; }
type Listener = (e: RunEvent) => void;

interface Run {
  buffer: RunEvent[];
  listeners: Set<Listener>;
  decisions: Map<string, (v: boolean) => void>;
  done: boolean;
}

export class RunRegistry {
  private runs = new Map<string, Run>();

  create(): string {
    const id = randomUUID();
    this.runs.set(id, { buffer: [], listeners: new Set(), decisions: new Map(), done: false });
    return id;
  }

  emit(id: string, e: RunEvent): void {
    const r = this.runs.get(id); if (!r) return;
    r.buffer.push(e);
    if (e.type === "done" || e.type === "error") r.done = true;
    for (const l of r.listeners) l(e);
  }

  subscribe(id: string, l: Listener): () => void {
    const r = this.runs.get(id); if (!r) return () => {};
    for (const e of r.buffer) l(e); // replay
    if (r.done) return () => {};
    r.listeners.add(l);
    return () => r.listeners.delete(l);
  }

  awaitDecision(id: string, confirmId: string): Promise<boolean> {
    const r = this.runs.get(id);
    if (!r) return Promise.resolve(false);
    return new Promise((resolve) => r.decisions.set(confirmId, resolve));
  }

  decide(id: string, confirmId: string, allow: boolean): void {
    const r = this.runs.get(id); if (!r) return;
    const resolve = r.decisions.get(confirmId);
    if (resolve) { r.decisions.delete(confirmId); resolve(allow); }
  }
}

export const runs = new RunRegistry();

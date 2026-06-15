import { Router } from "express";
import { ensureLoggedIn, type ProviderId } from "social-connector";
import type { ConnectorManager } from "../ConnectorManager.js";
import { runs } from "../runs.js";

const ALL: ProviderId[] = ["facebook", "whatsapp", "linkedin"];
const LABEL: Record<ProviderId, string> = { facebook: "Facebook", whatsapp: "WhatsApp", linkedin: "LinkedIn" };

export function providersRouter(manager: ConnectorManager): Router {
  const r = Router();

  r.get("/providers", async (_req, res) => {
    // Probe providers in parallel — different providers use different browsers.
    const out = await Promise.all(
      ALL.map(async (id) => {
        const loggedIn = await manager
          .run(id, async () => (await manager.get(id)).isLoggedIn())
          .catch(() => false);
        return { id, label: LABEL[id], loggedIn };
      }),
    );
    res.json(out);
  });

  r.post("/login/:provider", (req, res) => {
    const provider = req.params.provider as ProviderId;
    if (!ALL.includes(provider)) return res.status(400).json({ error: "unknown provider" });
    const runId = runs.create();
    res.json({ runId });
    void manager.run(provider, async () => {
      try {
        const c = await ensureLoggedIn((visible) => manager.newConnector(provider, visible), {
          autoLogin: true,
          onStatus: (s) => runs.emit(runId, { type: "progress", data: { status: s } }),
        });
        manager.set(provider, c);
        runs.emit(runId, { type: "done", data: { loggedIn: true } });
      } catch (e) {
        runs.emit(runId, { type: "error", data: { message: (e as Error).message } });
      }
    });
  });

  return r;
}

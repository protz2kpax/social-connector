import { Router } from "express";
import type { ProviderId } from "social-connector";
import type { ConnectorManager } from "../ConnectorManager.js";

/** Parses a query param to a positive integer, falling back on missing/NaN. */
function intParam(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function readRouter(manager: ConnectorManager): Router {
  const r = Router();
  const wa = <T>(fn: (c: any) => Promise<T>) =>
    manager.run("whatsapp", async () => fn(await manager.get("whatsapp")));

  r.get("/groups", async (_req, res) => {
    try { res.json(await wa((c) => c.listGroups({ limit: 0 }))); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  r.get("/chats", async (req, res) => {
    try {
      res.json(await wa((c) => c.listRecentChats({
        limit: intParam(req.query.limit, 20),
        onlyUnread: req.query.unread === "1",
      })));
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  r.get("/conversation", async (req, res) => {
    const chat = String(req.query.chat ?? "");
    if (!chat) return res.status(400).json({ error: "chat required" });
    try {
      const ttl = intParam(req.query.cacheTtl, 0);
      res.json(await wa((c) => c.readConversation({
        chat,
        limit: intParam(req.query.limit, 50),
        since: req.query.since ? String(req.query.since) : undefined,
        cacheMaxAgeMs: ttl > 0 ? ttl * 1000 : undefined,
      })));
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  r.get("/posts", async (req, res) => {
    const provider = String(req.query.provider ?? "facebook") as ProviderId;
    try {
      res.json(await manager.run(provider, async () =>
        (await manager.get(provider)).read({ limit: intParam(req.query.limit, 10) }),
      ));
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  return r;
}

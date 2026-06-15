import { Router } from "express";
import { maskedSettings, saveSettings, type Settings } from "../settings.js";

export function settingsRouter(): Router {
  const r = Router();

  r.get("/settings", (_req, res) => res.json(maskedSettings()));

  r.post("/settings", async (req, res) => {
    const { aiProvider, openaiKey, anthropicKey } = (req.body ?? {}) as Settings;
    if (aiProvider && aiProvider !== "openai" && aiProvider !== "anthropic") {
      return res.status(400).json({ error: "invalid provider" });
    }
    try {
      await saveSettings({ aiProvider, openaiKey, anthropicKey });
      res.json(maskedSettings());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return r;
}

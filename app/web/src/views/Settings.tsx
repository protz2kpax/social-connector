import { useEffect, useState } from "react";
import { getSettings, saveSettings, SettingsView, SettingsPatch } from "../api.js";
import { Button } from "../components/Button.js";
import { Spinner } from "../components/Spinner.js";
import { useToast } from "../components/Toast.js";

type Provider = "openai" | "anthropic";

export function Settings() {
  const { toast } = useToast();
  const [current, setCurrent] = useState<SettingsView | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const s = await getSettings();
      setCurrent(s);
      if (s.aiProvider) setProvider(s.aiProvider);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const patch: SettingsPatch = { aiProvider: provider };
    if (openaiKey.trim()) patch.openaiKey = openaiKey.trim();
    if (anthropicKey.trim()) patch.anthropicKey = anthropicKey.trim();
    try {
      const s = await saveSettings(patch);
      setCurrent(s);
      setOpenaiKey("");
      setAnthropicKey("");
      toast("Settings saved", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 4px" }}>
          AI provider
        </h2>
        <p className="text-muted" style={{ fontSize: 13, margin: "0 0 18px" }}>
          The Assistant uses one of these. Keys are stored locally on this
          machine and never leave it.
        </p>

        <div className="input-label" style={{ marginBottom: 8 }}>Default provider</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <Button
            variant={provider === "openai" ? "primary" : "ghost"}
            onClick={() => setProvider("openai")}
          >
            OpenAI
          </Button>
          <Button
            variant={provider === "anthropic" ? "primary" : "ghost"}
            onClick={() => setProvider("anthropic")}
          >
            Anthropic
          </Button>
        </div>

        <KeyField
          label="OpenAI API key"
          placeholder="sk-..."
          value={openaiKey}
          onChange={setOpenaiKey}
          hint={current?.openai}
        />
        <KeyField
          label="Anthropic API key"
          placeholder="sk-ant-..."
          value={anthropicKey}
          onChange={setAnthropicKey}
          hint={current?.anthropic}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function KeyField({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint: string | null | undefined;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="input-label" style={{ marginBottom: 6 }}>
        {label}
        {hint && (
          <span className="font-mono text-muted" style={{ marginLeft: 8, fontSize: 11 }}>
            current: {hint}
          </span>
        )}
      </div>
      <input
        type="password"
        className="input"
        style={{ width: "100%" }}
        placeholder={hint ? "Leave blank to keep current" : placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

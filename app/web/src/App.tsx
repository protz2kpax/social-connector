import { useState } from "react";
import { Broadcast } from "./views/Broadcast.js";
import { Sessions } from "./views/Sessions.js";
import { Read } from "./views/Read.js";
import { Ai } from "./views/Ai.js";

const TABS = { broadcast: Broadcast, sessions: Sessions, read: Read, ai: Ai } as const;
type Tab = keyof typeof TABS;

export function App() {
  const [tab, setTab] = useState<Tab>("broadcast");
  const View = TABS[tab];
  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 800, margin: "2rem auto" }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} disabled={t === tab}>{t}</button>
        ))}
      </nav>
      <View />
    </div>
  );
}

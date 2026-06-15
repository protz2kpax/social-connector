import { useState } from "react";
import { getJSON } from "../api.js";

export function Read() {
  const [chats, setChats] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadChats() {
    setBusy(true);
    try { setChats(await getJSON("/api/chats?limit=20")); } finally { setBusy(false); }
  }
  async function open(chat: string) {
    setBusy(true);
    try { setMsgs(await getJSON(`/api/conversation?chat=${encodeURIComponent(chat)}&limit=50`)); } finally { setBusy(false); }
  }

  return (
    <div>
      <h2>Read (WhatsApp)</h2>
      <button onClick={loadChats} disabled={busy}>Charger les chats récents</button>
      <div style={{ display: "flex", gap: 16 }}>
        <ul style={{ flex: 1 }}>
          {chats.map((c) => <li key={c.name}><button onClick={() => open(c.name)}>{c.name}</button> <small>{c.time}</small></li>)}
        </ul>
        <div style={{ flex: 1 }}>
          {msgs.map((m, i) => <div key={i}><strong>{m.from}</strong> <small>{m.time}</small><br />{m.text}</div>)}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { subscribeToData, saveData, isConfigured } from "./firebase";

const SOURCES = ["ירדן- לוגיסטיקה", "ירדן- חימוש", "קשר", "לקנות", "תרומה"];
const DESTINATIONS = ["מכולה", "מגן ישי", "בזלת"];

const S = { PENDING: "pending", COLLECTED: "collected", DONE: "done" };

const STATUS_COLORS = {
  [S.PENDING]:   { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  [S.COLLECTED]: { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" },
  [S.DONE]:      { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
};

function statusLabel(status, view, isTask) {
  if (isTask) return status === S.DONE ? "✅ בוצע" : "⏳ ממתין";
  return { [S.PENDING]: "⏳ טרם נאסף", [S.COLLECTED]: "📦 נאסף", [S.DONE]: "✅ בוצע" }[status] || status;
}

function getActions(item, view) {
  const isTask = !item.source && !item.destination;
  if (isTask) {
    return item.status === S.DONE
      ? [{ to: S.PENDING, label: "⏳ ממתין" }]
      : [{ to: S.DONE, label: "✅ בוצע" }];
  }
  if (view === "source") {
    return item.status === S.COLLECTED
      ? [{ to: S.PENDING, label: "⏳ טרם נאסף" }]
      : [{ to: S.COLLECTED, label: "📦 נאסף" }];
  }
  const actions = [];
  if (item.status !== S.PENDING) actions.push({ to: S.PENDING, label: "⏳ טרם נאסף" });
  if (item.status !== S.COLLECTED) actions.push({ to: S.COLLECTED, label: "📦 נאסף" });
  if (item.status !== S.DONE) actions.push({ to: S.DONE, label: "✅ בוצע" });
  return actions;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const formatDate = (ts) => { const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1}`; };
const formatDateTime = (ts) => { const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const isSnoozed = (item) => item.snoozedUntil && item.snoozedUntil > Date.now();
const toDateInputValue = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const INITIAL_DATA = { items: [], sources: SOURCES, destinations: DESTINATIONS };

const FILTERS = {
  source: [
    { key: "all", label: "הכל" },
    { key: S.PENDING, label: "⏳ טרם נאסף" },
    { key: S.COLLECTED, label: "📦 נאסף" },
  ],
  dest: [
    { key: "all", label: "הכל" },
    { key: S.PENDING, label: "⏳ טרם נאסף" },
    { key: S.COLLECTED, label: "📦 נאסף" },
    { key: S.DONE, label: "✅ בוצע" },
  ],
};

// ─── Components ───

function ToggleButtons({ options, value, onChange, color = "#3B82F6" }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(value === o ? "" : o)}
          style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer",
            border: value === o ? `2px solid ${color}` : "2px solid #334155",
            background: value === o ? color + "22" : "#0F172A",
            color: value === o ? color : "#94A3B8",
          }}>
          {o}
        </button>
      ))}
    </div>
  );
}

function SnoozeSheet({ itemName, onSnooze, onClose }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const presets = [
    { label: "מחר", days: 1 },
    { label: "3 ימים", days: 3 },
    { label: "שבוע", days: 7 },
    { label: "שבועיים", days: 14 },
  ];
  const handlePreset = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(8, 0, 0, 0);
    onSnooze(d.getTime());
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "relative", background: "#1E293B", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", direction: "rtl" }}>
        <div style={{ width: 40, height: 4, background: "#475569", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700, margin: "0 0 4px", fontFamily: "system-ui" }}>😴 השהייה</h2>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 16px", fontFamily: "system-ui" }}>{itemName}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {presets.map(p => (
            <button key={p.days} onClick={() => handlePreset(p.days)}
              style={{ flex: "1 1 calc(50% - 4px)", background: "#312E81", color: "#A5B4FC", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
        <label style={labelStyle}>תאריך מותאם</label>
        <input type="date" min={toDateInputValue(tomorrow)}
          onChange={e => { const d = new Date(e.target.value); d.setHours(8, 0, 0, 0); onSnooze(d.getTime()); }}
          style={{ ...inputStyle, marginBottom: 0 }} />
      </div>
    </div>
  );
}

function ItemCard({ item, view, onStatusChange, onDelete, onRequestSnooze }) {
  const isTask = !item.source && !item.destination;
  const snoozed = isSnoozed(item);
  const sc = snoozed ? { bg: "#1E1B4B", text: "#818CF8", border: "#6366F1" } : STATUS_COLORS[item.status];
  const [open, setOpen] = useState(false);
  const actions = getActions(item, view);

  const meta = [];
  meta.push(`נוצר ${formatDateTime(item.created)} ע״י ${item.requester}`);
  if (item.collectedAt) meta.push(`נאסף ${formatDateTime(item.collectedAt)} ע״י ${item.collectedBy}`);
  if (item.doneAt) meta.push(`בוצע ${formatDateTime(item.doneAt)} ע״י ${item.doneBy}`);
  if (snoozed) meta.push(`מושהה עד ${formatDate(item.snoozedUntil)}`);

  return (
    <div style={{ background: "#1E293B", borderRadius: 12, padding: "12px 14px", marginBottom: 8, borderRight: `4px solid ${sc.border}`, opacity: snoozed ? 0.7 : 1 }}
      onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#F1F5F9", fontSize: 15, fontWeight: 600, fontFamily: "system-ui", marginBottom: 4 }}>{item.item}</div>
          <div style={{ color: "#94A3B8", fontSize: 13, fontFamily: "system-ui" }}>
            {item.requester} · {formatDate(item.created)}
          </div>
          {item.note && <div style={{ color: "#F59E0B", fontSize: 12, marginTop: 4, fontFamily: "system-ui" }}>💬 {item.note}</div>}
          {snoozed && <div style={{ color: "#818CF8", fontSize: 12, marginTop: 4, fontFamily: "system-ui" }}>😴 מושהה עד {formatDate(item.snoozedUntil)}</div>}
        </div>
        <div style={{ background: sc.bg, color: sc.text, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "system-ui", whiteSpace: "nowrap", marginRight: 8 }}>
          {snoozed ? "😴 מושהה" : statusLabel(item.status, view, isTask)}
        </div>
      </div>
      {open && (
        <>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #334155" }}>
            {meta.map((m, i) => (
              <div key={i} style={{ color: "#64748B", fontSize: 12, fontFamily: "system-ui", marginBottom: 2 }}>{m}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {actions.map(a => (
              <button key={a.to} onClick={e => { e.stopPropagation(); onStatusChange(item.id, a.to); setOpen(false); }}
                style={{ flex: 1, background: STATUS_COLORS[a.to].bg, color: STATUS_COLORS[a.to].text, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
            {snoozed ? (
              <button onClick={e => { e.stopPropagation(); onRequestSnooze(item.id, null); setOpen(false); }}
                style={{ background: "#312E81", color: "#A5B4FC", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer" }}>
                הסר השהייה
              </button>
            ) : (
              <button onClick={e => { e.stopPropagation(); onRequestSnooze(item.id); }}
                style={{ background: "#312E81", color: "#A5B4FC", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "system-ui", cursor: "pointer" }}>
                😴
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
              style={{ background: "#7F1D1D", color: "#FCA5A5", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "system-ui", cursor: "pointer" }}>
              🗑
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function GroupedView({ items, groupBy, view, onStatusChange, onDelete, onRequestSnooze }) {
  const TASK_LABEL = "📋 משימות";
  const tasks = items.filter(it => !it.source && !it.destination);
  const supply = items.filter(it => it.source || it.destination);
  const groups = {};
  supply.forEach(it => { const k = it[groupBy] || "לא מוגדר"; if (!groups[k]) groups[k] = []; groups[k].push(it); });

  if (!tasks.length && !Object.keys(groups).length)
    return <div style={{ textAlign: "center", color: "#64748B", padding: 40, fontFamily: "system-ui", fontSize: 14 }}>אין פריטים</div>;

  const renderGroup = (label, groupItems) => (
    <div key={label} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "0 4px" }}>
        <span style={{ color: "#E2E8F0", fontSize: 15, fontWeight: 700, fontFamily: "system-ui" }}>{label}</span>
        <span style={{ background: "#334155", color: "#94A3B8", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600, fontFamily: "system-ui" }}>{groupItems.length}</span>
      </div>
      {groupItems.map(it => <ItemCard key={it.id} item={it} view={view} onStatusChange={onStatusChange} onDelete={onDelete} onRequestSnooze={onRequestSnooze} />)}
    </div>
  );

  return (
    <>
      {tasks.length > 0 && renderGroup(TASK_LABEL, tasks)}
      {Object.entries(groups).map(([g, gi]) => renderGroup(g, gi))}
    </>
  );
}

function AddItemSheet({ sources, destinations, onAdd, onClose, userName }) {
  const [item, setItem] = useState("");
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!item.trim()) return;
    onAdd({ id: generateId(), item: item.trim(), source: source || "", destination: dest || "", status: S.PENDING, requester: userName, note: note.trim(), created: Date.now() });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "relative", background: "#1E293B", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", direction: "rtl", maxHeight: "85dvh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#475569", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700, margin: "0 0 16px", fontFamily: "system-ui" }}>פריט חדש</h2>

        <label style={labelStyle}>פריט</label>
        <input value={item} onChange={e => setItem(e.target.value)} placeholder="מה צריך?" style={inputStyle} autoFocus />

        <label style={labelStyle}>מקור (אופציונלי)</label>
        <ToggleButtons options={sources} value={source} onChange={setSource} color="#3B82F6" />
        <div style={{ height: 12 }} />

        <label style={labelStyle}>יעד (אופציונלי)</label>
        <ToggleButtons options={destinations} value={dest} onChange={setDest} color="#10B981" />
        <div style={{ height: 12 }} />

        <label style={labelStyle}>הערות</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="אופציונלי" style={inputStyle} />

        <button onClick={handleSubmit}
          disabled={!item.trim()}
          style={{ ...primaryBtnStyle, width: "100%", marginTop: 8, padding: "14px 0", fontSize: 16, opacity: !item.trim() ? 0.4 : 1 }}>
          {source || dest ? "הוסף דרישה" : "הוסף משימה"}
        </button>
      </div>
    </div>
  );
}

function EditableList({ items, onUpdate, color = "#3B82F6" }) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState("");
  const handleAdd = () => {
    const val = newItem.trim();
    if (!val || items.includes(val)) return;
    onUpdate([...items, val]);
    setNewItem("");
  };
  const startEdit = (i) => { setEditingIndex(i); setEditValue(items[i]); };
  const confirmEdit = () => {
    const val = editValue.trim();
    if (!val || (val !== items[editingIndex] && items.includes(val))) { setEditingIndex(-1); return; }
    onUpdate(items.map((it, i) => i === editingIndex ? val : it));
    setEditingIndex(-1);
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {items.map((item, i) => editingIndex === i ? (
          <div key={i} style={{ display: "flex", gap: 4 }}>
            <input value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIndex(-1); }}
              autoFocus style={{ ...inputStyle, width: 120, marginBottom: 0, padding: "6px 10px", fontSize: 14 }} />
            <button onClick={confirmEdit}
              style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 14, cursor: "pointer" }}>✓</button>
          </div>
        ) : (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: color + "22", border: `1px solid ${color}44`, borderRadius: 20, padding: "6px 8px 6px 14px" }}>
            <span onClick={() => startEdit(i)} style={{ color, fontSize: 14, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer" }}>{item}</span>
            <button onClick={() => onUpdate(items.filter((_, j) => j !== i))}
              style={{ background: "none", border: "none", color: "#EF4444", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          placeholder="הוסף..." style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
        <button onClick={handleAdd} disabled={!newItem.trim()}
          style={{ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 20, fontWeight: 700, cursor: "pointer", opacity: !newItem.trim() ? 0.4 : 1 }}>+</button>
      </div>
    </div>
  );
}

function SettingsSheet({ sources, destinations, onUpdate, onClose }) {
  const [srcList, setSrcList] = useState([...sources]);
  const [dstList, setDstList] = useState([...destinations]);
  const handleSave = () => { onUpdate(srcList, dstList); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "relative", background: "#1E293B", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", direction: "rtl", maxHeight: "85dvh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#475569", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700, margin: "0 0 16px", fontFamily: "system-ui" }}>הגדרות</h2>
        <label style={labelStyle}>מקורות</label>
        <EditableList items={srcList} onUpdate={setSrcList} color="#3B82F6" />
        <label style={labelStyle}>יעדים</label>
        <EditableList items={dstList} onUpdate={setDstList} color="#10B981" />
        <button onClick={handleSave} style={{ ...primaryBtnStyle, width: "100%", marginTop: 8, padding: "14px 0", fontSize: 16 }}>שמור</button>
      </div>
    </div>
  );
}

// ─── Main App ───

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem("logi_user_name") || "");
  const [entered, setEntered] = useState(() => Boolean(localStorage.getItem("logi_user_name")));
  const [data, setData] = useState(null);
  const [view, setView] = useState("source");
  const [statusFilter, setStatusFilter] = useState(S.PENDING);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Firebase realtime subscription — replaces polling
  useEffect(() => {
    if (!entered) return;
    const unsubscribe = subscribeToData((val) => {
      setData(val || INITIAL_DATA);
      setLoading(false);
    });
    return unsubscribe;
  }, [entered]);

  const persist = async (newData) => {
    setData(newData); // optimistic local update
    await saveData(newData); // sync to Firebase
  };

  const handleAddItem = (item) => persist({ ...data, items: [item, ...(data.items || [])] });

  const handleStatusChange = (id, s) => {
    const now = Date.now();
    persist({ ...data, items: (data.items || []).map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, status: s };
      if (s === S.COLLECTED) { updated.collectedAt = now; updated.collectedBy = userName; updated.doneAt = null; updated.doneBy = null; }
      if (s === S.DONE) { updated.doneAt = now; updated.doneBy = userName; }
      if (s === S.PENDING) { updated.collectedAt = null; updated.collectedBy = null; updated.doneAt = null; updated.doneBy = null; }
      return updated;
    })});
  };

  const handleDelete = (id) => persist({ ...data, items: (data.items || []).filter(it => it.id !== id) });
  const [snoozeTarget, setSnoozeTarget] = useState(null); // item id to snooze

  const handleSnooze = (id, until) => {
    persist({ ...data, items: (data.items || []).map(it => it.id !== id ? it : { ...it, snoozedUntil: until }) });
  };
  const handleRequestSnooze = (id, removeUntil) => {
    if (removeUntil === null) { handleSnooze(id, null); return; }
    setSnoozeTarget(id);
  };
  const handleUpdateSettings = (sources, destinations) => persist({ ...data, sources, destinations });

  const [showSnoozed, setShowSnoozed] = useState("hide"); // "hide" | "all" | "only"

  const handleViewChange = (v) => {
    setView(v);
    setStatusFilter(v === "dest" ? S.COLLECTED : S.PENDING);
  };

  if (!entered) {
    return (
      <div style={{ minHeight: "100dvh", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
          <h1 style={{ color: "#F8FAFC", fontSize: 28, fontWeight: 800, margin: "0 0 4px", fontFamily: "system-ui" }}>לוג׳י</h1>
          <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 24px", fontFamily: "system-ui" }}>ניהול לוגיסטיקה פלוגתית</p>
          <input value={userName} onChange={e => setUserName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && userName.trim()) { localStorage.setItem("logi_user_name", userName.trim()); setEntered(true); } }}
            placeholder="השם שלך" style={inputStyle} />
          <button onClick={() => { if (userName.trim()) { localStorage.setItem("logi_user_name", userName.trim()); setEntered(true); } }}
            style={{ ...primaryBtnStyle, width: "100%", padding: "14px 0", fontSize: 16, marginTop: 4 }}>כניסה</button>
        </div>
      </div>
    );
  }

  if (loading || !data)
    return <div style={{ minHeight: "100dvh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontFamily: "system-ui" }}>טוען...</div>;

  const allItems = data.items || [];
  const snoozedCount = allItems.filter(isSnoozed).length;
  const activeItems = showSnoozed === "only"
    ? allItems.filter(isSnoozed)
    : showSnoozed === "all"
    ? allItems
    : allItems.filter(it => !isSnoozed(it));
  const filtered = statusFilter === "all" ? activeItems : activeItems.filter(it => it.status === statusFilter);
  const groupBy = view === "source" ? "source" : "destination";
  const pendingCount = allItems.filter(i => i.status === S.PENDING && !isSnoozed(i)).length;
  const currentFilters = FILTERS[view];

  return (
    <div style={{ minHeight: "100dvh", background: "#0F172A", direction: "rtl", fontFamily: "system-ui" }}>
      <div style={{ background: "#1E293B", padding: "12px 16px", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#F8FAFC", fontSize: 20, fontWeight: 800 }}>📦 לוג׳י</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowSettings(true)} style={iconBtnStyle}>⚙️</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ background: "#422006", padding: "4px 12px", borderRadius: 20, color: "#FBBF24", fontSize: 13, fontWeight: 600 }}>⏳ {pendingCount} ממתינים</div>
          {snoozedCount > 0 && (
            <button onClick={() => setShowSnoozed(s => s === "hide" ? "all" : s === "all" ? "only" : "hide")}
              style={{ background: showSnoozed !== "hide" ? "#4338CA" : "#312E81", padding: "4px 12px", borderRadius: 20, color: "#A5B4FC", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
              😴 {snoozedCount} {showSnoozed === "only" ? "מושהים בלבד" : "מושהים"}
            </button>
          )}
          {!isConfigured && <div style={{ background: "#312E81", padding: "4px 12px", borderRadius: 20, color: "#A5B4FC", fontSize: 13, fontWeight: 600 }}>מצב מקומי</div>}
        </div>
        <div style={{ display: "flex", background: "#0F172A", borderRadius: 10, padding: 3 }}>
          {[{ key: "source", label: "📥 איסוף" }, { key: "dest", label: "📤 חלוקה" }].map(v => (
            <button key={v.key} onClick={() => handleViewChange(v.key)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer",
                background: view === v.key ? "#334155" : "transparent", color: view === v.key ? "#F1F5F9" : "#64748B" }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto" }}>
        {currentFilters.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "system-ui", cursor: "pointer", whiteSpace: "nowrap",
              background: statusFilter === f.key ? "#475569" : "#1E293B", color: statusFilter === f.key ? "#F1F5F9" : "#64748B" }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "4px 16px 100px" }}>
        <GroupedView items={filtered} groupBy={groupBy} view={view} onStatusChange={handleStatusChange} onDelete={handleDelete} onRequestSnooze={handleRequestSnooze} />
      </div>

      <button onClick={() => setShowAdd(true)}
        style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: 56, height: 56, borderRadius: 28, background: "#3B82F6", border: "none", color: "#fff", fontSize: 28, cursor: "pointer", boxShadow: "0 4px 20px rgba(59,130,246,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
        +
      </button>

      {showAdd && <AddItemSheet sources={data.sources || SOURCES} destinations={data.destinations || DESTINATIONS} onAdd={handleAddItem} onClose={() => setShowAdd(false)} userName={userName} />}
      {showSettings && <SettingsSheet sources={data.sources || SOURCES} destinations={data.destinations || DESTINATIONS} onUpdate={handleUpdateSettings} onClose={() => setShowSettings(false)} />}
      {snoozeTarget && <SnoozeSheet
        itemName={(allItems.find(it => it.id === snoozeTarget) || {}).item || ""}
        onSnooze={(until) => { handleSnooze(snoozeTarget, until); setSnoozeTarget(null); }}
        onClose={() => setSnoozeTarget(null)} />}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "12px 14px", background: "#0F172A", border: "1px solid #334155", borderRadius: 10, color: "#F1F5F9", fontSize: 15, fontFamily: "system-ui", outline: "none", marginBottom: 10, boxSizing: "border-box", direction: "rtl" };
const labelStyle = { display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: "system-ui" };
const primaryBtnStyle = { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, fontFamily: "system-ui", cursor: "pointer" };
const iconBtnStyle = { background: "#334155", border: "none", borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

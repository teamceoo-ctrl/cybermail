import { useState, useCallback, useMemo } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Plan = "1month" | "3month" | "6month" | "1year" | "lifetime";
type Tab = "all" | "expiring" | "violations" | "locked";

interface TokenRow {
  id: number;
  token: string;
  label: string;
  plan: Plan;
  expiresAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expired: boolean;
  daysLeft: number | null;
  lockedReason: string | null;
  violationFlag: boolean;
  violationNotes: string | null;
}

const PLAN_LABELS: Record<Plan, string> = { "1month": "1M", "3month": "3M", "6month": "6M", "1year": "1Y", "lifetime": "∞" };
const PLAN_COLORS: Record<Plan, string> = { "1month": "#ff6644", "3month": "#ffaa00", "6month": "#00aaff", "1year": "#aa00ff", "lifetime": "#00ff41" };
const PLAN_FULL: Record<Plan, string> = { "1month": "1 MONTH", "3month": "3 MONTHS", "6month": "6 MONTHS", "1year": "1 YEAR", "lifetime": "LIFETIME" };
const PLAN_DAYS: Record<Plan, string> = { "1month": "30d", "3month": "90d", "6month": "180d", "1year": "365d", "lifetime": "∞" };

function XcrawlLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="96" height="96" rx="8" stroke="#00ff41" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.4" />
      <polygon points="10,10 40,50 10,90 22,90 50,56 78,90 90,90 60,50 90,10 78,10 50,44 22,10" fill="#00ff41" opacity="0.9" />
      <circle cx="50" cy="50" r="6" fill="#001a00" stroke="#00ff41" strokeWidth="2" />
      <circle cx="50" cy="50" r="2.5" fill="#00ff41" />
    </svg>
  );
}

function maskToken(token: string) {
  if (token.length <= 12) return token;
  return token.slice(0, 12) + "••••••••" + token.slice(-4);
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function daysLeftBadge(t: TokenRow) {
  if (t.plan === "lifetime") return null;
  if (t.expired) return { label: "EXPIRED", color: "#ff4444", bg: "#ff000011" };
  if (t.daysLeft !== null && t.daysLeft <= 7) return { label: `${t.daysLeft}d LEFT`, color: "#ff4444", bg: "#ff000011" };
  if (t.daysLeft !== null && t.daysLeft <= 14) return { label: `${t.daysLeft}d LEFT`, color: "#ff8800", bg: "#ff880011" };
  if (t.daysLeft !== null && t.daysLeft <= 30) return { label: `${t.daysLeft}d LEFT`, color: "#ffaa00", bg: "#ffaa0011" };
  return null;
}

function LockModal({ token, onConfirm, onCancel }: { token: TokenRow; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "hsl(140 15% 6%)", border: "1px solid #ff444466", padding: 28, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #ff4444, transparent)" }} />
        <div style={{ fontSize: 11, color: "#ff4444", letterSpacing: 3, marginBottom: 4 }}>⚠ LOCK_ACCOUNT</div>
        <div style={{ fontSize: 13, color: "#00ff41", marginBottom: 16 }}>{token.label}</div>
        <div style={{ fontSize: 10, color: "#00ff4166", letterSpacing: 2, marginBottom: 8 }}>LOCK REASON (REQUIRED)</div>
        <input autoFocus type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Suspicious activity detected"
          style={{ width: "100%", background: "hsl(140 15% 3%)", border: "1px solid #ff444444", color: "#ff4444", fontFamily: "inherit", fontSize: 12, padding: "9px 12px", boxSizing: "border-box", outline: "none", marginBottom: 16 }}
          onKeyDown={e => { if (e.key === "Enter" && reason.trim()) onConfirm(reason.trim()); if (e.key === "Escape") onCancel(); }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #ff4444", color: "#ff4444", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: reason.trim() ? "pointer" : "not-allowed", opacity: reason.trim() ? 1 : 0.4 }}>
            [ LOCK ]
          </button>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #00ff4144", color: "#00ff4188", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function ViolationModal({ token, onConfirm, onClear, onCancel }: { token: TokenRow; onConfirm: (notes: string) => void; onClear: () => void; onCancel: () => void }) {
  const [notes, setNotes] = useState(token.violationNotes ?? "");
  const alreadyFlagged = token.violationFlag;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "hsl(140 15% 6%)", border: "1px solid #aa00ff66", padding: 28, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #aa00ff, transparent)" }} />
        <div style={{ fontSize: 11, color: "#aa00ff", letterSpacing: 3, marginBottom: 4 }}>{alreadyFlagged ? "✦ UPDATE_VIOLATION" : "✦ FLAG_VIOLATION"}</div>
        <div style={{ fontSize: 13, color: "#00ff41", marginBottom: 16 }}>{token.label}</div>
        <div style={{ fontSize: 10, color: "#00ff4166", letterSpacing: 2, marginBottom: 8 }}>VIOLATION DETAILS</div>
        <textarea autoFocus value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the terms violation in detail..." rows={4}
          style={{ width: "100%", background: "hsl(140 15% 3%)", border: "1px solid #aa00ff44", color: "#aa00ff", fontFamily: "inherit", fontSize: 12, padding: "9px 12px", boxSizing: "border-box", outline: "none", marginBottom: 16, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onConfirm(notes.trim())} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #aa00ff", color: "#aa00ff", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer" }}>[ FLAG ]</button>
          {alreadyFlagged && <button onClick={onClear} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #00ff4144", color: "#00ff4188", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>CLEAR FLAG</button>}
          <button onClick={onCancel} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #ffffff22", color: "#ffffff44", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function RenewModal({ token, onConfirm, onCancel }: { token: TokenRow; onConfirm: (plan: Plan) => void; onCancel: () => void }) {
  const [plan, setPlan] = useState<Plan>(token.plan);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "hsl(140 15% 6%)", border: "1px solid #00ff4166", padding: 28, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00ff41, transparent)" }} />
        <div style={{ fontSize: 11, color: "#00ff41", letterSpacing: 3, marginBottom: 4 }}>↑ RENEW_ACCESS</div>
        <div style={{ fontSize: 13, color: "#00ff41", marginBottom: 4 }}>{token.label}</div>
        <div style={{ fontSize: 10, color: "#00ff4155", marginBottom: 20 }}>
          Current: <span style={{ color: PLAN_COLORS[token.plan] }}>{PLAN_FULL[token.plan]}</span>
          {token.expiresAt && <span style={{ color: "#00ff4144" }}> · exp {new Date(token.expiresAt).toLocaleDateString()}</span>}
        </div>
        <div style={{ fontSize: 10, color: "#00ff4166", letterSpacing: 2, marginBottom: 10 }}>SELECT NEW PLAN</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {(["1month", "3month", "6month", "1year", "lifetime"] as Plan[]).map(p => (
            <button key={p} onClick={() => setPlan(p)}
              style={{ padding: "10px 14px", background: plan === p ? `${PLAN_COLORS[p]}22` : "transparent", border: `1px solid ${plan === p ? PLAN_COLORS[p] : PLAN_COLORS[p] + "33"}`, color: PLAN_COLORS[p], fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
              <span>{plan === p ? "▶ " : "  "}{PLAN_FULL[p]}</span>
              <span style={{ color: PLAN_COLORS[p] + "88" }}>{PLAN_DAYS[p]}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#00ff4144", marginBottom: 16, padding: "8px 10px", background: "#00ff4108", border: "1px solid #00ff4122" }}>
          Expiry will reset from today + {PLAN_DAYS[plan]}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onConfirm(plan)} style={{ flex: 1, padding: 10, background: "transparent", border: `1px solid ${PLAN_COLORS[plan]}`, color: PLAN_COLORS[plan], fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer" }}>[ APPLY_RENEWAL ]</button>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid #ffffff22", color: "#ffffff44", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPlan, setNewPlan] = useState<Plan>("3month");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<TokenRow | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Set<number>>(new Set());
  const [lockTarget, setLockTarget] = useState<TokenRow | null>(null);
  const [violationTarget, setViolationTarget] = useState<TokenRow | null>(null);
  const [renewTarget, setRenewTarget] = useState<TokenRow | null>(null);

  const fetchTokens = useCallback(async (s: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/admin/tokens`, { headers: { "x-admin-secret": s } });
      if (!res.ok) { setError("Invalid admin secret"); setUnlocked(false); return; }
      setTokens(await res.json());
      setUnlocked(true);
    } catch { setError("Connection error"); }
    finally { setLoading(false); }
  }, []);

  const patchToken = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/api/admin/tokens/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const updated: TokenRow = await res.json();
    setTokens(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecret(secretInput);
    await fetchTokens(secretInput);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    setCreatedToken(null);
    try {
      const res = await fetch(`${BASE}/api/admin/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ label: newLabel, plan: newPlan, notes: newNotes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setCreatedToken(data);
      setTokens(prev => [data, ...prev]);
      setNewLabel(""); setNewNotes("");
    } catch { setError("Failed to create token"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this token? The user will lose access immediately.")) return;
    await fetch(`${BASE}/api/admin/tokens/${id}`, { method: "DELETE", headers: { "x-admin-secret": secret } });
    setTokens(prev => prev.filter(t => t.id !== id));
  };

  const handleLockConfirm = async (reason: string) => {
    if (!lockTarget) return;
    await patchToken(lockTarget.id, { isActive: false, lockedReason: reason });
    setLockTarget(null);
  };

  const handleUnlock2 = async (t: TokenRow) => {
    await patchToken(t.id, { isActive: true, lockedReason: null });
  };

  const handleViolationConfirm = async (notes: string) => {
    if (!violationTarget) return;
    await patchToken(violationTarget.id, { violationFlag: true, violationNotes: notes || null });
    setViolationTarget(null);
  };

  const handleViolationClear = async () => {
    if (!violationTarget) return;
    await patchToken(violationTarget.id, { violationFlag: false, violationNotes: null });
    setViolationTarget(null);
  };

  const handleRenewConfirm = async (plan: Plan) => {
    if (!renewTarget) return;
    await patchToken(renewTarget.id, { plan, renewExpiry: true });
    setRenewTarget(null);
  };

  const copyToken = (id: number, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const total = tokens.length;
    const active = tokens.filter(t => t.isActive && !t.expired).length;
    const locked = tokens.filter(t => !t.isActive).length;
    const expiring = tokens.filter(t => t.isActive && !t.expired && t.daysLeft !== null && t.daysLeft <= 14).length;
    const violations = tokens.filter(t => t.violationFlag).length;
    const lifetime = tokens.filter(t => t.plan === "lifetime").length;
    return { total, active, locked, expiring, violations, lifetime };
  }, [tokens]);

  const planBreakdown = useMemo(() => {
    const counts: Record<Plan, number> = { "1month": 0, "3month": 0, "6month": 0, "1year": 0, "lifetime": 0 };
    tokens.forEach(t => { counts[t.plan] = (counts[t.plan] || 0) + 1; });
    return counts;
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    let list = tokens;
    switch (activeTab) {
      case "expiring": list = tokens.filter(t => t.isActive && !t.expired && t.daysLeft !== null && t.daysLeft <= 30).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)); break;
      case "violations": list = tokens.filter(t => t.violationFlag); break;
      case "locked": list = tokens.filter(t => !t.isActive); break;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.label.toLowerCase().includes(q) || t.token.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tokens, activeTab, search]);

  const baseStyle: React.CSSProperties = { minHeight: "100vh", background: "hsl(140 15% 4%)", fontFamily: "'Fira Code', 'Courier New', monospace", color: "#00ff41" };
  const inputStyle: React.CSSProperties = { background: "hsl(140 15% 3%)", border: "1px solid #00ff4144", color: "#00ff41", fontFamily: "inherit", fontSize: 12, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "#00ff4199", letterSpacing: 2, marginBottom: 6, display: "block" };

  if (!unlocked) {
    return (
      <div style={baseStyle}>
        <style>{`.adm-btn:hover { background: #00ff41 !important; color: #001a00 !important; } .adm-input:focus { border-color: #00ff41 !important; box-shadow: 0 0 10px #00ff4133; }`}</style>
        <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(#00ff4106 1px, transparent 1px), linear-gradient(90deg, #00ff4106 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 400, background: "hsl(140 15% 6%)", border: "1px solid #00ff4133", padding: "36px 32px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00ff41, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <XcrawlLogo size={40} />
              <div>
                <div style={{ fontSize: 10, color: "#00ff4166", letterSpacing: 3 }}>XCRAWL SYSTEMS</div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textShadow: "0 0 10px #00ff4166" }}>ADMIN_PANEL</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#00ff4155", letterSpacing: 2, marginBottom: 20, borderBottom: "1px solid #00ff4122", paddingBottom: 10 }}>
              RESTRICTED_ACCESS :: AUTHORIZED_PERSONNEL_ONLY
            </div>
            <form onSubmit={handleUnlock}>
              <label style={labelStyle}>{`>`} ADMIN SECRET</label>
              <input className="adm-input" type="password" value={secretInput} onChange={e => setSecretInput(e.target.value)} placeholder="Enter admin secret..." style={inputStyle} />
              {error && <div style={{ fontSize: 11, color: "#ff4444", marginTop: 10, padding: "6px 10px", background: "#ff000011", border: "1px solid #ff444433" }}>⚠ {error.toUpperCase()}</div>}
              <button type="submit" disabled={loading} className="adm-btn" style={{ marginTop: 16, width: "100%", padding: 12, background: "transparent", border: "1px solid #00ff41", color: "#00ff41", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 3, cursor: "pointer", transition: "all 0.2s" }}>
                {loading ? "AUTHENTICATING..." : "[ UNLOCK PANEL ]"}
              </button>
            </form>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <a href="/" style={{ fontSize: 10, color: "#00ff4133", letterSpacing: 2, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#00ff4188")}
                onMouseLeave={e => (e.currentTarget.style.color = "#00ff4133")}>
                ← BACK_TO_LOGIN
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; count: number; color: string }[] = [
    { id: "all", label: "ALL_USERS", count: stats.total, color: "#00ff41" },
    { id: "expiring", label: "EXPIRING", count: stats.expiring, color: "#ffaa00" },
    { id: "violations", label: "VIOLATIONS", count: stats.violations, color: "#aa00ff" },
    { id: "locked", label: "LOCKED", count: stats.locked, color: "#ff4444" },
  ];

  return (
    <div style={baseStyle}>
      <style>{`
        .adm-btn:hover { background: #00ff41 !important; color: #001a00 !important; }
        .adm-input:focus { border-color: #00ff41 !important; box-shadow: 0 0 10px #00ff4133; }
        .adm-select:focus { border-color: #00ff41 !important; }
        .tok-row:hover { background: #00ff4106 !important; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .created-banner { animation: fadeIn 0.3s ease; }
        .stat-card:hover { border-color: #00ff4144 !important; }
        .tab-btn:hover { opacity: 1 !important; }
        .action-btn:hover { opacity: 0.65 !important; }
        .plan-btn:hover { opacity: 1 !important; }
        .search-input:focus { border-color: #00ff4188 !important; }
      `}</style>

      {lockTarget && <LockModal token={lockTarget} onConfirm={handleLockConfirm} onCancel={() => setLockTarget(null)} />}
      {violationTarget && <ViolationModal token={violationTarget} onConfirm={handleViolationConfirm} onClear={handleViolationClear} onCancel={() => setViolationTarget(null)} />}
      {renewTarget && <RenewModal token={renewTarget} onConfirm={handleRenewConfirm} onCancel={() => setRenewTarget(null)} />}

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "hsl(140 15% 5%)", borderBottom: "1px solid #00ff4122", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <XcrawlLogo size={26} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>CYBER_MAIL</span>
          <span style={{ fontSize: 10, color: "#00ff4444", letterSpacing: 2 }}>/ ADMIN_PANEL</span>
          <span style={{ fontSize: 9, color: "#00ff4122", marginLeft: 8, letterSpacing: 1 }}>
            {stats.active} ACTIVE · {stats.total} TOTAL
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => fetchTokens(secret)} style={{ background: "transparent", border: "none", color: "#00ff4155", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, cursor: "pointer", padding: "4px 8px" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00ff41")} onMouseLeave={e => (e.currentTarget.style.color = "#00ff4155")}>⟳ SYNC</button>
          <a href="/" style={{ fontSize: 10, color: "#00ff4444", letterSpacing: 2, textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00ff41")} onMouseLeave={e => (e.currentTarget.style.color = "#00ff4444")}>← USER_LOGIN</a>
          <button onClick={() => setUnlocked(false)} style={{ background: "transparent", border: "1px solid #ff444444", color: "#ff4444", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, padding: "4px 10px", cursor: "pointer" }}>LOCK</button>
        </div>
      </div>

      <div style={{ padding: "72px 24px 40px", maxWidth: 1280, margin: "0 auto" }}>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "TOTAL", value: stats.total, color: "#00ff41" },
            { label: "ACTIVE", value: stats.active, color: "#00ff41" },
            { label: "LIFETIME", value: stats.lifetime, color: "#00ff41" },
            { label: "EXPIRING", value: stats.expiring, color: "#ffaa00" },
            { label: "VIOLATIONS", value: stats.violations, color: "#aa00ff" },
            { label: "LOCKED", value: stats.locked, color: "#ff4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ background: "hsl(140 15% 6%)", border: `1px solid ${color}22`, padding: "12px 14px", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 8, color: `${color}88`, letterSpacing: 2, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* New token success banner */}
        {createdToken && (
          <div className="created-banner" style={{ marginBottom: 16, padding: "14px 18px", background: "#00ff4111", border: "1px solid #00ff4166", borderLeft: "4px solid #00ff41" }}>
            <div style={{ fontSize: 10, color: "#00ff4199", letterSpacing: 2, marginBottom: 6 }}>✓ TOKEN_ISSUED — SEND THIS TO THE USER IMMEDIATELY</div>
            <div style={{ fontSize: 12, color: "#00ff41", letterSpacing: 1, wordBreak: "break-all", marginBottom: 10, padding: "8px 10px", background: "#001a00", border: "1px solid #00ff4133" }}>
              {createdToken.token}
            </div>
            <div style={{ fontSize: 10, color: "#00ff4166", marginBottom: 10 }}>
              USER: {createdToken.label} · PLAN: {PLAN_FULL[createdToken.plan]}
              {createdToken.expiresAt && ` · EXPIRES: ${new Date(createdToken.expiresAt).toLocaleDateString()}`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => copyToken(createdToken.id, createdToken.token)}
                style={{ background: copiedId === createdToken.id ? "#00ff41" : "transparent", border: "1px solid #00ff41", color: copiedId === createdToken.id ? "#001a00" : "#00ff41", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, padding: "5px 14px", cursor: "pointer", transition: "all 0.2s" }}>
                {copiedId === createdToken.id ? "✓ COPIED" : "COPY TOKEN"}
              </button>
              <button onClick={() => setCreatedToken(null)} style={{ background: "transparent", border: "1px solid #00ff4144", color: "#00ff4188", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, padding: "5px 14px", cursor: "pointer" }}>DISMISS</button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>

          {/* Left: user table */}
          <div>
            {/* Tab bar + search */}
            <div style={{ display: "flex", borderBottom: "1px solid #00ff4122", marginBottom: 0, alignItems: "stretch" }}>
              {TABS.map(tab => (
                <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)}
                  style={{ background: "transparent", border: "none", borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : "2px solid transparent", color: activeTab === tab.id ? tab.color : "#00ff4144", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, padding: "10px 14px", cursor: "pointer", opacity: activeTab === tab.id ? 1 : 0.7, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
                  {tab.label}
                  {tab.count > 0 && <span style={{ fontSize: 9, background: `${tab.color}22`, color: tab.color, border: `1px solid ${tab.color}44`, padding: "1px 5px" }}>{tab.count}</span>}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", gap: 8 }}>
                <input className="search-input" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..." style={{ background: "hsl(140 15% 3%)", border: "1px solid #00ff4122", color: "#00ff41", fontFamily: "inherit", fontSize: 10, padding: "5px 10px", outline: "none", width: 160, letterSpacing: 1, transition: "border-color 0.2s" }} />
              </div>
            </div>

            <div style={{ background: "hsl(140 15% 6%)", border: "1px solid #00ff4122", borderTop: "none" }}>
              {filteredTokens.length === 0 && (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#00ff4133", fontSize: 11, letterSpacing: 2 }}>
                  {search ? `NO RESULTS FOR "${search.toUpperCase()}"` : activeTab === "all" ? "NO_USERS_YET — ISSUE THE FIRST TOKEN →" : `NO_${activeTab.toUpperCase()}_USERS`}
                </div>
              )}

              {filteredTokens.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #00ff4122" }}>
                        {["USER / TOKEN", "PLAN", "EXPIRES", "STATUS", "LAST_SEEN", "FLAGS", "ACTIONS"].map(h => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: "#00ff4155", letterSpacing: 2, fontWeight: 400, fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map(t => {
                        const isLocked = !t.isActive;
                        const badge = daysLeftBadge(t);
                        const statusColor = isLocked ? "#ff4444" : t.expired ? "#ff444488" : "#00ff41";
                        const statusLabel = isLocked ? "LOCKED" : t.expired ? "EXPIRED" : "ACTIVE";
                        const revealed = revealedTokens.has(t.id);
                        const isCopied = copiedId === t.id;
                        return (
                          <tr key={t.id} className="tok-row" style={{ borderBottom: "1px solid #00ff410a", transition: "background 0.15s" }}>

                            <td style={{ padding: "10px 12px", maxWidth: 200 }}>
                              <div style={{ color: "#00ff41", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{t.label}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                <span style={{ color: "#00ff4133", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}
                                  onClick={() => setRevealedTokens(prev => { const s = new Set(prev); s.has(t.id) ? s.delete(t.id) : s.add(t.id); return s; })}>
                                  {revealed ? t.token : maskToken(t.token)}
                                </span>
                                <span onClick={() => copyToken(t.id, t.token)} title="Copy token"
                                  style={{ fontSize: 8, color: isCopied ? "#00ff41" : "#00ff4144", cursor: "pointer", letterSpacing: 1, transition: "color 0.2s" }}>
                                  {isCopied ? "✓COPIED" : "COPY"}
                                </span>
                              </div>
                              {t.notes && <div style={{ fontSize: 9, color: "#00ff4133", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes}</div>}
                            </td>

                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: 9, letterSpacing: 1, padding: "2px 7px", border: `1px solid ${PLAN_COLORS[t.plan]}44`, color: PLAN_COLORS[t.plan], background: `${PLAN_COLORS[t.plan]}11`, whiteSpace: "nowrap" }}>
                                {PLAN_LABELS[t.plan]} · {PLAN_FULL[t.plan]}
                              </span>
                            </td>

                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {t.expiresAt ? (
                                <div>
                                  <div style={{ fontSize: 10, color: "#00ff4166" }}>{new Date(t.expiresAt).toLocaleDateString()}</div>
                                  {badge && <div style={{ fontSize: 9, color: badge.color, background: badge.bg, padding: "1px 5px", marginTop: 2, letterSpacing: 1, display: "inline-block" }}>{badge.label}</div>}
                                </div>
                              ) : (
                                <span style={{ fontSize: 10, color: "#00ff4155" }}>∞ NEVER</span>
                              )}
                            </td>

                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, letterSpacing: 1, color: statusColor, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor, display: "inline-block", boxShadow: statusLabel === "ACTIVE" ? `0 0 5px ${statusColor}` : "none" }} />
                                {statusLabel}
                              </div>
                              {isLocked && t.lockedReason && (
                                <div style={{ fontSize: 8, color: "#ff444488", marginTop: 3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.lockedReason}>
                                  {t.lockedReason}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: "10px 12px", color: "#00ff4155", whiteSpace: "nowrap", fontSize: 9 }}>
                              {relativeTime(t.lastSeenAt)}
                            </td>

                            <td style={{ padding: "10px 12px" }}>
                              {t.violationFlag ? (
                                <div>
                                  <span style={{ fontSize: 9, color: "#aa00ff", letterSpacing: 1, cursor: "pointer" }} onClick={() => setViolationTarget(t)}>✦ VIOLATION</span>
                                  {t.violationNotes && (
                                    <div style={{ fontSize: 8, color: "#aa00ff88", marginTop: 2, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.violationNotes}>
                                      {t.violationNotes}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: 9, color: "#00ff4122" }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {/* Renew */}
                                <button className="action-btn" onClick={() => setRenewTarget(t)} title="Renew / change plan"
                                  style={{ background: "none", border: "none", color: "#00ff4166", cursor: "pointer", fontSize: 13, padding: 0, opacity: 1, transition: "opacity 0.15s" }}>↑</button>
                                {/* Lock/Unlock */}
                                {isLocked ? (
                                  <button className="action-btn" onClick={() => handleUnlock2(t)} title="Unlock account"
                                    style={{ background: "none", border: "none", color: "#00ff41", cursor: "pointer", fontSize: 13, padding: 0, opacity: 1, transition: "opacity 0.15s" }}>↻</button>
                                ) : (
                                  <button className="action-btn" onClick={() => setLockTarget(t)} title="Lock account"
                                    style={{ background: "none", border: "none", color: "#ff8800", cursor: "pointer", fontSize: 13, padding: 0, opacity: 1, transition: "opacity 0.15s" }}>⊘</button>
                                )}
                                {/* Violation flag */}
                                <button className="action-btn" onClick={() => setViolationTarget(t)} title={t.violationFlag ? "Edit violation flag" : "Flag for violation"}
                                  style={{ background: "none", border: "none", color: t.violationFlag ? "#aa00ff" : "#aa00ff44", cursor: "pointer", fontSize: 12, padding: 0, opacity: 1, transition: "opacity 0.15s" }}>✦</button>
                                {/* Delete */}
                                <button className="action-btn" onClick={() => handleDelete(t.id)} title="Delete permanently"
                                  style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", fontSize: 13, padding: 0, opacity: 1, transition: "opacity 0.15s" }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredTokens.length > 0 && (
                <div style={{ padding: "8px 14px", borderTop: "1px solid #00ff410a", fontSize: 9, color: "#00ff4133", letterSpacing: 1, display: "flex", justifyContent: "space-between" }}>
                  <span>SHOWING {filteredTokens.length} OF {tokens.length} USERS{search ? ` — FILTERED BY "${search.toUpperCase()}"` : ""}</span>
                  <span>↑ RENEW · ⊘ LOCK · ✦ FLAG · ✕ DELETE</span>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Issue new token */}
            <div style={{ background: "hsl(140 15% 6%)", border: "1px solid #00ff4122" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid #00ff4122", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: 3, color: "#00ff41" }}>+ ISSUE_TOKEN</span>
              </div>
              <form onSubmit={handleCreate} style={{ padding: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{`>`} LABEL</label>
                  <input className="adm-input" type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="email@domain.com" style={inputStyle} required />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{`>`} PLAN</label>
                  <select className="adm-select" value={newPlan} onChange={e => setNewPlan(e.target.value as Plan)} style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}>
                    <option value="1month">1 MONTH (30d)</option>
                    <option value="3month">3 MONTHS (90d)</option>
                    <option value="6month">6 MONTHS (180d)</option>
                    <option value="1year">1 YEAR (365d)</option>
                    <option value="lifetime">LIFETIME (∞)</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{`>`} NOTES</label>
                  <input className="adm-input" type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Invoice #, company..." style={inputStyle} />
                </div>
                {error && <div style={{ fontSize: 10, color: "#ff4444", marginBottom: 10, padding: "5px 8px", background: "#ff000011", border: "1px solid #ff444433" }}>⚠ {error.toUpperCase()}</div>}
                <button type="submit" disabled={creating} className="adm-btn" style={{ width: "100%", padding: 10, background: "transparent", border: "1px solid #00ff41", color: "#00ff41", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer", transition: "all 0.2s" }}>
                  {creating ? "GENERATING..." : "[ GENERATE ]"}
                </button>
              </form>
            </div>

            {/* Plan breakdown */}
            <div style={{ background: "hsl(140 15% 6%)", border: "1px solid #00ff4122", padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "#00ff4155", letterSpacing: 2, marginBottom: 12 }}>PLAN_BREAKDOWN</div>
              {(["1month", "3month", "6month", "1year", "lifetime"] as Plan[]).map(p => {
                const count = planBreakdown[p];
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={p} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10 }}>
                      <span style={{ color: PLAN_COLORS[p], letterSpacing: 1 }}>{PLAN_FULL[p]}</span>
                      <span style={{ color: "#00ff4155" }}>{count} · {PLAN_DAYS[p]}</span>
                    </div>
                    <div style={{ height: 3, background: "#00ff410a", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: PLAN_COLORS[p], borderRadius: 2, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expiry thresholds */}
            <div style={{ background: "hsl(140 15% 6%)", border: "1px solid #ffaa0022", padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "#ffaa0066", letterSpacing: 2, marginBottom: 10 }}>⚠ EXPIRY_ALERTS</div>
              {[
                { label: "CRITICAL", days: "≤ 7 days", color: "#ff4444" },
                { label: "WARNING", days: "≤ 14 days", color: "#ff8800" },
                { label: "NOTICE", days: "≤ 30 days", color: "#ffaa00" },
              ].map(({ label, days, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10 }}>
                  <span style={{ color, letterSpacing: 1 }}>{label}</span>
                  <span style={{ color: "#00ff4144" }}>{days}</span>
                </div>
              ))}
            </div>

            {/* Quick guide */}
            <div style={{ background: "hsl(140 15% 6%)", border: "1px solid #aa00ff22", padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "#aa00ff66", letterSpacing: 2, marginBottom: 10 }}>QUICK_GUIDE</div>
              <div style={{ fontSize: 10, color: "#00ff4144", lineHeight: 1.8 }}>
                <div><span style={{ color: "#00ff4188" }}>↑</span> Renew / change plan</div>
                <div><span style={{ color: "#ff8800" }}>⊘</span> Lock with reason</div>
                <div><span style={{ color: "#00ff4188" }}>↻</span> Unlock account</div>
                <div><span style={{ color: "#aa00ff" }}>✦</span> Flag terms violation</div>
                <div><span style={{ color: "#ff4444" }}>✕</span> Delete permanently</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

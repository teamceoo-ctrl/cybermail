import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Plus, Trash2, CheckCircle, XCircle, Loader2, RefreshCw, Star, Send, Info } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { usePhoneValidation } from "@/hooks/use-phone-validation";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const SMS_GATEWAYS = [
  { label: "Verizon", value: "vtext.com" },
  { label: "AT&T", value: "txt.att.net" },
  { label: "T-Mobile", value: "tmomail.net" },
  { label: "Sprint", value: "messaging.sprintpcs.com" },
  { label: "US Cellular", value: "email.uscc.net" },
  { label: "Metro PCS", value: "mymetropcs.com" },
  { label: "Boost Mobile", value: "sms.myboostmobile.com" },
  { label: "Cricket", value: "sms.cricketwireless.net" },
  { label: "Custom…", value: "_custom" },
];

interface SmtpOption { id: number; name: string; fromEmail: string; status: string; }

interface MessagingProfile {
  id: number;
  name: string;
  channel: "sms" | "whatsapp";
  smtpProfileId?: number;
  gateway: string;
  dailyLimit?: number;
  status: "unverified" | "verified" | "failed";
  isDefault: boolean;
  createdAt: string;
}

const emptyForm = {
  name: "",
  channel: "sms" as "sms" | "whatsapp",
  smtpProfileId: "",
  gatewayPreset: "vtext.com",
  gatewayCustom: "",
  dailyLimit: "",
  isDefault: false,
};

export default function MessagingProfiles() {
  const [profiles, setProfiles] = useState<MessagingProfile[]>([]);
  const [smtpOptions, setSmtpOptions] = useState<SmtpOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testProfileId, setTestProfileId] = useState<number | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetch(`${BASE}/api/messaging-profiles`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BASE}/api/smtp-profiles-list`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      setProfiles(Array.isArray(p) ? p : []);
      setSmtpOptions(Array.isArray(s) ? s : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const effectiveGateway = (f: typeof form) =>
    f.gatewayPreset === "_custom" ? f.gatewayCustom : f.gatewayPreset;

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: MessagingProfile) => {
    const knownPreset = SMS_GATEWAYS.find((g) => g.value === p.gateway && g.value !== "_custom");
    setEditId(p.id);
    setForm({
      name: p.name,
      channel: p.channel,
      smtpProfileId: p.smtpProfileId ? String(p.smtpProfileId) : "",
      gatewayPreset: knownPreset ? knownPreset.value : "_custom",
      gatewayCustom: knownPreset ? "" : p.gateway,
      dailyLimit: p.dailyLimit?.toString() ?? "",
      isDefault: p.isDefault,
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const gateway = effectiveGateway(form);
      const body = {
        name: form.name,
        channel: form.channel,
        smtpProfileId: form.smtpProfileId ? Number(form.smtpProfileId) : null,
        gateway,
        dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : null,
        isDefault: form.isDefault,
      };
      const url = editId ? `${BASE}/api/messaging-profiles/${editId}` : `${BASE}/api/messaging-profiles`;
      const method = editId ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { setOpen(false); load(); }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this messaging profile?")) return;
    await fetch(`${BASE}/api/messaging-profiles/${id}`, { method: "DELETE" });
    load();
  };

  const verify = async (id: number) => {
    setVerifying(id);
    try {
      const r = await fetch(`${BASE}/api/messaging-profiles/${id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await r.json();
      load();
      if (!r.ok) alert(`Verification failed: ${data.error}`);
    } finally {
      setVerifying(null);
    }
  };

  const sendTest = async () => {
    if (!testProfileId || !testNumber) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const r = await fetch(`${BASE}/api/messaging-profiles/${testProfileId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testTo: testNumber }),
      });
      const data = await r.json();
      setTestResult({ ok: r.ok, msg: r.ok ? `Sent → ${data.sentTo}` : data.error });
      if (r.ok) load();
    } finally {
      setSendingTest(false);
    }
  };

  const smsProfiles = profiles.filter((p) => p.channel === "sms");
  const waProfiles = profiles.filter((p) => p.channel === "whatsapp");

  const selectedTestProfile = profiles.find((p) => p.id === testProfileId);
  const testPhoneValidation = usePhoneValidation(testNumber, selectedTestProfile?.gateway);

  const smtpName = (id?: number) => id ? (smtpOptions.find((s) => s.id === id)?.name ?? `SMTP #${id}`) : "—";

  const StatusIcon = ({ status }: { status: string }) =>
    status === "verified" ? <CheckCircle className="h-4 w-4 text-primary" /> :
    status === "failed" ? <XCircle className="h-4 w-4 text-red-500" /> :
    <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Smartphone className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-primary tracking-wider">MESSAGING_PROFILES</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">SMTP-powered SMS and WhatsApp via carrier email gateways</p>
          </div>
        </div>
        <Button onClick={openNew} className="font-mono gap-2">
          <Plus className="h-4 w-4" /> ADD_PROFILE
        </Button>
      </div>

      {/* Info banner */}
      <div className="terminal-panel p-3 flex items-start gap-3 border border-primary/10 bg-primary/3">
        <Info className="h-4 w-4 text-primary/60 mt-0.5 shrink-0" />
        <div className="font-mono text-[10px] text-muted-foreground/70 space-y-0.5">
          <p><span className="text-primary/80">SMS:</span> Messages are sent via email-to-SMS carrier gateways — select your carrier below. No SIM card or Twilio account needed.</p>
          <p><span className="text-primary/80">WhatsApp:</span> Enter your WhatsApp SMTP relay gateway domain (e.g. a self-hosted WAHA instance or enterprise gateway).</p>
          <p className="text-muted-foreground/40">Contacts must have a phone number stored. The SMTP profile you pick is used as the sending server.</p>
        </div>
      </div>

      {/* Quick test panel */}
      <div className="terminal-panel p-4 space-y-3">
        <p className="font-mono text-xs text-primary/70 tracking-widest border-b border-border/40 pb-2">{'>'} QUICK_TEST_SEND</p>
        <div className="flex gap-3 flex-wrap items-start">
          <Select value={testProfileId ? String(testProfileId) : ""} onValueChange={(v) => setTestProfileId(Number(v))}>
            <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 w-52 h-9">
              <SelectValue placeholder="Select profile…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={String(p.id)} className="font-mono text-xs">
                  {p.channel === "whatsapp" ? "💬" : "📱"} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1 min-w-48">
            <PhoneInput
              value={testNumber}
              onChange={setTestNumber}
              gateway={selectedTestProfile?.gateway}
              placeholder="Phone number (e.g. 4155552671)"
            />
          </div>
          <Button
            variant="outline"
            className="font-mono border-primary/40 text-primary hover:bg-primary/10 gap-2 h-9"
            onClick={sendTest}
            disabled={sendingTest || !testProfileId || testPhoneValidation.state !== "valid"}
          >
            {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            SEND_TEST
          </Button>
        </div>
        {testResult && (
          <div className={`text-xs font-mono px-3 py-2 rounded border ${testResult.ok ? "text-primary border-primary/20 bg-primary/5" : "text-red-400 border-red-500/20 bg-red-500/5"}`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}
      </div>

      {loading ? (
        <div className="terminal-panel p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="terminal-panel p-12 text-center">
          <Smartphone className="h-12 w-12 text-primary/20 mx-auto mb-4" />
          <p className="font-mono text-muted-foreground/60">No messaging profiles yet.</p>
          <p className="font-mono text-xs text-muted-foreground/40 mt-1">Add a profile to start sending SMS and WhatsApp campaigns via your SMTP server.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[{ label: "SMS_PROFILES", icon: "📱", data: smsProfiles }, { label: "WHATSAPP_PROFILES", icon: "💬", data: waProfiles }].map(({ label, icon, data }) => data.length > 0 && (
            <div key={label}>
              <p className="font-mono text-[10px] text-muted-foreground/60 tracking-widest mb-2">{icon} {label}</p>
              <div className="space-y-2">
                {data.map((p) => (
                  <div key={p.id} className="terminal-panel p-4 flex items-center gap-4">
                    <StatusIcon status={p.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-foreground">{p.name}</span>
                        {p.isDefault && <Badge className="text-[9px] font-mono bg-primary/20 text-primary border-primary/30 px-1.5 py-0"><Star className="h-2.5 w-2.5 inline mr-0.5" />DEFAULT</Badge>}
                        <Badge variant="outline" className={`text-[9px] font-mono px-1.5 py-0 ${
                          p.status === "verified" ? "border-primary/30 text-primary" :
                          p.status === "failed" ? "border-red-500/30 text-red-400" :
                          "border-muted-foreground/30 text-muted-foreground"
                        }`}>{p.status.toUpperCase()}</Badge>
                      </div>
                      <div className="flex gap-4 mt-1 flex-wrap">
                        <span className="font-mono text-[10px] text-muted-foreground/70">gateway: <span className="text-primary/70">{p.gateway}</span></span>
                        <span className="font-mono text-[10px] text-muted-foreground/50">smtp: {smtpName(p.smtpProfileId ?? undefined)}</span>
                        {p.dailyLimit && <span className="font-mono text-[10px] text-muted-foreground/40">limit: {p.dailyLimit}/day</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="font-mono text-[10px] border-border/40 h-7 px-2 gap-1"
                        onClick={() => verify(p.id)} disabled={verifying === p.id}>
                        {verifying === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        VERIFY
                      </Button>
                      <Button variant="outline" size="sm" className="font-mono text-[10px] border-border/40 h-7 px-2"
                        onClick={() => openEdit(p)}>EDIT</Button>
                      <Button variant="outline" size="sm" className="font-mono text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2"
                        onClick={() => del(p.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary tracking-wider">
              {editId ? "EDIT_PROFILE" : "ADD_MESSAGING_PROFILE"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">PROFILE_NAME</label>
                <Input className="font-mono text-xs bg-background/50 border-border/60" placeholder="Verizon SMS" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CHANNEL</label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v as "sms" | "whatsapp", gatewayPreset: v === "sms" ? "vtext.com" : "_custom" }))}>
                  <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms" className="font-mono text-xs">📱 SMS</SelectItem>
                    <SelectItem value="whatsapp" className="font-mono text-xs">💬 WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">SMTP_PROFILE</label>
              <Select value={form.smtpProfileId} onValueChange={(v) => setForm((f) => ({ ...f, smtpProfileId: v }))}>
                <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 h-9">
                  <SelectValue placeholder="Select SMTP profile…" />
                </SelectTrigger>
                <SelectContent>
                  {smtpOptions.length === 0 && <SelectItem value="none" disabled className="font-mono text-xs text-muted-foreground">No SMTP profiles configured</SelectItem>}
                  {smtpOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="font-mono text-xs">
                      {s.name} <span className="text-muted-foreground ml-1">({s.fromEmail})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground/50">This SMTP server sends the messages to the carrier gateway.</p>
            </div>

            {form.channel === "sms" ? (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CARRIER_GATEWAY</label>
                <Select value={form.gatewayPreset} onValueChange={(v) => setForm((f) => ({ ...f, gatewayPreset: v }))}>
                  <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SMS_GATEWAYS.map((g) => (
                      <SelectItem key={g.value} value={g.value} className="font-mono text-xs">
                        {g.label}{g.value !== "_custom" ? <span className="text-muted-foreground ml-2">@{g.value}</span> : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.gatewayPreset === "_custom" && (
                  <Input className="font-mono text-xs bg-background/50 border-border/60 mt-1" placeholder="gateway.example.com" value={form.gatewayCustom} onChange={(e) => setForm((f) => ({ ...f, gatewayCustom: e.target.value }))} />
                )}
                <p className="text-[9px] text-muted-foreground/40">Phone digits will be sent to <span className="text-primary/60">{"{digits}"}@{effectiveGateway(form) || "…"}</span></p>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">WHATSAPP_GATEWAY_DOMAIN</label>
                <Input className="font-mono text-xs bg-background/50 border-border/60" placeholder="your-waha-instance.com" value={form.gatewayCustom} onChange={(e) => setForm((f) => ({ ...f, gatewayCustom: e.target.value }))} />
                <p className="text-[9px] text-muted-foreground/50">The domain of your WhatsApp SMTP relay (e.g. self-hosted WAHA or enterprise WhatsApp gateway).</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">DAILY_LIMIT <span className="text-muted-foreground/40">(optional)</span></label>
              <Input type="number" className="font-mono text-xs bg-background/50 border-border/60" placeholder="500" value={form.dailyLimit} onChange={(e) => setForm((f) => ({ ...f, dailyLimit: e.target.value }))} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="accent-primary" />
              <span className="text-xs text-muted-foreground">Set as default profile</span>
            </label>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving || !form.name || !form.smtpProfileId || (!effectiveGateway(form))} className="flex-1 font-mono">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editId ? "SAVE_CHANGES" : "CREATE_PROFILE"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} className="font-mono border-border/40">CANCEL</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

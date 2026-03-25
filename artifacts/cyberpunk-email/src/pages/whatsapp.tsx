import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Loader2, Play, RefreshCw, Phone, Image, ChevronDown, ChevronUp, Info, CheckCircle2, Circle } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { usePhoneValidation } from "@/hooks/use-phone-validation";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Campaign {
  id: number;
  name: string;
  channel: "whatsapp";
  profileId: number | null;
  message: string;
  mediaUrl: string | null;
  status: "draft" | "sending" | "sent" | "paused" | "failed";
  totalTargets: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
}

interface Profile { id: number; name: string; gateway: string; status: string; channel: string; }

const STATUS_COLOR: Record<string, string> = {
  draft: "border-muted-foreground/30 text-muted-foreground",
  sending: "border-yellow-400/50 text-yellow-400",
  sent: "border-green-400/40 text-green-400",
  paused: "border-orange-400/50 text-orange-400",
  failed: "border-red-500/50 text-red-400",
};

function WhatsAppSetupGuide({ hasProfiles, hasCampaigns }: { hasProfiles: boolean; hasCampaigns: boolean }) {
  const [open, setOpen] = useState(true);
  const steps = [
    {
      done: true,
      label: "Add an SMTP Relay",
      detail: "Go to SMTP Relays and add your email server credentials. This is the email account that sends the messages on your behalf.",
      action: { label: "SMTP Relays →", href: `${BASE}/smtp-profiles` },
    },
    {
      done: hasProfiles,
      label: "Create a WhatsApp Messaging Profile",
      detail: 'Go to Messaging Profiles → ADD PROFILE → set Channel to "WhatsApp" → pick your SMTP relay → enter the WhatsApp gateway domain. The gateway converts your email into a WhatsApp message. Most providers use a custom domain they give you (e.g. wa.gateway.example.com).',
      action: { label: "Messaging Profiles →", href: `${BASE}/messaging-profiles` },
    },
    {
      done: false,
      label: "Add contacts with phone numbers",
      detail: "Go to Contacts → add contacts and fill in the PHONE field (10-digit number, e.g. 4155551234). The system sends to {phone}@{gateway} for each contact.",
      action: { label: "Contacts →", href: `${BASE}/contacts` },
    },
    {
      done: hasCampaigns,
      label: "Create and launch a campaign",
      detail: "Click NEW CAMPAIGN → write your message → select your WhatsApp profile → click CREATE. Optionally add a media URL (image/video link). Then click LAUNCH to send.",
      action: null,
    },
  ];

  return (
    <div className="terminal-panel" style={{ borderColor: "rgba(37,211,102,0.15)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-green-500/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4" style={{ color: "rgba(37,211,102,0.7)" }} />
          <span className="font-mono text-xs tracking-wider" style={{ color: "rgba(37,211,102,0.8)" }}>HOW TO USE WHATSAPP CAMPAIGNS</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            WhatsApp messages work by sending an email to a <strong className="text-foreground/70">WhatsApp email gateway</strong>. The gateway converts the email into a WhatsApp message and delivers it to the recipient's number. The message arrives in WhatsApp just like a normal message.
          </p>
          <div className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="mt-0.5 shrink-0">
                  {step.done
                    ? <CheckCircle2 className="h-4 w-4" style={{ color: "#25D366" }} />
                    : <Circle className="h-4 w-4 text-muted-foreground/30" />}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-xs font-bold ${step.done ? "" : "text-foreground"}`} style={step.done ? { color: "#25D366" } : {}}>
                      Step {i + 1}: {step.label}
                    </span>
                    {step.action && (
                      <a href={step.action.href} className="font-mono text-[10px] underline underline-offset-2 transition-colors hover:opacity-80" style={{ color: "rgba(37,211,102,0.6)" }}>
                        {step.action.label}
                      </a>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 p-2.5 border rounded font-mono text-[10px] leading-relaxed" style={{ borderColor: "rgba(37,211,102,0.2)", background: "rgba(37,211,102,0.04)", color: "rgba(37,211,102,0.6)" }}>
            ℹ Gateway options: Some bulk messaging providers offer a WhatsApp email gateway as part of their service. Check your WhatsApp Business API provider's documentation for their gateway domain. The format is always: <strong>{"{10-digit-phone}@{gateway-domain}"}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function WhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", message: "", mediaUrl: "", profileId: "" });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch(`${BASE}/api/messaging-campaigns?channel=whatsapp`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BASE}/api/messaging-profiles`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      setCampaigns(Array.isArray(c) ? c : []);
      setProfiles(Array.isArray(p) ? p.filter((x: Profile) => x.channel === "whatsapp") : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const defaultP = profiles.find((p) => p.status === "verified") ?? profiles[0];
    if (defaultP && !form.profileId) setForm((f) => ({ ...f, profileId: String(defaultP.id) }));
  }, [profiles]);

  const hasSending = campaigns.some((c) => c.status === "sending");
  useEffect(() => {
    if (!hasSending) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [hasSending]);

  const create = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/messaging-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, channel: "whatsapp", profileId: form.profileId ? Number(form.profileId) : null, mediaUrl: form.mediaUrl || null }),
      });
      if (r.ok) { setOpen(false); setForm({ name: "", message: "", mediaUrl: "", profileId: form.profileId }); load(); }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`${BASE}/api/messaging-campaigns/${id}`, { method: "DELETE" });
    load();
  };

  const launch = async (id: number) => {
    if (!confirm("Launch this WhatsApp campaign and send to all active contacts with phone numbers?")) return;
    setSendingId(id);
    try {
      await fetch(`${BASE}/api/messaging-campaigns/${id}/send`, { method: "POST" });
      load();
    } finally {
      setSendingId(null);
    }
  };

  const sendTest = async (id: number) => {
    if (!testNumber) return;
    setTestingId(id);
    setTestResult(null);
    try {
      const r = await fetch(`${BASE}/api/messaging-campaigns/${id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: testNumber }),
      });
      const data = await r.json();
      setTestResult({ ok: r.ok, msg: r.ok ? `Test sent to ${data.sentTo}` : data.error });
    } finally {
      setTestingId(null);
    }
  };

  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.deliveredCount ?? 0), 0);

  const testProfile = profiles.find((p) => p.id === Number(form.profileId)) ?? profiles[0];
  const phoneValidation = usePhoneValidation(testNumber, testProfile?.gateway);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <WaIcon className="h-7 w-7 text-[#25D366]" />
          <div>
            <h1 className="text-2xl font-mono font-bold tracking-wider" style={{ color: "#25D366" }}>WHATSAPP_CAMPAIGNS</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Bulk WhatsApp via SMTP gateway</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="font-mono gap-2" style={{ background: "#25D366", color: "#000" }}>
          <Plus className="h-4 w-4" /> NEW_CAMPAIGN
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "TOTAL_CAMPAIGNS", value: campaigns.length },
          { label: "WA_PROFILES", value: profiles.filter((p) => p.status === "verified").length },
          { label: "MSGS_SENT", value: totalSent.toLocaleString() },
          { label: "DELIVERED", value: totalDelivered.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="terminal-panel p-3 text-center">
            <p className="font-mono text-[9px] text-muted-foreground/50 tracking-widest">{stat.label}</p>
            <p className="font-mono text-xl font-bold mt-1" style={{ color: "#25D366" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <WhatsAppSetupGuide hasProfiles={profiles.length > 0} hasCampaigns={campaigns.length > 0} />

      {/* Quick test */}
      <div className="terminal-panel p-3 space-y-2" style={{ borderColor: "rgba(37,211,102,0.15)" }}>
        <div className="flex gap-3 items-start flex-wrap">
          <p className="font-mono text-[10px] text-muted-foreground/60 tracking-widest shrink-0 mt-2">QUICK_TEST →</p>
          <div className="flex-1 min-w-48">
            <PhoneInput
              value={testNumber}
              onChange={setTestNumber}
              gateway={testProfile?.gateway}
              placeholder="Phone number to test (e.g. 4155551234)"
              size="sm"
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0 mt-2">click SEND_TEST on a campaign row</span>
        </div>
        {testResult && (
          <p className={`font-mono text-[10px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
            {testResult.ok ? "✓" : "✗"} {testResult.msg}
          </p>
        )}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="terminal-panel p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#25D366" }} />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="terminal-panel p-12 text-center space-y-3">
          <WaIcon className="h-12 w-12 mx-auto" style={{ color: "rgba(37,211,102,0.2)" }} />
          <p className="font-mono text-muted-foreground/60">No WhatsApp campaigns yet.</p>
          <p className="font-mono text-xs text-muted-foreground/40">Create a campaign and reach your contacts on WhatsApp.</p>
        </div>
      ) : (
        <div className="terminal-panel overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/30">
                <th className="text-left p-3 text-muted-foreground/60 tracking-wider">CAMPAIGN</th>
                <th className="text-left p-3 text-muted-foreground/60 tracking-wider">STATUS</th>
                <th className="text-right p-3 text-muted-foreground/60 tracking-wider hidden md:table-cell">TARGETS</th>
                <th className="text-right p-3 text-muted-foreground/60 tracking-wider hidden md:table-cell">SENT</th>
                <th className="text-right p-3 text-muted-foreground/60 tracking-wider hidden lg:table-cell">DELIVERED</th>
                <th className="text-right p-3 text-muted-foreground/60 tracking-wider hidden lg:table-cell">FAILED</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{c.name}</span>
                      {c.mediaUrl && <Image className="h-3 w-3 text-muted-foreground/40" title="Has media" />}
                    </div>
                    <div className="text-muted-foreground/40 text-[10px] mt-0.5 max-w-[200px] truncate">{c.message}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${STATUS_COLOR[c.status]}`}>{c.status.toUpperCase()}</Badge>
                  </td>
                  <td className="p-3 text-right text-muted-foreground hidden md:table-cell">{c.totalTargets}</td>
                  <td className="p-3 text-right hidden md:table-cell" style={{ color: "#25D366" }}>{c.sentCount}</td>
                  <td className="p-3 text-right hidden lg:table-cell" style={{ color: "rgba(37,211,102,0.7)" }}>{c.deliveredCount}</td>
                  <td className="p-3 text-right text-red-400/70 hidden lg:table-cell">{c.failedCount}</td>
                  <td className="p-3">
                    <div className="flex gap-1.5 justify-end">
                      {phoneValidation.state === "valid" && (
                        <Button variant="outline" size="sm" className="font-mono text-[9px] h-7 px-2 gap-1" style={{ borderColor: "rgba(37,211,102,0.3)", color: "#25D366" }}
                          onClick={() => sendTest(c.id)} disabled={testingId === c.id}>
                          {testingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                          TEST
                        </Button>
                      )}
                      {(c.status === "draft" || c.status === "paused" || c.status === "failed") && (
                        <Button size="sm" className="font-mono text-[9px] h-7 px-2 gap-1 text-black"
                          style={{ background: "#25D366" }}
                          onClick={() => launch(c.id)} disabled={sendingId === c.id}>
                          {sendingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          LAUNCH
                        </Button>
                      )}
                      {c.status === "sending" && (
                        <Button variant="outline" size="sm" className="font-mono text-[9px] border-yellow-500/30 text-yellow-400 h-7 px-2 gap-1" onClick={load}>
                          <RefreshCw className="h-3 w-3" /> REFRESH
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="font-mono text-[9px] border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2"
                        onClick={() => del(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Campaign modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-wider" style={{ color: "#25D366" }}>NEW_WHATSAPP_CAMPAIGN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">CAMPAIGN_NAME</label>
              <Input className="font-mono text-xs bg-background/50 border-border/60" placeholder="Black Friday WhatsApp Blast" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">WHATSAPP_PROFILE</label>
              {profiles.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/50 bg-secondary/30 border border-border/40 rounded px-3 py-2">
                  No WhatsApp profiles — <a href={`${BASE}/messaging-profiles`} className="underline" style={{ color: "#25D366" }}>add one first</a>
                </div>
              ) : (
                <Select value={form.profileId} onValueChange={(v) => setForm((f) => ({ ...f, profileId: v }))}>
                  <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 h-9"><SelectValue placeholder="Select profile..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="font-mono text-xs">
                        <span className={p.status === "verified" ? "" : "text-muted-foreground"} style={p.status === "verified" ? { color: "#25D366" } : {}}>{p.name}</span>
                        <span className="text-muted-foreground/40 ml-2">@{p.gateway}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">MESSAGE_BODY</label>
                <span className="text-[10px] font-mono text-muted-foreground/50">{form.message.length} chars</span>
              </div>
              <Textarea
                className="font-mono text-xs bg-background/50 border-border/60 min-h-[120px] resize-none"
                placeholder="Hi {{firstName}} 👋 We have an exclusive offer for you today..."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground/40">Use {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"} for personalization. Emojis are fully supported 🚀</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Image className="h-3.5 w-3.5" /> MEDIA_URL <span className="text-muted-foreground/40">(optional — image/video link)</span></label>
              <Input className="font-mono text-xs bg-background/50 border-border/60" placeholder="https://yoursite.com/promo-banner.jpg" value={form.mediaUrl} onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={create} disabled={saving || !form.name || !form.message} className="flex-1 font-mono text-black" style={{ background: "#25D366" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                CREATE_CAMPAIGN
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} className="font-mono border-border/40">CANCEL</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

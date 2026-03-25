import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, Trash2, Send, Loader2, Play, Pause, RefreshCw, Phone, ChevronDown, ChevronUp, Info, CheckCircle2, Circle } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { usePhoneValidation } from "@/hooks/use-phone-validation";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Campaign {
  id: number;
  name: string;
  channel: "sms";
  profileId: number | null;
  message: string;
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
  sent: "border-primary/40 text-primary",
  paused: "border-orange-400/50 text-orange-400",
  failed: "border-red-500/50 text-red-400",
};

const SMS_MAX = 160;

function SmsSetupGuide({ hasProfiles, hasCampaigns }: { hasProfiles: boolean; hasCampaigns: boolean }) {
  const [open, setOpen] = useState(true);
  const steps = [
    {
      done: true,
      label: "Add an SMTP Relay",
      detail: "Go to SMTP Relays in the sidebar and add your email server (Gmail, Outlook, custom host, etc). This is the server that physically sends the messages.",
      action: { label: "SMTP Relays →", href: `${BASE}/smtp-profiles` },
    },
    {
      done: hasProfiles,
      label: "Create an SMS Messaging Profile",
      detail: 'Go to Messaging Profiles → click ADD PROFILE → set Channel to "SMS" → pick your SMTP relay → choose the carrier gateway that matches your contacts\' phone carrier (e.g. Verizon = vtext.com, AT&T = txt.att.net, T-Mobile = tmomail.net). Each profile targets one carrier.',
      action: { label: "Messaging Profiles →", href: `${BASE}/messaging-profiles` },
    },
    {
      done: false,
      label: "Add contacts with phone numbers",
      detail: "Go to Contacts → add or import contacts. Make sure the PHONE field is filled in with 10-digit US numbers (e.g. 4155551234). Contacts without phone numbers will be skipped.",
      action: { label: "Contacts →", href: `${BASE}/contacts` },
    },
    {
      done: hasCampaigns,
      label: "Create and launch a campaign",
      detail: 'Click NEW CAMPAIGN → write your message (use {{firstName}}, {{lastName}} for personalization) → pick your SMS profile → click CREATE. Then click LAUNCH to send to all contacts with phone numbers.',
      action: null,
    },
  ];

  return (
    <div className="terminal-panel border-primary/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary/70" />
          <span className="font-mono text-xs text-primary/80 tracking-wider">HOW TO USE SMS CAMPAIGNS</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            SMS messages are sent as emails to your contacts' carrier gateway addresses (e.g. <span className="text-primary">4155551234@vtext.com</span>). The carrier converts the email into an SMS text. You need one messaging profile per carrier.
          </p>
          <div className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="mt-0.5 shrink-0">
                  {step.done
                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                    : <Circle className="h-4 w-4 text-muted-foreground/30" />}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-xs font-bold ${step.done ? "text-primary" : "text-foreground"}`}>
                      Step {i + 1}: {step.label}
                    </span>
                    {step.action && (
                      <a href={step.action.href} className="font-mono text-[10px] text-primary/60 hover:text-primary underline underline-offset-2 transition-colors">
                        {step.action.label}
                      </a>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 p-2.5 border border-yellow-500/20 rounded bg-yellow-500/5 font-mono text-[10px] text-yellow-300/70">
            ⚠ Important: You need a separate messaging profile for each carrier (Verizon, AT&T, T-Mobile, etc.). A message sent via the Verizon gateway only reaches Verizon customers. To reach all carriers, create one profile per carrier.
          </div>
        </div>
      )}
    </div>
  );
}

export default function SmsCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", message: "", profileId: "" });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch(`${BASE}/api/messaging-campaigns?channel=sms`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BASE}/api/messaging-profiles`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      setCampaigns(Array.isArray(c) ? c : []);
      setProfiles(Array.isArray(p) ? p.filter((x: Profile) => x.channel === "sms") : []);
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
        body: JSON.stringify({ ...form, channel: "sms", profileId: form.profileId ? Number(form.profileId) : null }),
      });
      if (r.ok) { setOpen(false); setForm({ name: "", message: "", profileId: form.profileId }); load(); }
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
    if (!confirm("Launch this campaign and send SMS to all active contacts with phone numbers?")) return;
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

  const detail = campaigns.find((c) => c.id === detailId);
  const smsCount = form.message.length > 0 ? Math.ceil(form.message.length / SMS_MAX) : 0;
  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.deliveredCount ?? 0), 0);

  const testProfile = profiles.find((p) => p.id === Number(form.profileId)) ?? profiles[0];
  const phoneValidation = usePhoneValidation(testNumber, testProfile?.gateway);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-primary tracking-wider">SMS_CAMPAIGNS</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Bulk SMS via SMTP carrier email gateways</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="font-mono gap-2"><Plus className="h-4 w-4" /> NEW_CAMPAIGN</Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "TOTAL_CAMPAIGNS", value: campaigns.length },
          { label: "ACTIVE_PROFILES", value: profiles.filter((p) => p.status === "verified").length },
          { label: "MSGS_SENT", value: totalSent.toLocaleString() },
          { label: "DELIVERED", value: totalDelivered.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="terminal-panel p-3 text-center">
            <p className="font-mono text-[9px] text-muted-foreground/50 tracking-widest">{stat.label}</p>
            <p className="font-mono text-xl font-bold text-primary mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <SmsSetupGuide hasProfiles={profiles.length > 0} hasCampaigns={campaigns.length > 0} />

      {/* Test send bar */}
      <div className="terminal-panel p-3 space-y-2">
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
          <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0 mt-2">then click SEND_TEST on any campaign row</span>
        </div>
        {testResult && (
          <p className={`font-mono text-[10px] ${testResult.ok ? "text-primary" : "text-red-400"}`}>
            {testResult.ok ? "✓" : "✗"} {testResult.msg}
          </p>
        )}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="terminal-panel p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="terminal-panel p-12 text-center space-y-3">
          <MessageSquare className="h-12 w-12 text-primary/20 mx-auto" />
          <p className="font-mono text-muted-foreground/60">No SMS campaigns yet.</p>
          <p className="font-mono text-xs text-muted-foreground/40">Create a campaign and reach your contacts via text message.</p>
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
                    <div className="text-foreground">{c.name}</div>
                    <div className="text-muted-foreground/40 text-[10px] mt-0.5 max-w-[200px] truncate">{c.message}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${STATUS_COLOR[c.status]}`}>{c.status.toUpperCase()}</Badge>
                  </td>
                  <td className="p-3 text-right text-muted-foreground hidden md:table-cell">{c.totalTargets}</td>
                  <td className="p-3 text-right text-primary hidden md:table-cell">{c.sentCount}</td>
                  <td className="p-3 text-right text-primary/70 hidden lg:table-cell">{c.deliveredCount}</td>
                  <td className="p-3 text-right text-red-400/70 hidden lg:table-cell">{c.failedCount}</td>
                  <td className="p-3">
                    <div className="flex gap-1.5 justify-end">
                      {phoneValidation.state === "valid" && (
                        <Button variant="outline" size="sm" className="font-mono text-[9px] border-primary/30 text-primary h-7 px-2 gap-1"
                          onClick={() => sendTest(c.id)} disabled={testingId === c.id}>
                          {testingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                          TEST
                        </Button>
                      )}
                      {(c.status === "draft" || c.status === "paused" || c.status === "failed") && (
                        <Button size="sm" className="font-mono text-[9px] h-7 px-2 gap-1"
                          onClick={() => launch(c.id)} disabled={sendingId === c.id}>
                          {sendingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          LAUNCH
                        </Button>
                      )}
                      {c.status === "sending" && (
                        <Button variant="outline" size="sm" className="font-mono text-[9px] border-yellow-500/30 text-yellow-400 h-7 px-2 gap-1" onClick={() => load()}>
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
            <DialogTitle className="font-mono text-primary tracking-wider">NEW_SMS_CAMPAIGN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">CAMPAIGN_NAME</label>
              <Input className="font-mono text-xs bg-background/50 border-border/60" placeholder="Summer Promo SMS Blast" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">SMS_PROFILE</label>
              {profiles.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/50 bg-secondary/30 border border-border/40 rounded px-3 py-2">
                  No SMS profiles — <a href={`${BASE}/messaging-profiles`} className="text-primary underline">add one first</a>
                </div>
              ) : (
                <Select value={form.profileId} onValueChange={(v) => setForm((f) => ({ ...f, profileId: v }))}>
                  <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 h-9"><SelectValue placeholder="Select profile..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="font-mono text-xs">
                        <span className={p.status === "verified" ? "text-primary" : "text-muted-foreground"}>{p.name}</span>
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
                <span className={`text-[10px] font-mono ${form.message.length > SMS_MAX ? "text-red-400" : form.message.length > SMS_MAX * 0.8 ? "text-yellow-400" : "text-muted-foreground/50"}`}>
                  {form.message.length} / {SMS_MAX} {smsCount > 1 ? `(${smsCount} segments)` : ""}
                </span>
              </div>
              <Textarea
                className="font-mono text-xs bg-background/50 border-border/60 min-h-[120px] resize-none"
                placeholder="Hi {{firstName}}, here's your exclusive offer... Reply STOP to unsubscribe."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground/40">Use {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"} for personalization. Always include opt-out instructions.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={create} disabled={saving || !form.name || !form.message} className="flex-1 font-mono">
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

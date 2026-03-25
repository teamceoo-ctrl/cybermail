import { useState, useRef, useEffect, useCallback } from "react";
import { useListCampaigns, useCreateCampaign, useListTemplates, useListSmtpProfiles, useListSegments } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Send, Play, Pause, Activity, Trash2, FlaskConical, ChevronRight, CheckCircle, XCircle, Mail, MousePointer, Rocket, AlertTriangle, RefreshCw, Zap, Radio, Pencil, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const campaignSchema = z.object({
  name: z.string().min(1, "Required"),
  subject: z.string().min(1, "Required"),
  fromName: z.string().min(1, "Required"),
  fromEmail: z.string().email("Valid email required"),
  templateId: z.coerce.number().optional(),
  smtpProfileId: z.coerce.number().optional(),
  segmentId: z.coerce.number().optional(),
  tagFilter: z.string().optional(),
  abSubjectVariant: z.string().optional(),
  abSplitPercent: z.coerce.number().min(1).max(99).optional(),
  scheduledAt: z.string().optional(),
});

type Campaign = {
  id: number; name: string; subject: string; fromName: string; fromEmail: string;
  status: string; totalRecipients: number; sent: number; delivered: number;
  opened: number; clicked: number; bounced: number; complained: number;
  unsubscribed: number; createdAt: string; sentAt: string | null;
  templateId: number | null; smtpProfileId: number | null; segmentId: number | null;
};

type ActivityEvent = {
  id: string;
  type: "sent" | "bounced" | "start" | "complete" | "paused";
  email?: string;
  name?: string;
  subject?: string;
  error?: string;
  sent?: number;
  delivered?: number;
  bounced?: number;
  total?: number;
  ts: number;
};

function getStatusColor(status: string) {
  switch (status) {
    case 'sent': return "bg-primary/20 text-primary border-primary/50";
    case 'sending': return "bg-primary/40 text-primary border-primary animate-pulse";
    case 'failed': return "bg-destructive/20 text-destructive border-destructive/50";
    case 'paused': return "bg-warning/20 text-warning border-warning/50";
    default: return "bg-muted/50 text-muted-foreground border-border";
  }
}

function StatMini({ label, value, color = "text-foreground" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono text-base font-bold ${color}`}>{value}</div>
      <div className="font-mono text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ActivityFeed({ campaignId, initialStatus }: { campaignId: number; initialStatus: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [liveStats, setLiveStats] = useState<{ sent: number; delivered: number; bounced: number; total: number } | null>(null);
  const [isLive, setIsLive] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const es = new EventSource(`${BASE}/api/campaigns/${campaignId}/events`);
    esRef.current = es;

    es.onopen = () => setIsLive(true);
    es.onerror = () => { setIsLive(false); };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ActivityEvent & { type: string };
        const event: ActivityEvent = { ...data, id: `${data.ts}-${Math.random()}` };

        if (data.type === "start") {
          setEvents([]);
          setLiveStats({ sent: 0, delivered: 0, bounced: 0, total: data.total ?? 0 });
          setIsLive(true);
        } else if (data.type === "sent" || data.type === "bounced") {
          setEvents(prev => [event, ...prev].slice(0, 500));
          setLiveStats({ sent: data.sent ?? 0, delivered: data.delivered ?? 0, bounced: data.bounced ?? 0, total: data.total ?? 0 });
        } else if (data.type === "complete" || data.type === "paused") {
          setEvents(prev => [event, ...prev]);
          setIsLive(false);
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    return () => { es.close(); esRef.current = null; setIsLive(false); };
  }, [campaignId]);

  useEffect(() => {
    if (initialStatus === "sending") {
      const cleanup = connect();
      return cleanup;
    }
    return () => {};
  }, [initialStatus, connect]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const progress = liveStats && liveStats.total > 0 ? (liveStats.sent / liveStats.total) * 100 : 0;

  return (
    <div className="space-y-3">
      {liveStats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />}
              {isLive ? "TRANSMITTING..." : "TRANSMISSION_COMPLETE"}
            </span>
            <span>{liveStats.sent}/{liveStats.total} EMAILS</span>
          </div>
          <div className="w-full h-1.5 bg-border/50 rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatMini label="SENT" value={liveStats.sent} color="text-foreground" />
            <StatMini label="DELIVERED" value={liveStats.delivered} color="text-primary" />
            <StatMini label="BOUNCED" value={liveStats.bounced} color={liveStats.bounced > 0 ? "text-destructive" : "text-muted-foreground"} />
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div>
          <div className="font-mono text-[9px] text-primary tracking-widest mb-1.5 flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> TRANSMISSION_LOG
          </div>
          <div
            ref={feedRef}
            className="h-48 overflow-y-auto bg-black/60 border border-border/40 rounded p-2 space-y-0.5 font-mono text-[10px] scroll-smooth"
            style={{ scrollbarWidth: "thin" }}
          >
            {events.map(ev => (
              <div key={ev.id} className={`flex items-start gap-1.5 py-0.5 ${ev.type === "complete" ? "text-primary font-bold" : ev.type === "bounced" ? "text-destructive/80" : ev.type === "paused" ? "text-warning" : "text-foreground/80"}`}>
                {ev.type === "sent" && <CheckCircle className="w-3 h-3 text-primary shrink-0 mt-px" />}
                {ev.type === "bounced" && <XCircle className="w-3 h-3 text-destructive shrink-0 mt-px" />}
                {ev.type === "complete" && <Zap className="w-3 h-3 text-primary shrink-0 mt-px" />}
                {ev.type === "paused" && <Pause className="w-3 h-3 text-warning shrink-0 mt-px" />}
                <div className="flex-1 min-w-0">
                  {ev.type === "sent" && (
                    <span>
                      <span className="text-primary">{ev.email}</span>
                      {ev.subject && <span className="text-muted-foreground/60 ml-1">— {ev.subject.slice(0, 40)}{ev.subject.length > 40 ? "…" : ""}</span>}
                    </span>
                  )}
                  {ev.type === "bounced" && (
                    <span>
                      <span className="text-destructive">{ev.email}</span>
                      <span className="text-muted-foreground/60 ml-1">BOUNCE: {ev.error?.slice(0, 50)}</span>
                    </span>
                  )}
                  {ev.type === "complete" && (
                    <span>BROADCAST COMPLETE — {ev.delivered} delivered · {ev.bounced} bounced</span>
                  )}
                  {ev.type === "paused" && <span>BROADCAST PAUSED</span>}
                </div>
                <span className="text-muted-foreground/40 shrink-0 ml-1">{new Date(ev.ts).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!liveStats && initialStatus === "sending" && (
        <div className="flex items-center gap-2 font-mono text-[10px] text-primary animate-pulse p-2 border border-primary/20 rounded bg-primary/5">
          <Radio className="w-3 h-3" /> Connecting to broadcast stream...
        </div>
      )}

      {!liveStats && !["sending", "draft", "paused"].includes(initialStatus) && events.length === 0 && (
        <div className="font-mono text-[10px] text-muted-foreground/50 p-2 text-center border border-dashed border-border/30 rounded">
          No transmission log available
        </div>
      )}
    </div>
  );
}

function CampaignDetail({ campaign, onClose, onRefetch, onEdit }: { campaign: Campaign; onClose: () => void; onRefetch: () => void; onEdit: (c: Campaign) => void }) {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [localStatus, setLocalStatus] = useState(campaign.status);
  const [liveCampaign, setLiveCampaign] = useState(campaign);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}`);
      if (res.ok) {
        const data = await res.json();
        setLiveCampaign(data);
        setLocalStatus(data.status);
      }
    } catch { /* ignore */ }
  }, [campaign.id]);

  useEffect(() => {
    if (localStatus === "sending") {
      const iv = setInterval(refreshStats, 3000);
      return () => clearInterval(iv);
    }
    if (localStatus === "sent") {
      refreshStats();
    }
  }, [localStatus, refreshStats]);

  const deliveryRate = liveCampaign.sent > 0 ? ((liveCampaign.delivered / liveCampaign.sent) * 100) : 0;
  const openRate = liveCampaign.delivered > 0 ? ((liveCampaign.opened / liveCampaign.delivered) * 100) : 0;
  const bounceRate = liveCampaign.sent > 0 ? ((liveCampaign.bounced / liveCampaign.sent) * 100) : 0;

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}/preview-render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch (err: any) {
      toast({ title: "PREVIEW_FAILED", description: err.message, variant: "destructive", className: "font-mono" });
    } finally { setLoadingPreview(false); }
  };

  const sendTest = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}/send-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "TEST_SENT", description: data.message, className: "border-primary bg-background text-primary font-mono" });
    } catch (err: any) {
      toast({ title: "SEND_FAILED", description: err.message, variant: "destructive", className: "font-mono" });
    } finally { setSendingTest(false); }
  };

  const launchBroadcast = async () => {
    if (!confirm(`Launch broadcast to ${campaign.totalRecipients > 0 ? campaign.totalRecipients : "all active"} contacts?\n\nEmails will start sending immediately via ${campaign.smtpProfileId ? "the selected SMTP profile" : "[no SMTP profile set]"}.`)) return;
    setLaunching(true);
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLocalStatus("sending");
      toast({
        title: "BROADCAST_LAUNCHED",
        description: data.message,
        className: "border-primary bg-background text-primary font-mono",
      });
      onRefetch();
    } catch (err: any) {
      toast({ title: "LAUNCH_FAILED", description: err.message, variant: "destructive", className: "font-mono" });
    } finally { setLaunching(false); }
  };

  const deleteCampaign = async () => {
    if (!confirm("Permanently delete this campaign?")) return;
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/campaigns/${campaign.id}`, { method: "DELETE" });
      toast({ title: "PURGED", className: "border-primary bg-background text-primary font-mono" });
      onClose(); onRefetch();
    } catch {
      toast({ title: "DELETE_FAILED", variant: "destructive", className: "font-mono" });
    } finally { setDeleting(false); }
  };

  const pauseResume = async (action: "pause" | "resume") => {
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error();
      setLocalStatus(action === "pause" ? "paused" : "sending");
      toast({ title: action === "pause" ? "PAUSED" : "RESUMED", className: "border-primary bg-background text-primary font-mono" });
      onRefetch();
    } catch { toast({ title: "ACTION_FAILED", variant: "destructive", className: "font-mono" }); }
  };

  const [resetting, setResetting] = useState(false);

  const resetToDraft = async () => {
    if (!confirm("Reset this campaign to draft so it can be sent again?\n\nThis lets you re-launch the same campaign to the same (or updated) contact list.")) return;
    setResetting(true);
    try {
      const res = await fetch(`${BASE}/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) throw new Error();
      setLocalStatus("draft");
      toast({ title: "RESET_TO_DRAFT", description: "Campaign is ready to launch again", className: "border-primary bg-background text-primary font-mono" });
      onRefetch();
    } catch {
      toast({ title: "RESET_FAILED", variant: "destructive", className: "font-mono" });
    } finally { setResetting(false); }
  };

  const canLaunch = ["draft", "paused"].includes(localStatus);
  const canResend = ["sent", "failed"].includes(localStatus);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-mono text-lg font-bold text-primary">{liveCampaign.name}</h2>
        <div className="font-mono text-xs text-muted-foreground">{liveCampaign.subject}</div>
        <div className="font-mono text-[10px] text-muted-foreground/60">
          FROM: {liveCampaign.fromName} &lt;{liveCampaign.fromEmail}&gt;
          {liveCampaign.sentAt && <span className="ml-3">SENT: {format(new Date(liveCampaign.sentAt), "yyyy-MM-dd HH:mm")}</span>}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className={`font-mono text-[10px] ${getStatusColor(localStatus)}`}>{localStatus.toUpperCase()}</Badge>
          {liveCampaign.totalRecipients > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">{liveCampaign.totalRecipients.toLocaleString()} RECIPIENTS</span>
          )}
        </div>
      </div>

      {canLaunch && (
        <div className="p-3 border border-primary/40 bg-primary/5 rounded space-y-2">
          <div className="font-mono text-[10px] text-primary tracking-widest flex items-center gap-2">
            <Rocket className="w-3 h-3" /> LAUNCH_BROADCAST
          </div>
          {!campaign.smtpProfileId && (
            <div className="flex items-start gap-2 text-warning font-mono text-[10px]">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              No SMTP profile assigned. Edit campaign to add one.
            </div>
          )}
          <Button
            onClick={launchBroadcast}
            disabled={launching || !campaign.smtpProfileId}
            className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold h-9"
          >
            <Rocket className="w-3.5 h-3.5 mr-2" />
            {launching ? "LAUNCHING..." : "[ LAUNCH_BROADCAST ]"}
          </Button>
        </div>
      )}

      {canResend && (
        <div className="p-3 border border-primary/30 bg-primary/5 rounded space-y-2">
          <div className="font-mono text-[10px] text-primary tracking-widest flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> RESEND_BROADCAST
          </div>
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Reset this campaign to draft and launch it again — same settings, same template, same or updated audience.
          </p>
          <Button
            onClick={resetToDraft}
            disabled={resetting}
            variant="outline"
            className="w-full border-primary/50 text-primary hover:bg-primary hover:text-black font-mono font-bold h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${resetting ? "animate-spin" : ""}`} />
            {resetting ? "RESETTING..." : "[ RESET_AND_RESEND ]"}
          </Button>
        </div>
      )}

      <ActivityFeed campaignId={campaign.id} initialStatus={localStatus} />

      {liveCampaign.sent > 0 && (
        <div className="p-3 bg-background/40 border border-border/30 rounded space-y-2">
          <div className="font-mono text-[9px] text-muted-foreground tracking-widest">STATS</div>
          <div className="grid grid-cols-3 gap-3">
            <StatMini label="DELIVERED" value={`${deliveryRate.toFixed(1)}%`} color="text-primary" />
            <StatMini label="OPENED" value={`${openRate.toFixed(1)}%`} color="text-primary/70" />
            <StatMini label="BOUNCED" value={`${bounceRate.toFixed(1)}%`} color={bounceRate > 5 ? "text-destructive" : "text-muted-foreground"} />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border/30">
            <StatMini label="SENT" value={liveCampaign.sent.toLocaleString()} />
            <StatMini label="COMPLAINED" value={liveCampaign.complained} color={liveCampaign.complained > 0 ? "text-destructive" : "text-foreground"} />
            <StatMini label="UNSUB" value={liveCampaign.unsubscribed} />
          </div>
        </div>
      )}

      <div className="p-3 border border-border/40 rounded bg-background/40 space-y-2">
        <div className="font-mono text-[10px] text-muted-foreground tracking-widest flex items-center gap-2">
          <Eye className="w-3 h-3" /> PREVIEW_RENDER
        </div>
        <Button onClick={loadPreview} disabled={loadingPreview} size="sm" variant="outline"
          className="w-full border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs h-8">
          {loadingPreview ? "RENDERING..." : "[ RENDER_PREVIEW ]"}
        </Button>
        {previewHtml && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="font-mono text-[10px] text-primary">SUBJECT: {previewSubject}</div>
              <button onClick={() => setPreviewHtml(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="border border-primary/20 rounded overflow-hidden bg-white" style={{ maxHeight: 300 }}>
              <iframe
                srcDoc={previewHtml}
                className="w-full"
                style={{ height: 280, border: "none" }}
                title="Email preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border border-border/40 rounded bg-background/40 space-y-2">
        <div className="font-mono text-[10px] text-muted-foreground tracking-widest flex items-center gap-2">
          <FlaskConical className="w-3 h-3" /> SEND_TEST
        </div>
        <div className="flex gap-2">
          <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com"
            className="font-mono text-xs bg-background border-border focus-visible:ring-primary h-8 flex-1" />
          <Button onClick={sendTest} disabled={!testEmail || sendingTest} size="sm"
            className="bg-primary/20 text-primary hover:bg-primary hover:text-black border border-primary/30 font-mono text-xs h-8 px-3">
            {sendingTest ? "..." : "FIRE"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {localStatus === "sending" && (
          <Button variant="outline" className="flex-1 font-mono border-warning/50 text-warning hover:bg-warning/10 text-xs" onClick={() => pauseResume("pause")}>
            <Pause className="w-3.5 h-3.5 mr-2" /> PAUSE
          </Button>
        )}
        {localStatus === "paused" && (
          <Button variant="outline" className="flex-1 font-mono border-primary/50 text-primary hover:bg-primary/10 text-xs" onClick={() => pauseResume("resume")}>
            <Play className="w-3.5 h-3.5 mr-2" /> RESUME
          </Button>
        )}
        <Button variant="outline" className="flex-1 font-mono border-border/60 text-muted-foreground hover:border-primary hover:text-primary text-xs" onClick={() => onEdit(liveCampaign)}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> EDIT
        </Button>
        <Button variant="outline" className="flex-1 font-mono border-destructive/40 text-destructive hover:bg-destructive/10 text-xs" onClick={deleteCampaign} disabled={deleting}>
          <Trash2 className="w-3.5 h-3.5 mr-2" /> {deleting ? "PURGING..." : "DELETE"}
        </Button>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: campaigns, isLoading, refetch } = useListCampaigns();
  const { data: templates } = useListTemplates();
  const { data: profiles } = useListSmtpProfiles();
  const { data: segments } = useListSegments();
  const createMutation = useCreateCampaign();

  const form = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: "", subject: "", fromName: "", fromEmail: "" },
  });

  const editForm = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: "", subject: "", fromName: "", fromEmail: "" },
  });

  const openEditDialog = (c: Campaign) => {
    setEditCampaign(c);
    editForm.reset({
      name: c.name,
      subject: c.subject,
      fromName: c.fromName,
      fromEmail: c.fromEmail,
      templateId: c.templateId ?? undefined,
      smtpProfileId: c.smtpProfileId ?? undefined,
      segmentId: c.segmentId ?? undefined,
    });
    setEditOpen(true);
  };

  const onEditSubmit = async (values: z.infer<typeof campaignSchema>) => {
    if (!editCampaign) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${BASE}/api/campaigns/${editCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      toast({ title: "CAMPAIGN_UPDATED", description: `${values.name} saved`, className: "border-primary bg-background text-primary font-mono" });
      setEditOpen(false);
      setEditCampaign(null);
      refetch();
    } catch {
      toast({ title: "UPDATE_FAILED", variant: "destructive", className: "font-mono" });
    } finally {
      setSavingEdit(false);
    }
  };

  const onSubmit = (values: z.infer<typeof campaignSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "CAMPAIGN_CREATED", description: "Click it in the list to open & launch", className: "border-primary bg-background text-primary font-mono" });
        setCreateOpen(false); form.reset(); refetch();
      },
      onError: () => toast({ title: "INIT_FAILED", variant: "destructive", className: "font-mono" }),
    });
  };

  return (
    <PageTransition className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">BROADCAST_CONSOLE</h1>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">Click a row to open controls, live feed &amp; launch</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="border-border font-mono text-xs h-9">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> SYNC
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono">
                <Plus className="w-4 h-4 mr-2" /> NEW_CAMPAIGN
              </Button>
            </DialogTrigger>
            <DialogContent className="dialog-panel max-w-3xl max-h-[85vh] flex flex-col p-0">
              <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
                <DialogTitle className="font-mono text-primary flex items-center gap-2">
                  <Send className="w-5 h-5" /> {'>'} CONFIGURE_BROADCAST
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                    <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                      <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">META_DATA</div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">CAMPAIGN_NAME</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Q4 Promo" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="subject" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">SUBJECT — supports {"{{first_name}}"} etc</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Hey {{first_name}}, check this out" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="fromName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">SENDER_NAME</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Your Name" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="fromEmail" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">FROM_ADDRESS</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="you@domain.com" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                      <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">ROUTING</div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="templateId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">TEMPLATE</FormLabel>
                            <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                              <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="None (plain)" /></SelectTrigger></FormControl>
                              <SelectContent className="bg-card border-border font-mono">
                                {templates?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                                {(!templates || templates.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">No templates yet</div>}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="segmentId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">AUDIENCE</FormLabel>
                            <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                              <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select audience..." /></SelectTrigger></FormControl>
                              <SelectContent className="bg-card border-border font-mono">
                                {segments?.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.contactCount ?? 0})</SelectItem>
                                ))}
                                {(!segments || segments.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">Import contacts first</div>}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="smtpProfileId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">SMTP_NODE</FormLabel>
                            <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                              <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select SMTP..." /></SelectTrigger></FormControl>
                              <SelectContent className="bg-card border-border font-mono">
                                {profiles?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                {(!profiles || profiles.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">No SMTP profiles</div>}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground/60">
                        Subject supports template tags: {"{{first_name}}"} {"{{last_name}}"} {"{{company}}"} {"{{email}}"} etc.
                      </p>
                    </div>

                    <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                      <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">ADVANCED</div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="tagFilter" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">TAG_FILTER (only send to contacts with this tag)</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="e.g. hot-lead" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">SCHEDULE (leave blank to send now)</FormLabel>
                            <FormControl><Input type="datetime-local" {...field} className="font-mono bg-background focus-visible:ring-primary border-border text-xs" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="abSubjectVariant" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">A/B SUBJECT VARIANT (optional)</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Variant B subject line" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="abSplitPercent" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">A/B SPLIT % (% sent variant A)</FormLabel>
                            <FormControl><Input type="number" min={1} max={99} {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="50" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                    <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                      {createMutation.isPending ? "CREATING..." : "CREATE_CAMPAIGN"}
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="terminal-panel flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center text-primary"><TerminalText text="> FETCHING_BROADCASTS..." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-background/50 sticky top-0 backdrop-blur">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-primary text-xs w-[220px]">IDENTIFIER</TableHead>
                  <TableHead className="font-mono text-primary text-xs">SUBJECT</TableHead>
                  <TableHead className="font-mono text-primary text-xs text-right hidden sm:table-cell">RECIPIENTS</TableHead>
                  <TableHead className="font-mono text-primary text-xs text-right hidden md:table-cell">DELIVERED</TableHead>
                  <TableHead className="font-mono text-primary text-xs text-right hidden lg:table-cell">OPENED</TableHead>
                  <TableHead className="font-mono text-primary text-xs w-[110px] text-center">STATE</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns as Campaign[] | undefined)?.map(c => (
                  <TableRow key={c.id} onClick={() => setDetailCampaign(c)}
                    className="border-border/50 hover:bg-primary/10 transition-colors cursor-pointer group">
                    <TableCell className="font-mono text-sm">
                      <div className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(c.createdAt), 'yy-MM-dd HH:mm')}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-xs">{c.subject}</TableCell>
                    <TableCell className="font-mono text-sm text-right hidden sm:table-cell text-muted-foreground">{c.totalRecipients > 0 ? c.totalRecipients.toLocaleString() : "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-right text-primary hidden md:table-cell">
                      {c.sent > 0 ? `${((c.delivered / c.sent) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right text-warning hidden lg:table-cell">
                      {c.delivered > 0 ? `${((c.opened / c.delivered) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`font-mono uppercase text-[10px] ${getStatusColor(c.status)}`}>
                        {c.status === "sending" ? <><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block mr-1 animate-pulse" />{c.status}</> : c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </TableCell>
                  </TableRow>
                ))}
                {!campaigns?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center font-mono">
                      <div className="text-muted-foreground">NO_CAMPAIGNS_YET</div>
                      <div className="text-[10px] text-muted-foreground/50 mt-1">Click NEW_CAMPAIGN to create your first broadcast</div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Sheet open={!!detailCampaign} onOpenChange={v => !v && setDetailCampaign(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card border-l border-primary/30 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border mb-4">
            <SheetTitle className="font-mono text-primary text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> CAMPAIGN_CONTROL
            </SheetTitle>
          </SheetHeader>
          {detailCampaign && (
            <CampaignDetail
              campaign={detailCampaign}
              onClose={() => setDetailCampaign(null)}
              onRefetch={refetch}
              onEdit={openEditDialog}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Campaign Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditCampaign(null); }}>
        <DialogContent className="dialog-panel max-w-3xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <Pencil className="w-5 h-5" /> {'>'} EDIT_BROADCAST: <span className="text-foreground ml-1">{editCampaign?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 pb-6">
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 mt-4">
                <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                  <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">META_DATA</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">CAMPAIGN_NAME</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">SUBJECT — supports {"{{first_name}}"} etc</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="fromName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">SENDER_NAME</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="fromEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">FROM_ADDRESS</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                  <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">ROUTING</div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={editForm.control} name="templateId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">TEMPLATE</FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                          <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="None (plain)" /></SelectTrigger></FormControl>
                          <SelectContent className="bg-card border-border font-mono">
                            {templates?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                            {(!templates || templates.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">No templates yet</div>}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="segmentId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">AUDIENCE</FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                          <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select audience..." /></SelectTrigger></FormControl>
                          <SelectContent className="bg-card border-border font-mono">
                            {segments?.map((s: any) => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.contactCount ?? 0})</SelectItem>
                            ))}
                            {(!segments || segments.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">Import contacts first</div>}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="smtpProfileId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">SMTP_NODE</FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                          <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select SMTP..." /></SelectTrigger></FormControl>
                          <SelectContent className="bg-card border-border font-mono">
                            {profiles?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                            {(!profiles || profiles.length === 0) && <div className="px-3 py-2 text-xs text-muted-foreground">No SMTP profiles</div>}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    Subject supports template tags: {"{{first_name}}"} {"{{last_name}}"} {"{{company}}"} {"{{email}}"} etc.
                  </p>
                </div>

                <div className="p-4 border border-border bg-background/50 rounded space-y-4 relative">
                  <div className="absolute -top-3 left-4 bg-card px-2 font-mono text-xs text-primary">ADVANCED</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="tagFilter" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">TAG_FILTER</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="e.g. hot-lead" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="scheduledAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">SCHEDULE</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} className="font-mono bg-background focus-visible:ring-primary border-border text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="abSubjectVariant" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">A/B SUBJECT VARIANT</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Variant B subject line" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="abSplitPercent" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">A/B SPLIT %</FormLabel>
                        <FormControl><Input type="number" min={1} max={99} {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="50" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
                <Button type="submit" disabled={savingEdit} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                  {savingEdit ? "SAVING..." : "SAVE_CHANGES"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

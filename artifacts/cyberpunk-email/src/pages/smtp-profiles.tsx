import { useState, useCallback, useEffect } from "react";
import { useListSmtpProfiles, useCreateSmtpProfile, useVerifySmtpProfile, useDeleteSmtpProfile } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus, Server, Activity, ShieldAlert, CheckCircle, Trash2, Globe, Star, Lock,
  Wifi, WifiOff, Search, Zap, AlertTriangle, Terminal, ChevronDown, ChevronUp, RefreshCw, X, Pencil, Flame
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const smtpSchema = z.object({
  name: z.string().min(1, "Name required"),
  host: z.string().min(1, "Host required"),
  port: z.coerce.number().min(1).max(65535),
  encryption: z.enum(["none", "ssl", "tls", "starttls"]),
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
  fromName: z.string().min(1, "Sender name required"),
  fromEmail: z.string().email("Valid email required"),
  dailyLimit: z.coerce.number().optional(),
  hourlyLimit: z.coerce.number().optional(),
  isDefault: z.boolean().optional(),
  socks5Enabled: z.boolean().default(false),
  socks5Host: z.string().optional(),
  socks5Port: z.coerce.number().optional(),
  socks5Username: z.string().optional(),
  socks5Password: z.string().optional(),
});

const smtpEditSchema = smtpSchema.extend({
  password: z.string().optional(),
});

type SmtpFormValues = z.infer<typeof smtpSchema>;
type SmtpEditFormValues = z.infer<typeof smtpEditSchema>;

type SmtpProfile = {
  id: number; name: string; host: string; port: number; encryption: string;
  username: string; fromName: string; fromEmail: string;
  dailyLimit: number | null; hourlyLimit: number | null;
  status: string; isDefault: boolean; socks5Enabled: boolean;
  socks5Host: string | null; socks5Port: number | null; createdAt: string;
};

interface PortResult {
  port: number;
  open: boolean;
  latencyMs: number | null;
  error: string | null;
}

interface NetworkInfo {
  externalIp: string;
  ports: Record<number, PortResult & { label: string; blocked: boolean }>;
  port25Blocked: boolean;
  hasUsablePorts: boolean;
  recommendation: string;
  isp: string;
}

interface ScanResult {
  host: string;
  results: PortResult[];
  openCount: number;
  recommendation: { port: number; latencyMs: number; encryption: string; reason: string } | null;
}

interface AutoDetectResult {
  domain: string;
  mxRecords: { host: string; priority: number }[];
  mxHost: string;
  dnsError: string | null;
  provider: { name: string; note: string } | null;
  suggestion: { host: string; port: number; encryption: string; note: string };
  portScan: PortResult[];
  allBlocked: boolean;
  allTimedOut: boolean;
}

function PortBadge({ result }: { result: PortResult & { label?: string } }) {
  if (result.open) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(0,255,65,0.8)]" />
        <span className="font-mono text-[11px]">
          <span className="text-primary font-bold">:{result.port}</span>
          <span className="text-muted-foreground"> OPEN</span>
          {result.latencyMs && <span className="text-primary/60"> {result.latencyMs}ms</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-destructive/70" />
      <span className="font-mono text-[11px]">
        <span className="text-muted-foreground/60">:{result.port}</span>
        <span className="text-destructive/70"> {result.error ?? "CLOSED"}</span>
      </span>
    </div>
  );
}

function NetworkProbeCard() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const probe = useCallback(async () => {
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch(`${BASE}/api/network/info`);
      const data = await res.json();
      setInfo(data);
    } catch {
      toast({ title: "PROBE_FAILED", description: "Could not reach network scanner", variant: "destructive", className: "font-mono" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return (
    <Card className="terminal-panel border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono text-primary flex items-center gap-2">
            <Wifi className="w-4 h-4" /> {'>'} NETWORK_PROBE
            <span className="text-[10px] text-muted-foreground font-normal tracking-normal">— ISP port capabilities & outbound IP</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {info && (
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-primary transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs border-primary/50 text-primary hover:bg-primary hover:text-black"
              onClick={probe}
              disabled={loading}
            >
              {loading ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> SCANNING...</> : <><Zap className="w-3 h-3 mr-1.5" /> RUN_PROBE</>}
            </Button>
          </div>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="pt-0 pb-4">
          <div className="font-mono text-xs text-primary/70 space-y-1 animate-pulse">
            <div>{'>'} DETECTING EXTERNAL IP ADDRESS...</div>
            <div>{'>'} PROBING SMTP PORTS VIA TCP SOCKET...</div>
            <div>{'>'} CHECKING ISP RESTRICTIONS...</div>
          </div>
        </CardContent>
      )}

      {info && expanded && !loading && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-6 pb-3 border-b border-border/50">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">OUTBOUND_IP</div>
                <div className="font-mono text-sm text-foreground">{info.externalIp}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">ISP_PROFILE</div>
                <div className={`font-mono text-xs ${info.port25Blocked ? "text-warning" : "text-primary"}`}>{info.isp}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">STATUS</div>
                <div className={`font-mono text-xs ${info.hasUsablePorts ? "text-primary" : "text-destructive"}`}>
                  {info.hasUsablePorts ? "SENDING_CAPABLE" : "ALL_PORTS_BLOCKED"}
                </div>
              </div>
            </div>

            {info.port25Blocked && (
              <div className="flex items-start gap-3 p-3 border border-warning/30 rounded bg-warning/5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="font-mono text-xs text-warning">
                  PORT 25 IS BLOCKED BY YOUR ISP/HOST — This is normal for cloud providers to prevent spam. Use port 587 (STARTTLS) or 465 (SSL) instead.
                </div>
              </div>
            )}

            <div>
              <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-2">PORT_SCAN_RESULTS (→ smtp.gmail.com)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(info.ports).map(([port, result]) => (
                  <div key={port} className={`p-2.5 rounded border ${result.open ? "border-primary/30 bg-primary/5" : "border-border/30 bg-background/30"}`}>
                    <div className="font-mono text-[10px] text-muted-foreground/60 mb-1">{result.label}</div>
                    <PortBadge result={result} />
                  </div>
                ))}
              </div>
            </div>

            <div className="font-mono text-[10px] text-primary/70 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" /> {info.recommendation}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function PortScanDialog({ profile }: { profile: { id: number; name: string; host: string; port: number } }) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const { toast } = useToast();

  const runScan = useCallback(async () => {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/network/scan-ports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: profile.host, ports: [25, 465, 587, 2525] }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      toast({ title: "SCAN_FAILED", description: "Network error during port scan", variant: "destructive", className: "font-mono" });
    } finally {
      setScanning(false);
    }
  }, [profile.host, toast]);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v && !result) runScan();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="font-mono text-[10px] border-primary/30 text-primary/80 hover:bg-primary/10 px-2 h-7">
          <Search className="w-3 h-3 mr-1" /> SCAN
        </Button>
      </DialogTrigger>
      <DialogContent className="dialog-panel max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="font-mono text-primary flex items-center gap-2 text-sm">
            <Server className="w-4 h-4" /> PORT_SCAN: {profile.name}
          </DialogTitle>
          <div className="font-mono text-xs text-muted-foreground mt-1">TARGET: {profile.host}</div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-4 space-y-4">
          {scanning && (
            <div className="space-y-2 font-mono text-xs">
              {[25, 465, 587, 2525].map((p) => (
                <div key={p} className="flex items-center gap-2 text-primary/60 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>PROBING :{p}...</span>
                </div>
              ))}
            </div>
          )}

          {result && !scanning && (
            <>
              <div className="space-y-2">
                {result.results.map((r) => (
                  <div key={r.port} className={`flex items-center justify-between p-3 rounded border ${r.open ? "border-primary/40 bg-primary/5" : "border-border/30 bg-background/20"}`}>
                    <div className="flex items-center gap-3">
                      {r.open
                        ? <CheckCircle className="w-4 h-4 text-primary" />
                        : <X className="w-4 h-4 text-destructive/50" />}
                      <div>
                        <div className="font-mono text-sm text-foreground">Port {r.port}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.port === 25 ? "SMTP (legacy)" : r.port === 465 ? "SMTPS/SSL" : r.port === 587 ? "SUBMISSION/STARTTLS" : "ALTERNATE"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {r.open ? (
                        <div>
                          <span className="font-mono text-xs text-primary">OPEN</span>
                          <div className="font-mono text-[10px] text-primary/60">{r.latencyMs}ms RTT</div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-destructive/60">{r.error ?? "CLOSED"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {result.recommendation ? (
                <div className="p-3 border border-primary/40 rounded bg-primary/5">
                  <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">RECOMMENDATION</div>
                  <div className="font-mono text-sm text-primary">
                    USE PORT {result.recommendation.port} [{result.recommendation.encryption.toUpperCase()}]
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">{result.recommendation.reason}</div>
                </div>
              ) : (
                <div className="p-3 border border-destructive/40 rounded bg-destructive/5">
                  <div className="font-mono text-sm text-destructive flex items-center gap-2">
                    <WifiOff className="w-4 h-4" /> ALL PORTS BLOCKED
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    Cannot reach {profile.host} on any SMTP port. Check firewall, hostname, or use a SOCKS5 proxy.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-muted-foreground">
                  OPEN: {result.openCount}/4 PORTS
                </div>
                <Button size="sm" variant="outline" className="font-mono text-xs border-primary/40 text-primary hover:bg-primary/10" onClick={runScan}>
                  <RefreshCw className="w-3 h-3 mr-1.5" /> RE-SCAN
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoDetectSection({ onApply }: {
  onApply: (vals: { host: string; port: number; encryption: string; name?: string }) => void
}) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoDetectResult | null>(null);
  const { toast } = useToast();

  const detect = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/network/auto-detect-smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      toast({ title: "DETECT_FAILED", description: "Auto-detect failed", variant: "destructive", className: "font-mono" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border border-primary/30 rounded bg-primary/5 relative">
      <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">AUTO_DETECT_SMTP</div>
      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && detect()}
          placeholder="gmail.com, yourcompany.com, amazon.com..."
          className="font-mono bg-background focus-visible:ring-primary border-border text-sm flex-1"
        />
        <Button
          type="button"
          size="sm"
          onClick={detect}
          disabled={loading || !domain.trim()}
          className="bg-primary text-black hover:bg-primary/80 font-mono shrink-0"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
          {loading ? "" : "DETECT"}
        </Button>
      </div>

      {loading && (
        <div className="font-mono text-[10px] text-primary/60 space-y-0.5 animate-pulse">
          <div>{'>'} RESOLVING MX RECORDS FOR {domain.toUpperCase()}...</div>
          <div>{'>'} MATCHING KNOWN SMTP PROVIDERS...</div>
          <div>{'>'} PROBING OPEN PORTS...</div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-[10px] font-mono border-t border-border/30 pt-3">
            {result.provider && (
              <div>
                <span className="text-muted-foreground">PROVIDER: </span>
                <span className="text-primary">{result.provider.name}</span>
              </div>
            )}
            {result.mxHost && (
              <div>
                <span className="text-muted-foreground">MX: </span>
                <span className="text-foreground">{result.mxHost}</span>
              </div>
            )}
            {result.dnsError && (
              <div>
                <span className="text-warning">DNS_ERR: {result.dnsError}</span>
              </div>
            )}
          </div>

          <div className="p-3 border border-primary/30 rounded bg-background/40 space-y-1.5">
            <div className="font-mono text-[10px] text-muted-foreground tracking-widest">SUGGESTED_CONFIG</div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div><span className="text-muted-foreground/60">HOST:</span> <span className="text-foreground">{result.suggestion.host}</span></div>
              <div><span className="text-muted-foreground/60">PORT:</span> <span className="text-primary">{result.suggestion.port}</span></div>
              <div><span className="text-muted-foreground/60">ENC:</span> <span className="text-primary">{result.suggestion.encryption.toUpperCase()}</span></div>
            </div>
            {result.provider?.note && (
              <div className="font-mono text-[10px] text-warning/80 mt-1 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {result.provider.note}
              </div>
            )}
          </div>

          {result.allTimedOut && (
            <div className="flex items-start gap-2 p-2.5 border border-orange-500/40 rounded bg-orange-500/5 text-orange-400 font-mono text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                All SMTP ports timed out — outbound SMTP may be blocked by this hosting environment's firewall.
                You can still <strong>APPLY_CONFIG</strong> and use a SOCKS5 proxy to route around the restriction.
              </span>
            </div>
          )}
          {result.allBlocked && !result.allTimedOut && (
            <div className="flex items-start gap-2 p-2.5 border border-red-500/40 rounded bg-red-500/5 text-red-400 font-mono text-[10px]">
              <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>No SMTP ports are open on <strong>{result.suggestion.host}</strong>. Check the hostname or try a different server.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-wrap flex-1">
              {result.portScan.map((r) => (
                <span key={r.port} className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${r.open ? "border-primary/40 text-primary bg-primary/10" : r.error === "TIMEOUT" ? "border-orange-500/30 text-orange-400/50" : "border-border/30 text-muted-foreground/40"}`}>
                  :{r.port} {r.open ? "OPEN" : r.error === "TIMEOUT" ? "TIMEOUT" : "×"}
                </span>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-primary text-black hover:bg-primary/80 font-mono text-xs shrink-0"
              onClick={() => onApply({
                host: result.suggestion.host,
                port: result.suggestion.port,
                encryption: result.suggestion.encryption,
                name: result.provider?.name,
              })}
            >
              APPLY_CONFIG
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SmtpProfiles() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<SmtpProfile | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [socks5Enabled, setSocks5Enabled] = useState(false);
  const [editSocks5Enabled, setEditSocks5Enabled] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [warmupTarget, setWarmupTarget] = useState<SmtpProfile | null>(null);
  const [warmupConfig, setWarmupConfig] = useState({ startDailyVolume: 10, dailySendLimit: 200, rampUpDays: 30 });
  const [savingWarmup, setSavingWarmup] = useState(false);
  const [smtpEnvStatus, setSmtpEnvStatus] = useState<"checking" | "open" | "blocked" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSmtpEnvStatus("checking");
    fetch(`${BASE}/api/network/info`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSmtpEnvStatus(d.hasUsablePorts ? "open" : "blocked"); })
      .catch(() => { if (!cancelled) setSmtpEnvStatus(null); });
    return () => { cancelled = true; };
  }, []);

  const { data: profiles, isLoading, refetch } = useListSmtpProfiles();
  const createMutation = useCreateSmtpProfile();
  const verifyMutation = useVerifySmtpProfile();
  const deleteMutation = useDeleteSmtpProfile();

  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      name: "", host: "", port: 587, encryption: "starttls",
      username: "", password: "", fromName: "", fromEmail: "",
      dailyLimit: undefined, hourlyLimit: undefined,
      isDefault: false, socks5Enabled: false,
      socks5Host: "", socks5Port: undefined, socks5Username: "", socks5Password: "",
    },
  });

  const editForm = useForm<SmtpEditFormValues>({
    resolver: zodResolver(smtpEditSchema),
    defaultValues: {
      name: "", host: "", port: 587, encryption: "starttls",
      username: "", password: "", fromName: "", fromEmail: "",
      dailyLimit: undefined, hourlyLimit: undefined,
      isDefault: false, socks5Enabled: false,
      socks5Host: "", socks5Port: undefined, socks5Username: "", socks5Password: "",
    },
  });

  const saveWarmup = async () => {
    if (!warmupTarget) return;
    setSavingWarmup(true);
    try {
      const res = await fetch(`${BASE}/api/warmup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpProfileId: warmupTarget.id, ...warmupConfig }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "WARMUP_SCHEDULED", description: `${warmupTarget.name} will ramp up over ${warmupConfig.rampUpDays} days`, className: "border-primary bg-background text-primary font-mono" });
      setWarmupTarget(null);
    } catch (err: any) {
      toast({ title: "WARMUP_FAILED", description: err.message, variant: "destructive", className: "font-mono" });
    } finally { setSavingWarmup(false); }
  };

  const openEditDialog = (p: SmtpProfile) => {
    setEditProfile(p);
    setEditSocks5Enabled(p.socks5Enabled);
    editForm.reset({
      name: p.name,
      host: p.host,
      port: p.port,
      encryption: p.encryption as any,
      username: p.username,
      password: "",
      fromName: p.fromName,
      fromEmail: p.fromEmail,
      dailyLimit: p.dailyLimit ?? undefined,
      hourlyLimit: p.hourlyLimit ?? undefined,
      isDefault: p.isDefault,
      socks5Enabled: p.socks5Enabled,
      socks5Host: p.socks5Host ?? "",
      socks5Port: p.socks5Port ?? undefined,
      socks5Username: "",
      socks5Password: "",
    });
    setEditOpen(true);
  };

  const onEditSubmit = async (values: SmtpEditFormValues) => {
    if (!editProfile) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      if (!payload.password) delete payload.password;
      const res = await fetch(`${BASE}/api/smtp-profiles/${editProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast({ title: "NODE_UPDATED", description: `${values.name} configuration saved`, className: "border-primary bg-background text-primary font-mono" });
      setEditOpen(false);
      setEditProfile(null);
      refetch();
    } catch {
      toast({ title: "UPDATE_FAILED", description: "Could not save changes", variant: "destructive", className: "font-mono" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAutoDetectApply = (vals: { host: string; port: number; encryption: string; name?: string }) => {
    form.setValue("host", vals.host);
    form.setValue("port", vals.port);
    form.setValue("encryption", vals.encryption as any);
    if (vals.name && !form.getValues("name")) {
      form.setValue("name", vals.name);
    }
    toast({ title: "CONFIG_APPLIED", description: `${vals.host}:${vals.port} loaded into form`, className: "border-primary bg-background text-primary font-mono" });
  };

  const onSubmit = (values: SmtpFormValues) => {
    createMutation.mutate({ data: values as any }, {
      onSuccess: () => {
        toast({ title: "NODE_INITIALIZED", description: `${values.name} relay registered`, className: "border-primary bg-background text-primary font-mono" });
        setCreateOpen(false);
        form.reset();
        setSocks5Enabled(false);
        refetch();
      },
      onError: () => toast({ title: "INIT_FAILED", description: "Could not register relay node", variant: "destructive", className: "font-mono" }),
    });
  };

  const handleVerify = (id: number) => {
    setVerifyingId(id);
    verifyMutation.mutate({ id }, {
      onSuccess: (res: any) => {
        if (res.success) {
          toast({ title: "HANDSHAKE_OK", description: `RTT: ${res.latencyMs}ms — SMTP relay verified`, className: "border-primary bg-background text-primary font-mono" });
        } else {
          const code: string = res.errorCode ?? "SMTP_ERROR";
          const titleMap: Record<string, string> = {
            TIMEOUT: "PORT_BLOCKED",
            REFUSED: "CONNECTION_REFUSED",
            DNS_FAIL: "DNS_FAILURE",
            UNREACHABLE: "HOST_UNREACHABLE",
            AUTH_FAIL: "AUTH_FAILED",
            TLS_REQUIRED: "TLS_MISMATCH",
            CERT_ERROR: "CERT_ERROR",
          };
          toast({ title: titleMap[code] ?? "HANDSHAKE_FAIL", description: res.message, variant: "destructive", className: "font-mono text-xs" });
        }
        refetch();
      },
      onError: () => toast({ title: "NETWORK_ERROR", description: "Could not reach relay", variant: "destructive", className: "font-mono" }),
      onSettled: () => setVerifyingId(null),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate({ id: deleteId }, {
      onSuccess: () => {
        toast({ title: "NODE_PURGED", description: "Relay removed from registry", className: "border-primary bg-background text-primary font-mono" });
        refetch();
      },
      onError: () => toast({ title: "PURGE_FAILED", description: "Could not delete relay", variant: "destructive", className: "font-mono" }),
      onSettled: () => setDeleteId(null),
    });
  };

  const profileToDelete = profiles?.find(p => p.id === deleteId);

  return (
    <PageTransition className="space-y-5 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">SMTP_RELAYS</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {profiles?.length ?? 0} NODE{profiles?.length !== 1 ? "S" : ""} REGISTERED
            {profiles?.some(p => p.socks5Enabled) && (
              <span className="ml-3 text-primary/70">· SOCKS5_TUNNELS: {profiles!.filter(p => p.socks5Enabled).length}</span>
            )}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { form.reset(); setSocks5Enabled(false); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono">
              <Plus className="w-4 h-4 mr-2" /> ADD_RELAY
            </Button>
          </DialogTrigger>
          <DialogContent className="dialog-panel max-w-2xl max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
              <DialogTitle className="font-mono text-primary flex items-center gap-2">
                <Server className="w-5 h-5" /> {'> CONFIGURE_SMTP_NODE'}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-6 pb-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">

                  <AutoDetectSection onApply={handleAutoDetectApply} />

                  <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                    <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">NODE_IDENTITY</div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">PROFILE_NAME</FormLabel>
                          <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="AWS SES Node 1" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="fromName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">SENDER_NAME</FormLabel>
                          <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="CyberMail Bot" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="fromEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">SENDER_ADDRESS</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="noreply@yourdomain.com" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                    <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">CONNECTION</div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="host" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">HOST_ADDRESS</FormLabel>
                          <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="smtp.example.com" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="port" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PORT</FormLabel>
                            <FormControl><Input type="number" {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="encryption" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PROTOCOL</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="font-mono bg-background focus-visible:ring-primary border-border">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-card border-border font-mono text-foreground">
                                <SelectItem value="none">NONE</SelectItem>
                                <SelectItem value="ssl">SSL</SelectItem>
                                <SelectItem value="tls">TLS</SelectItem>
                                <SelectItem value="starttls">STARTTLS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="username" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">AUTH_USER</FormLabel>
                          <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">AUTH_SECRET</FormLabel>
                          <FormControl><Input type="password" {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                    <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">RATE_LIMITS</div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="dailyLimit" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">DAILY_CAP <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                          <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="50000" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hourlyLimit" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">HOURLY_CAP <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                          <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="2000" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                    <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">SOCKS5_PROXY</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="font-mono text-sm text-foreground">TUNNEL_TRAFFIC_THROUGH_PROXY</span>
                      </div>
                      <Switch
                        checked={socks5Enabled}
                        onCheckedChange={(v) => { setSocks5Enabled(v); form.setValue("socks5Enabled", v); }}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    {socks5Enabled && (
                      <div className="space-y-3 pt-2 border-t border-border/30">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="socks5Host" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_HOST</FormLabel>
                              <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="127.0.0.1" /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="socks5Port" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_PORT</FormLabel>
                              <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="1080" /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="socks5Username" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_USER <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                              <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="socks5Password" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_SECRET <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                              <FormControl><Input type="password" {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-primary/60">
                          <Lock className="w-3 h-3" /> TRAFFIC WILL BE TUNNELED VIA SOCKS5 — HIDES ORIGIN IP
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField control={form.control} name="isDefault" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0 p-3 border border-border/30 rounded bg-background/20">
                      <FormControl>
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                      </FormControl>
                      <FormLabel className="font-mono text-sm text-muted-foreground cursor-pointer">SET_AS_DEFAULT_NODE</FormLabel>
                    </FormItem>
                  )} />

                  <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                    {createMutation.isPending ? "INITIALIZING..." : "INITIALIZE_NODE"}
                  </Button>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {smtpEnvStatus === "blocked" && (
        <div className="flex items-start gap-3 p-3 border border-orange-500/50 rounded bg-orange-500/5">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="font-mono text-xs text-orange-300 space-y-1">
            <p className="font-bold text-orange-400">SMTP_PORTS_BLOCKED — Outbound mail connections are restricted</p>
            <p className="text-orange-300/80">
              This hosting environment blocks ports 25, 465, 587, and 2525. Direct SMTP sending will fail.
              Options: <span className="text-orange-400">① Configure a SOCKS5 proxy</span> in each relay profile,
              or <span className="text-orange-400">② use a relay service</span> (SendGrid, Mailgun, AWS SES) that accepts
              HTTPS-based API — or move sending to a VPS with unrestricted egress.
            </p>
          </div>
        </div>
      )}

      <NetworkProbeCard />

      <Card className="terminal-panel flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center text-primary"><TerminalText text="> PINGING_NODES..." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-background/50 sticky top-0 backdrop-blur">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-primary text-xs">NODE_NAME</TableHead>
                  <TableHead className="font-mono text-primary text-xs">HOST</TableHead>
                  <TableHead className="font-mono text-primary text-xs">SENDER</TableHead>
                  <TableHead className="font-mono text-primary text-xs">CAPS</TableHead>
                  <TableHead className="font-mono text-primary text-xs w-[100px]">STATUS</TableHead>
                  <TableHead className="font-mono text-primary text-xs w-[200px] text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles?.map((p) => (
                  <TableRow key={p.id} className="border-border/50 hover:bg-primary/10 transition-colors group">
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{p.name}</span>
                        {p.isDefault && <Star className="w-3 h-3 text-primary fill-primary" />}
                        {p.socks5Enabled && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded">SOCKS5</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.host}:{p.port}
                      <span className="ml-1 text-primary/60">[{p.encryption.toUpperCase()}]</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div>{p.fromName}</div>
                      <div className="text-primary/60">{p.fromEmail}</div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground/70">
                      {p.dailyLimit ? <div>D: {p.dailyLimit.toLocaleString()}/day</div> : <div className="text-muted-foreground/30">∞ /day</div>}
                      {p.hourlyLimit ? <div>H: {p.hourlyLimit.toLocaleString()}/hr</div> : <div className="text-muted-foreground/30">∞ /hr</div>}
                    </TableCell>
                    <TableCell>
                      {p.status === 'verified' ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono uppercase text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" /> ACTIVE
                        </Badge>
                      ) : p.status === 'failed' ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-mono uppercase text-[10px]">
                          <ShieldAlert className="w-3 h-3 mr-1" /> FAULT
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 font-mono uppercase text-[10px]">
                          <Activity className="w-3 h-3 mr-1" /> PENDING
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <PortScanDialog profile={p} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs border-primary/50 text-primary hover:bg-primary hover:text-black transition-colors h-7 px-2"
                          onClick={() => handleVerify(p.id)}
                          disabled={verifyingId === p.id}
                        >
                          {verifyingId === p.id ? "..." : "VERIFY"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs border-primary/30 text-primary/60 hover:border-primary hover:text-primary transition-colors w-7 h-7 px-0"
                          onClick={(e) => { e.stopPropagation(); setWarmupTarget(p as SmtpProfile); }}
                          title="Configure warmup"
                        >
                          <Flame className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs border-border/60 text-muted-foreground hover:border-primary hover:text-primary transition-colors w-7 h-7 px-0"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(p as SmtpProfile); }}
                          title="Edit profile"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-colors w-7 h-7 px-0"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!profiles?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono">
                      <TerminalText text="> NO_NODES_REGISTERED — CLICK [ADD_RELAY] TO INITIALIZE" />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        {profiles && profiles.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>
              VERIFIED: {profiles.filter(p => p.status === 'verified').length}/{profiles.length}
              {" · "}SOCKS5: {profiles.filter(p => p.socks5Enabled).length}
            </span>
            <span>DEFAULT: {profiles.find(p => p.isDefault)?.name ?? "NONE"}</span>
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditProfile(null); }}>
        <DialogContent className="dialog-panel max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <Pencil className="w-5 h-5" /> {'> EDIT_SMTP_NODE'}: <span className="text-foreground">{editProfile?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 pb-6">
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-5 mt-4">
                <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">NODE_IDENTITY</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">PROFILE_NAME</FormLabel>
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
                  </div>
                  <FormField control={editForm.control} name="fromEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-muted-foreground text-xs">SENDER_ADDRESS</FormLabel>
                      <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                      <FormMessage className="text-destructive font-mono text-xs" />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">CONNECTION</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="host" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">HOST_ADDRESS</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={editForm.control} name="port" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">PORT</FormLabel>
                          <FormControl><Input type="number" {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="encryption" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-muted-foreground text-xs">PROTOCOL</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="font-mono bg-background focus-visible:ring-primary border-border">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border font-mono text-foreground">
                              <SelectItem value="none">NONE</SelectItem>
                              <SelectItem value="ssl">SSL</SelectItem>
                              <SelectItem value="tls">TLS</SelectItem>
                              <SelectItem value="starttls">STARTTLS</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive font-mono text-xs" />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">AUTH_USER</FormLabel>
                        <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">
                          AUTH_SECRET <span className="text-muted-foreground/50">(leave blank to keep)</span>
                        </FormLabel>
                        <FormControl><Input type="password" {...field} placeholder="••••••••" className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">RATE_LIMITS</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="dailyLimit" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">DAILY_CAP <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="50000" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="hourlyLimit" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-muted-foreground text-xs">HOURLY_CAP <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="2000" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-3 p-4 border border-border/50 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">SOCKS5_PROXY</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="font-mono text-sm text-foreground">TUNNEL_TRAFFIC_THROUGH_PROXY</span>
                    </div>
                    <Switch
                      checked={editSocks5Enabled}
                      onCheckedChange={(v) => { setEditSocks5Enabled(v); editForm.setValue("socks5Enabled", v); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  {editSocks5Enabled && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="socks5Host" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_HOST</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="127.0.0.1" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={editForm.control} name="socks5Port" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_PORT</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value ?? ""} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="1080" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="socks5Username" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_USER <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={editForm.control} name="socks5Password" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">PROXY_SECRET <span className="text-muted-foreground/40">(optional)</span></FormLabel>
                            <FormControl><Input type="password" {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-primary/60">
                        <Lock className="w-3 h-3" /> TRAFFIC WILL BE TUNNELED VIA SOCKS5 — HIDES ORIGIN IP
                      </div>
                    </div>
                  )}
                </div>

                <FormField control={editForm.control} name="isDefault" render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 p-3 border border-border/30 rounded bg-background/20">
                    <FormControl>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                    </FormControl>
                    <FormLabel className="font-mono text-sm text-muted-foreground cursor-pointer">SET_AS_DEFAULT_NODE</FormLabel>
                  </FormItem>
                )} />

                <Button type="submit" disabled={savingEdit} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                  {savingEdit ? "SAVING..." : "SAVE_CHANGES"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warmup Dialog */}
      <Dialog open={!!warmupTarget} onOpenChange={v => !v && setWarmupTarget(null)}>
        <DialogContent className="dialog-panel max-w-md p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <Flame className="w-5 h-5" /> {'> EMAIL_WARMUP'}: <span className="text-foreground">{warmupTarget?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 mt-4 space-y-4">
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Warmup gradually increases sending volume over time to build domain reputation.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="font-mono text-xs text-muted-foreground">START_DAILY_VOLUME (emails/day at start)</label>
                <Input type="number" value={warmupConfig.startDailyVolume} onChange={e => setWarmupConfig(c => ({ ...c, startDailyVolume: +e.target.value }))}
                  className="font-mono bg-background border-border focus-visible:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-xs text-muted-foreground">MAX_DAILY_VOLUME (target emails/day)</label>
                <Input type="number" value={warmupConfig.dailySendLimit} onChange={e => setWarmupConfig(c => ({ ...c, dailySendLimit: +e.target.value }))}
                  className="font-mono bg-background border-border focus-visible:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-xs text-muted-foreground">RAMP_UP_DAYS (days to reach max volume)</label>
                <Input type="number" value={warmupConfig.rampUpDays} onChange={e => setWarmupConfig(c => ({ ...c, rampUpDays: +e.target.value }))}
                  className="font-mono bg-background border-border focus-visible:ring-primary" />
              </div>
            </div>
            <div className="p-3 bg-primary/5 border border-primary/20 rounded font-mono text-[10px] text-muted-foreground">
              <span className="text-primary">PROJECTION:</span> Start at {warmupConfig.startDailyVolume}/day, reaching {warmupConfig.dailySendLimit}/day in {warmupConfig.rampUpDays} days
            </div>
            <Button onClick={saveWarmup} disabled={savingWarmup} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
              {savingWarmup ? "SCHEDULING..." : "ACTIVATE_WARMUP"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="dialog-panel max-w-md border-destructive/50 shadow-[0_0_30px_rgba(255,0,64,0.2)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> {'> CONFIRM_PURGE'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground">
              NODE: <span className="text-foreground">{profileToDelete?.name}</span><br />
              HOST: <span className="text-foreground">{profileToDelete?.host}:{profileToDelete?.port}</span>
              <br /><br />
              This relay will be permanently removed. Campaigns using this node must be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono border-border text-muted-foreground hover:bg-border">ABORT</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="font-mono bg-destructive text-white hover:bg-destructive/80">
              PURGE_NODE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}

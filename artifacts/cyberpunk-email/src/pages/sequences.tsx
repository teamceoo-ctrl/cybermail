import { useState } from "react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GitBranch, Play, Pause, ChevronRight, Users, CheckCircle, Pencil, X } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Sequence = {
  id: number;
  name: string;
  fromName: string;
  fromEmail: string;
  smtpProfileId: number | null;
  tagFilter: string | null;
  status: string;
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
  steps?: Step[];
};

type Step = {
  id: number;
  sequenceId: number;
  stepOrder: number;
  subject: string;
  htmlContent: string;
  delayDays: number;
  delayHours: number;
};

type SmtpProfile = { id: number; name: string };

async function fetchSequences(): Promise<Sequence[]> {
  const res = await fetch(`${BASE}/api/sequences`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchSequenceDetail(id: number): Promise<Sequence & { steps: Step[] }> {
  const res = await fetch(`${BASE}/api/sequences/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchSmtpProfiles(): Promise<SmtpProfile[]> {
  const res = await fetch(`${BASE}/api/smtp-profiles`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    draft: "bg-muted/50 text-muted-foreground border-border",
    archived: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return <Badge className={`font-mono text-[10px] ${cls[status] ?? cls.draft}`}>{status.toUpperCase()}</Badge>;
}

export default function Sequences() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: sequences = [], isLoading } = useQuery({ queryKey: ["sequences"], queryFn: fetchSequences });
  const { data: smtpProfiles = [] } = useQuery({ queryKey: ["smtp-profiles"], queryFn: fetchSmtpProfiles });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState<number | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  const [form, setForm] = useState({ name: "", fromName: "", fromEmail: "", smtpProfileId: "", tagFilter: "" });
  const [stepForm, setStepForm] = useState({ subject: "", htmlContent: "", delayDays: 0, delayHours: 0, stepOrder: 1 });

  const { data: detail } = useQuery({
    queryKey: ["sequence-detail", selectedSeqId],
    queryFn: () => fetchSequenceDetail(selectedSeqId!),
    enabled: !!selectedSeqId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          fromName: form.fromName,
          fromEmail: form.fromEmail,
          smtpProfileId: form.smtpProfileId ? Number(form.smtpProfileId) : null,
          tagFilter: form.tagFilter || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      toast({ title: "Sequence created" });
      setShowCreate(false);
      setForm({ name: "", fromName: "", fromEmail: "", smtpProfileId: "", tagFilter: "" });
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/sequences/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedSeqId) { setSelectedSeqId(null); }
      toast({ title: "Sequence deleted" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`${BASE}/api/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      qc.invalidateQueries({ queryKey: ["sequence-detail", selectedSeqId] });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/sequences/${id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      qc.invalidateQueries({ queryKey: ["sequence-detail", selectedSeqId] });
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const addStepMutation = useMutation({
    mutationFn: async (seqId: number) => {
      const res = await fetch(`${BASE}/api/sequences/${seqId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(stepForm),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequence-detail", selectedSeqId] });
      toast({ title: "Step added" });
      setShowStepEditor(false);
      setStepForm({ subject: "", htmlContent: "", delayDays: 0, delayHours: 0, stepOrder: (detail?.steps?.length ?? 0) + 2 });
    },
    onError: () => toast({ title: "Failed to add step", variant: "destructive" }),
  });

  const deleteStepMutation = useMutation({
    mutationFn: async ({ seqId, stepId }: { seqId: number; stepId: number }) => {
      const res = await fetch(`${BASE}/api/sequences/${seqId}/steps/${stepId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequence-detail", selectedSeqId] }),
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <TerminalText text="DRIP_SEQUENCES" className="text-2xl font-bold text-primary" />
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Multi-step email sequences with time delays — automated follow-up on autopilot.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="font-mono">
            <Plus className="h-3.5 w-3.5 mr-1" /> NEW SEQUENCE
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{sequences.length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">TOTAL SEQUENCES</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-green-400">{sequences.filter(s => s.status === "active").length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">ACTIVE</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{sequences.reduce((a, s) => a + (s.enrolledCount ?? 0), 0)}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">TOTAL ENROLLED</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-primary/20 bg-card/60">
            <div className="p-4 border-b border-border/50 font-mono text-xs text-primary/70 tracking-widest">SEQUENCES</div>
            <Table>
              <TableHeader>
                <TableRow className="border-primary/20">
                  <TableHead className="font-mono text-primary/70 text-xs">NAME</TableHead>
                  <TableHead className="font-mono text-primary/70 text-xs">STATUS</TableHead>
                  <TableHead className="font-mono text-primary/70 text-xs">ENROLLED</TableHead>
                  <TableHead className="font-mono text-primary/70 text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center font-mono text-muted-foreground text-xs py-8">LOADING...</TableCell></TableRow>
                ) : sequences.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center font-mono text-muted-foreground text-xs py-8">NO SEQUENCES YET.</TableCell></TableRow>
                ) : (
                  sequences.map(s => (
                    <TableRow
                      key={s.id}
                      className={`border-primary/10 cursor-pointer hover:bg-primary/5 ${selectedSeqId === s.id ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedSeqId(s.id)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{s.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.enrolledCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            onClick={e => { e.stopPropagation(); deleteMutation.mutate(s.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {selectedSeqId && detail ? (
            <Card className="border-primary/20 bg-card/60">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm font-bold text-primary">{detail.name}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{detail.fromName} &lt;{detail.fromEmail}&gt;</div>
                </div>
                <div className="flex items-center gap-2">
                  {detail.status === "active" ? (
                    <Button size="sm" variant="outline" className="font-mono text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      onClick={() => patchMutation.mutate({ id: detail.id, status: "paused" })}>
                      <Pause className="h-3 w-3 mr-1" /> PAUSE
                    </Button>
                  ) : (
                    <Button size="sm" className="font-mono text-xs"
                      onClick={() => patchMutation.mutate({ id: detail.id, status: "active" })}>
                      <Play className="h-3 w-3 mr-1" /> ACTIVATE
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="font-mono text-xs border-primary/30"
                    onClick={() => enrollMutation.mutate(detail.id)}
                    disabled={enrollMutation.isPending}>
                    <Users className="h-3 w-3 mr-1" /> ENROLL
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-xs text-primary/70 tracking-widest">STEPS ({detail.steps?.length ?? 0})</div>
                  <Button size="sm" variant="outline" className="font-mono text-xs border-primary/30 h-7"
                    onClick={() => {
                      setStepForm({ subject: "", htmlContent: "", delayDays: 0, delayHours: 0, stepOrder: (detail.steps?.length ?? 0) + 1 });
                      setShowStepEditor(true);
                    }}>
                    <Plus className="h-3 w-3 mr-1" /> ADD STEP
                  </Button>
                </div>

                {(!detail.steps || detail.steps.length === 0) ? (
                  <div className="text-center font-mono text-muted-foreground text-xs py-6">No steps yet. Add a step to get started.</div>
                ) : (
                  <div className="space-y-2">
                    {detail.steps.map((step, idx) => (
                      <div key={step.id} className="border border-primary/20 rounded p-3 bg-primary/5 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-mono text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-mono text-xs font-medium text-foreground">{step.subject}</div>
                            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              Send after: {step.delayDays}d {step.delayHours}h
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400 shrink-0"
                          onClick={() => deleteStepMutation.mutate({ seqId: detail.id, stepId: step.id })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50 mt-3">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-primary">{detail.enrolledCount}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">ENROLLED</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-green-400">{detail.completedCount}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">COMPLETED</div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-card/60 flex items-center justify-center p-8">
              <div className="text-center">
                <GitBranch className="h-8 w-8 text-primary/30 mx-auto mb-2" />
                <div className="font-mono text-xs text-muted-foreground">Select a sequence to view details and steps</div>
              </div>
            </Card>
          )}
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="border-primary/30 bg-card max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-primary">NEW SEQUENCE</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">SEQUENCE NAME</div>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Welcome Sequence" className="font-mono text-xs border-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">FROM NAME</div>
                  <Input value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="John Doe" className="font-mono text-xs border-primary/30" />
                </div>
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">FROM EMAIL</div>
                  <Input value={form.fromEmail} onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} placeholder="hello@example.com" className="font-mono text-xs border-primary/30" />
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">SMTP PROFILE</div>
                <Select value={form.smtpProfileId} onValueChange={v => setForm(f => ({ ...f, smtpProfileId: v }))}>
                  <SelectTrigger className="font-mono text-xs border-primary/30">
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {smtpProfiles.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">TAG FILTER (optional)</div>
                <Input value={form.tagFilter} onChange={e => setForm(f => ({ ...f, tagFilter: e.target.value }))} placeholder="e.g. hot-lead (only enroll contacts with this tag)" className="font-mono text-xs border-primary/30" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.fromName || !form.fromEmail || createMutation.isPending} className="w-full font-mono">
                <Plus className="h-3.5 w-3.5 mr-1" /> CREATE SEQUENCE
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStepEditor} onOpenChange={setShowStepEditor}>
          <DialogContent className="border-primary/30 bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-mono text-primary">ADD SEQUENCE STEP</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">SUBJECT LINE</div>
                <Input value={stepForm.subject} onChange={e => setStepForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject line for this step" className="font-mono text-xs border-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">DELAY (DAYS)</div>
                  <Input type="number" min={0} value={stepForm.delayDays} onChange={e => setStepForm(f => ({ ...f, delayDays: Number(e.target.value) }))} className="font-mono text-xs border-primary/30" />
                </div>
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">DELAY (HOURS)</div>
                  <Input type="number" min={0} max={23} value={stepForm.delayHours} onChange={e => setStepForm(f => ({ ...f, delayHours: Number(e.target.value) }))} className="font-mono text-xs border-primary/30" />
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">EMAIL BODY (HTML)</div>
                <textarea
                  value={stepForm.htmlContent}
                  onChange={e => setStepForm(f => ({ ...f, htmlContent: e.target.value }))}
                  rows={6}
                  placeholder="<p>Hello {{first_name}},</p><p>Your message here...</p>"
                  className="w-full font-mono text-xs bg-background border border-primary/30 rounded p-2 resize-none text-foreground focus:outline-none focus:border-primary"
                />
                <div className="font-mono text-[9px] text-muted-foreground mt-1">Supports: &#123;&#123;first_name&#125;&#125;, &#123;&#123;email&#125;&#125;, &#123;&#123;company&#125;&#125;, &#123;&#123;unsubscribe_url&#125;&#125;</div>
              </div>
              <Button
                onClick={() => selectedSeqId && addStepMutation.mutate(selectedSeqId)}
                disabled={!stepForm.subject || !stepForm.htmlContent || addStepMutation.isPending}
                className="w-full font-mono"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> ADD STEP
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}

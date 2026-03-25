import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanSearch, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Loader2, MailCheck, Send, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface DeliverabilityCheck {
  id: string;
  category: "subject" | "content" | "structure" | "sender" | "legal";
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  impact: "high" | "medium" | "low";
}

interface Report {
  score: number;
  inboxProbability: number;
  checks: DeliverabilityCheck[];
  topIssues: string[];
  suggestions: string[];
}

interface SmtpProfile {
  id: number;
  name: string;
  fromEmail: string;
  fromName: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  subject: "SUBJECT_LINE",
  content: "CONTENT_BODY",
  structure: "HTML_STRUCTURE",
  sender: "SENDER_IDENTITY",
  legal: "LEGAL_COMPLIANCE",
};

const CATEGORY_ORDER = ["subject", "content", "structure", "sender", "legal"];

function ScoreGauge({ score }: { score: number }) {
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const color =
    score >= 80 ? "hsl(130 100% 45%)" : score >= 55 ? "hsl(40 100% 50%)" : "hsl(350 100% 55%)";

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" className="drop-shadow-lg">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(140 15% 10%)" strokeWidth="14" />
      <circle
        cx="80" cy="80" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="80" y="74" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="monospace">{score}</text>
      <text x="80" y="94" textAnchor="middle" fill="hsl(140 20% 55%)" fontSize="11" fontFamily="monospace">/100</text>
    </svg>
  );
}

function CheckItem({ check }: { check: DeliverabilityCheck }) {
  const [open, setOpen] = useState(false);
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "warn" ? AlertTriangle : XCircle;
  const color = check.status === "pass" ? "text-primary" : check.status === "warn" ? "text-yellow-400" : "text-red-500";
  const border = check.status === "pass" ? "border-primary/20" : check.status === "warn" ? "border-yellow-500/20" : "border-red-500/20";
  const bg = check.status === "pass" ? "hover:bg-primary/5" : check.status === "warn" ? "hover:bg-yellow-500/5" : "hover:bg-red-500/5";

  return (
    <div className={`border ${border} rounded p-3 cursor-pointer transition-colors ${bg}`} onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
          <span className="font-mono text-xs text-foreground truncate">{check.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${
            check.impact === "high" ? "border-red-500/50 text-red-400" :
            check.impact === "medium" ? "border-yellow-500/50 text-yellow-400" :
            "border-primary/30 text-primary/60"
          }`}>
            {check.impact.toUpperCase()}
          </Badge>
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
      {open && (
        <p className="mt-2 text-xs text-muted-foreground font-mono leading-relaxed pl-6 border-t border-border/30 pt-2">
          {check.detail}
        </p>
      )}
    </div>
  );
}

function SubjectQualityBar({ subject }: { subject: string }) {
  const len = subject.length;
  const isGood = len >= 30 && len <= 55;
  const isOk = len >= 20 && len <= 70;
  const color = len === 0 ? "bg-border/30" : isGood ? "bg-primary" : isOk ? "bg-yellow-400" : "bg-red-500";
  const barPct = Math.min(100, (len / 80) * 100);
  const label = len === 0 ? "" : isGood ? "IDEAL" : isOk ? "OK" : len < 20 ? "TOO SHORT" : "TOO LONG";
  const labelColor = len === 0 ? "" : isGood ? "text-primary" : isOk ? "text-yellow-400" : "text-red-500";

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 rounded-full bg-border/30 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className={`font-mono text-[10px] w-16 text-right ${labelColor}`}>{len} / 80 {label}</span>
    </div>
  );
}

export default function InboxTester() {
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["subject", "content", "legal"]));

  // Send test state
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [testToEmail, setTestToEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/smtp-profiles`)
      .then((r) => r.json())
      .then((data: SmtpProfile[]) => {
        setSmtpProfiles(data);
        const def = data.find((p) => p.status === "verified") ?? data[0];
        if (def) setSelectedProfileId(String(def.id));
      })
      .catch(() => {});
  }, []);

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const analyze = async () => {
    if (!subject && !htmlContent) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setSendResult(null);
    try {
      const res = await fetch(`${BASE}/api/analyze/deliverability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromName, fromEmail, subject, htmlContent, replyTo: replyTo || undefined }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Analysis failed");
      }
      const data = await res.json();
      setReport(data);
      setExpandedCats(new Set(["subject", "content", "structure", "sender", "legal"]));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    if (!testToEmail || !testToEmail.includes("@")) return;
    setSendingTest(true);
    setSendResult(null);
    try {
      const res = await fetch(`${BASE}/api/analyze/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpProfileId: selectedProfileId ? Number(selectedProfileId) : undefined,
          toEmail: testToEmail,
          fromName,
          fromEmail,
          subject,
          htmlContent,
          replyTo: replyTo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendResult({ ok: true, msg: `Sent via "${data.sentVia}" to ${data.to}` });
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message });
    } finally {
      setSendingTest(false);
    }
  };

  const categorized = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    checks: report?.checks.filter((c) => c.category === cat) ?? [],
  }));

  const failCount = report?.checks.filter((c) => c.status === "fail").length ?? 0;
  const warnCount = report?.checks.filter((c) => c.status === "warn").length ?? 0;
  const passCount = report?.checks.filter((c) => c.status === "pass").length ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ScanSearch className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-mono font-bold text-primary tracking-wider">INBOX_TESTER</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Analyze deliverability, spam risk, and send test emails before deploying campaigns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── INPUT PANEL ── */}
        <div className="space-y-4">
          <div className="terminal-panel p-5 space-y-4">
            <h2 className="font-mono text-xs text-primary/70 tracking-widest border-b border-border/50 pb-2">{'>'} EMAIL_PARAMETERS</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">FROM_NAME</label>
                <Input
                  className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60"
                  placeholder="Acme Corp"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">FROM_EMAIL</label>
                <Input
                  className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60"
                  placeholder="hello@yourcompany.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">REPLY_TO <span className="text-muted-foreground/50">(optional)</span></label>
              <Input
                className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60"
                placeholder="replies@yourcompany.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">SUBJECT_LINE <span className="text-red-400">*</span></label>
              <Input
                className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60"
                placeholder="e.g. Your account update is ready, {{firstName}}"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <SubjectQualityBar subject={subject} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">HTML_BODY <span className="text-red-400">*</span></label>
              <Textarea
                className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60 min-h-[260px] resize-y"
                placeholder={`<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"></head>\n<body>\n  <p>Hello {{firstName}},</p>\n  <p>Your message here...</p>\n  <a href="{{unsubscribeUrl}}">Unsubscribe</a>\n</body>\n</html>`}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
              />
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-muted-foreground/50">{htmlContent.length} chars</span>
                {htmlContent.length > 61440 && (
                  <span className="text-[10px] font-mono text-red-400">⚠ {Math.round(htmlContent.length / 1024)} KB — approaching Gmail clip limit</span>
                )}
              </div>
            </div>

            <Button
              className="w-full font-mono tracking-widest"
              onClick={analyze}
              disabled={loading || (!subject && !htmlContent)}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> ANALYZING...</>
              ) : (
                <><ScanSearch className="h-4 w-4 mr-2" /> RUN_INBOX_ANALYSIS</>
              )}
            </Button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs font-mono text-red-400">
                ERROR: {error}
              </div>
            )}
          </div>

          {/* ── SEND TEST EMAIL ── */}
          <div className="terminal-panel p-5 space-y-3">
            <h2 className="font-mono text-xs text-primary/70 tracking-widest border-b border-border/50 pb-2">
              {'>'} SEND_TEST_EMAIL
              <span className="ml-2 text-muted-foreground/50 normal-case">— deliver this email for real</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">SMTP_PROFILE</label>
                {smtpProfiles.length === 0 ? (
                  <div className="font-mono text-[10px] text-muted-foreground/50 bg-secondary/30 border border-border/40 rounded px-3 py-2">
                    No SMTP profiles configured
                  </div>
                ) : (
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60 h-9">
                      <SelectValue placeholder="Select profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {smtpProfiles.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} className="font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === "verified" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">SEND_TO</label>
                <Input
                  className="font-mono text-xs bg-background/50 border-border/60 focus:border-primary/60"
                  placeholder="you@example.com"
                  value={testToEmail}
                  onChange={(e) => setTestToEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full font-mono tracking-widest border-primary/40 text-primary hover:bg-primary/10"
              onClick={sendTest}
              disabled={sendingTest || !testToEmail || smtpProfiles.length === 0 || (!subject && !htmlContent)}
            >
              {sendingTest ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> SENDING...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> SEND_TEST_NOW</>
              )}
            </Button>

            {sendResult && (
              <div className={`rounded p-3 text-xs font-mono ${sendResult.ok
                ? "bg-primary/10 border border-primary/30 text-primary"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}>
                {sendResult.ok ? "✓ " : "✗ "}{sendResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* ── RESULTS PANEL ── */}
        <div className="space-y-4">
          {!report && !loading && (
            <div className="terminal-panel p-8 flex flex-col items-center justify-center text-center min-h-[400px] space-y-4">
              <MailCheck className="h-14 w-14 text-primary/20" />
              <p className="font-mono text-sm text-muted-foreground/60">Fill in your email parameters and run an analysis to see your inbox deliverability score, spam risk flags, and recommended fixes.</p>
              <div className="text-[10px] font-mono text-muted-foreground/30 space-y-0.5 text-left w-full max-w-xs">
                <div>{'>'} subject line quality check</div>
                <div>{'>'} spam phrase detection (80+ triggers)</div>
                <div>{'>'} HTML structure validation</div>
                <div>{'>'} sender identity analysis</div>
                <div>{'>'} URL shortener detection</div>
                <div>{'>'} CAN-SPAM / GDPR compliance</div>
                <div>{'>'} text-to-image ratio check</div>
                <div>{'>'} HTML size / Gmail clip check</div>
              </div>
            </div>
          )}

          {loading && (
            <div className="terminal-panel p-8 flex flex-col items-center justify-center min-h-[400px] space-y-6">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="font-mono text-xs text-primary/60 space-y-1 text-center">
                <div className="animate-pulse">{'>'} SCANNING_SUBJECT_LINE...</div>
                <div className="animate-pulse delay-100">{'>'} PARSING_HTML_CONTENT...</div>
                <div className="animate-pulse delay-200">{'>'} CHECKING_SPAM_TRIGGERS...</div>
                <div className="animate-pulse delay-300">{'>'} DETECTING_URL_SHORTENERS...</div>
                <div className="animate-pulse delay-500">{'>'} EVALUATING_LEGAL_COMPLIANCE...</div>
                <div className="animate-pulse delay-700">{'>'} COMPUTING_DELIVERABILITY_SCORE...</div>
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {/* Score card */}
              <div className="terminal-panel p-5">
                <div className="flex items-center gap-6">
                  <ScoreGauge score={report.score} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-mono text-[10px] text-muted-foreground tracking-widest">INBOX_PROBABILITY</p>
                      <p className={`font-mono text-3xl font-bold ${
                        report.inboxProbability >= 80 ? "text-primary" :
                        report.inboxProbability >= 55 ? "text-yellow-400" : "text-red-500"
                      }`}>
                        {report.inboxProbability}%
                      </p>
                    </div>
                    <div className="flex gap-4 text-xs font-mono">
                      <span className="text-red-500">{failCount} FAIL</span>
                      <span className="text-yellow-400">{warnCount} WARN</span>
                      <span className="text-primary">{passCount} PASS</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${report.inboxProbability}%`,
                          background: report.inboxProbability >= 80 ? "hsl(130 100% 45%)" : report.inboxProbability >= 55 ? "hsl(40 100% 50%)" : "hsl(350 100% 55%)",
                          boxShadow: `0 0 8px ${report.inboxProbability >= 80 ? "hsl(130 100% 45%)" : report.inboxProbability >= 55 ? "hsl(40 100% 50%)" : "hsl(350 100% 55%)"}`,
                        }}
                      />
                    </div>
                    <button
                      onClick={analyze}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50 hover:text-primary transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" /> RE-ANALYZE
                    </button>
                  </div>
                </div>

                {report.topIssues.length > 0 && (
                  <div className="mt-4 border-t border-border/40 pt-4 space-y-1">
                    <p className="font-mono text-[10px] text-muted-foreground/60 tracking-widest">TOP_ISSUES</p>
                    {report.topIssues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground">
                        <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {report.suggestions.length > 0 && (
                <div className="terminal-panel p-4 space-y-2">
                  <p className="font-mono text-xs text-primary/70 tracking-widest border-b border-border/40 pb-2">{'>'} RECOMMENDED_FIXES</p>
                  {report.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground">
                      <span className="text-primary font-bold flex-shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {/* Categorized checks */}
              <div className="terminal-panel p-4 space-y-3">
                <p className="font-mono text-xs text-primary/70 tracking-widest border-b border-border/40 pb-2">{'>'} DETAILED_CHECKS</p>
                {categorized.map(({ cat, label, checks }) => {
                  const catFail = checks.filter((c) => c.status === "fail").length;
                  const catWarn = checks.filter((c) => c.status === "warn").length;
                  const catPass = checks.filter((c) => c.status === "pass").length;
                  const isOpen = expandedCats.has(cat);
                  if (checks.length === 0) return null;
                  return (
                    <div key={cat} className="border border-border/30 rounded overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        onClick={() => toggleCat(cat)}
                      >
                        <span className="font-mono text-xs text-foreground tracking-wider">{label}</span>
                        <div className="flex items-center gap-2">
                          {catFail > 0 && <span className="text-[10px] font-mono text-red-500">{catFail}✗</span>}
                          {catWarn > 0 && <span className="text-[10px] font-mono text-yellow-400">{catWarn}⚠</span>}
                          {catFail === 0 && catWarn === 0 && <span className="text-[10px] font-mono text-primary">{catPass}✓</span>}
                          {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="p-2 space-y-1.5">
                          {checks.map((check) => <CheckItem key={check.id} check={check} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

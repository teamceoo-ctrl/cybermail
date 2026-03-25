import { useState, useRef, useCallback, useEffect } from "react";
import { PageTransition } from "@/components/terminal-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Crosshair, Globe, Terminal, Trash2, Play, Square,
  CheckCircle, ChevronDown, ChevronUp, Zap, Search,
  RefreshCw, FileDown, UserPlus, Brain, MapPin, Target, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Mode = "crawler" | "targeted" | "advanced";
type LogLevel = "info" | "success" | "warn" | "trace" | "error";

interface LogLine { id: string; message: string; level: LogLevel; ts: number; }
interface Lead {
  email: string; name: string | null; company: string | null;
  domain: string | null; sourceUrl: string | null; method: string;
  mxValid: boolean | null; confidence: number; pattern: string | null;
  selected?: boolean;
}

// ─── Data ───────────────────────────────────────────────────────────────────

const CRAWLER_PATTERNS = [
  { id: "first.last", label: "john.doe@domain" }, { id: "firstlast", label: "johndoe@domain" },
  { id: "first", label: "john@domain" }, { id: "f.last", label: "j.doe@domain" },
  { id: "flast", label: "jdoe@domain" }, { id: "last.first", label: "doe.john@domain" },
  { id: "lastf", label: "doej@domain" }, { id: "first_last", label: "john_doe@domain" },
];

const JOB_TITLE_SUGGESTIONS = [
  "CEO", "CFO", "CTO", "COO", "CMO", "CRO", "CPO", "CISO",
  "Vice President", "VP of Sales", "VP of Marketing", "VP of Operations",
  "President", "Owner", "Founder", "Co-Founder", "Managing Director",
  "General Manager", "Director", "Sales Director", "Marketing Director",
  "Sales Manager", "Account Manager", "Account Executive", "Business Development Manager",
  "Marketing Manager", "Digital Marketing Manager", "Content Manager", "Brand Manager",
  "HR Manager", "Human Resources Director", "Talent Acquisition", "Recruiter",
  "Finance Manager", "Controller", "Accountant", "Financial Analyst",
  "IT Manager", "Systems Administrator", "Network Engineer", "IT Director",
  "Operations Manager", "Supply Chain Manager", "Logistics Manager",
  "Project Manager", "Product Manager", "Product Owner",
  "Regional Director", "Regional Manager", "National Sales Manager",
  "Partner", "Senior Partner", "Principal", "Associate",
  "Procurement Manager", "Purchasing Manager", "Buyer",
  "Customer Success Manager", "Customer Service Manager",
  "Legal Counsel", "General Counsel", "Attorney",
  "Real Estate Agent", "Broker", "Property Manager",
  "Insurance Agent", "Financial Advisor", "Wealth Manager",
  "Healthcare Administrator", "Practice Manager", "Clinic Director",
];

const INDUSTRY_SUGGESTIONS = [
  "wholesale", "distribution", "manufacturing", "construction", "real estate",
  "accounting", "tax services", "bookkeeping", "financial services", "banking",
  "insurance", "healthcare", "medical", "dental", "pharmacy",
  "technology", "software", "IT services", "cybersecurity", "cloud computing",
  "marketing agency", "advertising", "digital marketing", "SEO",
  "logistics", "freight", "shipping", "supply chain", "transportation",
  "retail", "e-commerce", "consumer goods", "FMCG",
  "hospitality", "hotel", "restaurant", "food & beverage",
  "education", "staffing", "recruitment", "HR consulting",
  "legal services", "law firm", "compliance",
  "energy", "oil & gas", "renewable energy", "utilities",
  "agriculture", "farming", "food processing",
  "automotive", "dealership", "fleet management",
  "telecommunications", "wireless", "broadband",
  "entertainment", "media", "publishing",
];

const COUNTRIES: { code: string; name: string; hasStates?: boolean }[] = [
  { code: "US", name: "United States", hasStates: true },
  { code: "CA", name: "Canada", hasStates: true },
  { code: "GB", name: "United Kingdom" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" }, { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" }, { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" }, { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" }, { code: "CZ", name: "Czech Republic" },
  { code: "AT", name: "Austria" }, { code: "BE", name: "Belgium" },
  { code: "MX", name: "Mexico" }, { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" }, { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" }, { code: "PE", name: "Peru" },
  { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" }, { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" }, { code: "HK", name: "Hong Kong" },
  { code: "AE", name: "United Arab Emirates" }, { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" }, { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" }, { code: "KE", name: "Kenya" },
  { code: "EG", name: "Egypt" }, { code: "NZ", name: "New Zealand" },
  { code: "PH", name: "Philippines" }, { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" }, { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" }, { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" }, { code: "TR", name: "Turkey" },
  { code: "RU", name: "Russia" }, { code: "UA", name: "Ukraine" },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","Washington D.C.",
];

const CA_PROVINCES = [
  "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador",
  "Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island",
  "Quebec","Saskatchewan","Yukon",
];

const LOG_COLORS: Record<LogLevel, string> = {
  info: "text-primary/70", success: "text-primary", warn: "text-warning",
  trace: "text-muted-foreground/40", error: "text-destructive",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MxBadge({ valid }: { valid: boolean | null }) {
  if (valid === true) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-primary/40 text-primary bg-primary/10">MX ✓</span>;
  if (valid === false) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-destructive/30 text-destructive/70 bg-destructive/5">MX ✗</span>;
  return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground/50">MX ?</span>;
}

function ConfBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-primary" : score >= 50 ? "bg-warning" : "bg-destructive/60";
  return <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden"><div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} /></div>;
}

function TagInput({
  value, onChange, suggestions, placeholder, label,
}: {
  value: string[]; onChange: (v: string[]) => void;
  suggestions: string[]; placeholder?: string; label?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  ).slice(0, 8);

  const add = (tag: string) => {
    const clean = tag.trim();
    if (clean && !value.includes(clean)) onChange([...value, clean]);
    setInput(""); setOpen(false);
  };
  const remove = (tag: string) => onChange(value.filter(t => t !== tag));

  return (
    <div className="space-y-2">
      {label && <div className="font-mono text-[10px] text-muted-foreground tracking-widest">{label}</div>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/15 border border-primary/30 rounded text-primary font-mono text-[10px]">
              {tag}
              <button onClick={() => remove(tag)} className="hover:text-white ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (input.trim()) add(input); } if (e.key === "Escape") setOpen(false); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="font-mono text-xs bg-background border-border focus-visible:ring-primary h-8"
        />
        {open && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border/70 rounded shadow-xl overflow-hidden">
            {filtered.map(s => (
              <button
                key={s}
                onMouseDown={() => add(s)}
                className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
            {input.trim() && !suggestions.includes(input.trim()) && (
              <button
                onMouseDown={() => add(input)}
                className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-primary/60 hover:bg-primary/10 hover:text-primary border-t border-border/30 transition-colors"
              >
                + ADD "{input.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground/40">Press Enter or pick from suggestions · {value.length} added</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LeadScraper() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("advanced");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [filterMx, setFilterMx] = useState<"all" | "valid" | "unknown">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "scraped" | "generated" | "found">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // CRAWLER state
  const [crawlerUrls, setCrawlerUrls] = useState("https://");
  const [crawlSubPages, setCrawlSubPages] = useState(true);
  const [validateMxCrawler, setValidateMxCrawler] = useState(true);

  // TARGETED state
  const [targetDomain, setTargetDomain] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [firstNames, setFirstNames] = useState("");
  const [lastNames, setLastNames] = useState("");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(["first.last", "firstlast", "first", "f.last"]);
  const [validateMxTargeted, setValidateMxTargeted] = useState(true);

  // ADVANCED state
  const [advDomain, setAdvDomain] = useState("");
  const [advJobTitles, setAdvJobTitles] = useState<string[]>(["CEO"]);
  const [advSearchDepth, setAdvSearchDepth] = useState("standard");
  const [advVerifyMx, setAdvVerifyMx] = useState(true);
  const [advCountry, setAdvCountry] = useState("");
  const [advState, setAdvState] = useState("");
  const [advIndustry, setAdvIndustry] = useState<string[]>([]);
  const [advTargetCount, setAdvTargetCount] = useState(500);

  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [logs]);
  useEffect(() => { setLeads(prev => prev.map(l => ({ ...l, selected: selectAll }))); }, [selectAll]);

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    setLogs(prev => [...prev.slice(-300), { id: crypto.randomUUID(), message, level, ts: Date.now() }]);
  }, []);

  const parseStream = useCallback(async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message", dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
        }
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          if (event === "session") setSessionId(data.sessionId);
          if (event === "log") addLog(data.message, data.level ?? "info");
          if (event === "lead") setLeads(prev => prev.some(l => l.email === data.email) ? prev : [...prev, { ...data, selected: false }]);
          if (event === "done") {
            addLog(`> ════════════════════════════════`, "info");
            addLog(`> OPERATION COMPLETE — ${data.total} RECORDS CAPTURED`, "success");
          }
        } catch { /* skip malformed */ }
      }
    }
  }, [addLog]);

  const runStream = async (url: string, body: object) => {
    setRunning(true); setLogs([]); setLeads([]); setSessionId(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${BASE}${url}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
      await parseStream(res);
    } catch (err: any) {
      if (err.name !== "AbortError") addLog(`> CONNECTION_ERROR: ${err.message}`, "error");
      else addLog(`> OPERATION ABORTED BY USER`, "warn");
    } finally { setRunning(false); abortRef.current = null; }
  };

  const runCrawler = () => {
    const urls = crawlerUrls.split("\n").map(u => u.trim()).filter(Boolean);
    if (!urls.length) { toast({ title: "NO_TARGETS", variant: "destructive", className: "font-mono" }); return; }
    runStream("/api/leads/crawl", { urls, crawlSubPages, validateMx: validateMxCrawler, maxSubPages: 6 });
  };

  const runTargeted = () => {
    if (!targetDomain.trim()) { toast({ title: "NO_DOMAIN", variant: "destructive", className: "font-mono" }); return; }
    const fNames = firstNames.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
    const lNames = lastNames.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
    if (!fNames.length || !lNames.length) { toast({ title: "NO_NAMES", variant: "destructive", className: "font-mono" }); return; }
    runStream("/api/leads/targeted", {
      domain: targetDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, ""),
      company: targetCompany.trim(), firstNames: fNames, lastNames: lNames,
      patterns: selectedPatterns, validateMx: validateMxTargeted,
    });
  };

  const runAdvanced = () => {
    if (!advDomain.trim()) { toast({ title: "DOMAIN_REQUIRED", description: "Enter a target email domain", variant: "destructive", className: "font-mono" }); return; }
    if (!advJobTitles.length) { toast({ title: "POSITION_REQUIRED", description: "Add at least one job position", variant: "destructive", className: "font-mono" }); return; }
    runStream("/api/leads/advanced-find", {
      domain: advDomain.trim(), jobTitles: advJobTitles,
      country: COUNTRIES.find(c => c.code === advCountry)?.name ?? advCountry,
      state: advState, industryKeywords: advIndustry,
      searchDepth: advSearchDepth, targetCount: advTargetCount, verifyMx: advVerifyMx,
    });
  };

  const stopScan = () => { abortRef.current?.abort(); };

  const filteredLeads = leads.filter(l => {
    if (filterMx === "valid" && !l.mxValid) return false;
    if (filterMx === "unknown" && l.mxValid !== null) return false;
    if (filterMethod !== "all" && l.method !== filterMethod) return false;
    if (searchQuery) { const q = searchQuery.toLowerCase(); return l.email.includes(q) || (l.name ?? "").toLowerCase().includes(q) || (l.domain ?? "").includes(q); }
    return true;
  });

  const selectedLeads = filteredLeads.filter(l => l.selected);
  const mxValid = filteredLeads.filter(l => l.mxValid === true).length;
  const mxInvalid = filteredLeads.filter(l => l.mxValid === false).length;

  const exportCsv = () => {
    const rows = selectedLeads.length > 0 ? selectedLeads : filteredLeads;
    if (!rows.length) return;
    const header = "email,name,company,domain,method,mx_valid,confidence,pattern,source_url";
    const body = rows.map(l => [l.email, l.name ?? "", l.company ?? "", l.domain ?? "", l.method,
      l.mxValid === null ? "" : l.mxValid ? "true" : "false", l.confidence, l.pattern ?? "", l.sourceUrl ?? ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `cybermail-leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "EXPORT_COMPLETE", description: `${rows.length} records dumped`, className: "border-primary bg-background text-primary font-mono" });
  };

  const importToContacts = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${BASE}/api/leads/import`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      toast({ title: "IMPORT_COMPLETE", description: `${data.imported} contacts injected`, className: "border-primary bg-background text-primary font-mono" });
    } catch { toast({ title: "IMPORT_FAILED", variant: "destructive", className: "font-mono" }); }
  };

  const stateOptions = advCountry === "US" ? US_STATES : advCountry === "CA" ? CA_PROVINCES : [];
  const selectedCountry = COUNTRIES.find(c => c.code === advCountry);

  const modeBtn = (m: Mode, label: string, Icon: any) => (
    <button onClick={() => setMode(m)}
      className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-xs transition-all ${mode === m ? "bg-primary text-black shadow-[0_0_10px_rgba(0,255,65,0.4)]" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  const launchBtn = (label: string, abortLabel: string, action: () => void) => (
    <Button onClick={running ? stopScan : action}
      className={`w-full font-mono font-bold ${running ? "bg-destructive text-white hover:bg-destructive/80" : "bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_20px_rgba(0,255,65,0.5)]"}`}>
      {running ? <><Square className="w-4 h-4 mr-2" /> {abortLabel}</> : <><Play className="w-4 h-4 mr-2" /> {label}</>}
    </Button>
  );

  return (
    <PageTransition className="space-y-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">LEAD_SCRAPER</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">DOMAIN_CRAWLER · TARGETED_HUNT · ADVANCED_FINDER — live streaming intelligence engine</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          {running && <span className="flex items-center gap-1.5 text-primary animate-pulse"><span className="w-2 h-2 rounded-full bg-primary animate-ping" /> SCANNING...</span>}
          {leads.length > 0 && <span className="text-primary">{leads.length} LEADS</span>}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-card border border-border/50 rounded w-fit">
        {modeBtn("advanced", "ADVANCED_FINDER", Target)}
        {modeBtn("crawler", "DOMAIN_CRAWLER", Globe)}
        {modeBtn("targeted", "TARGETED_HUNT", Crosshair)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* ─── Left: Config ─── */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">

          {/* ══ ADVANCED FINDER ══ */}
          {mode === "advanced" && (
            <Card className="terminal-panel border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm text-primary flex items-center gap-2">
                  <Target className="w-4 h-4" /> ADVANCED_LEAD_FINDER
                </CardTitle>
                <p className="font-mono text-[10px] text-muted-foreground/70">
                  Search the web for individuals by email domain, job title, location &amp; industry
                </p>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Domain */}
                <div className="space-y-2 p-3 border border-primary/20 rounded bg-primary/5 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">TARGET_DOMAIN *</div>
                  <Input
                    value={advDomain}
                    onChange={e => setAdvDomain(e.target.value)}
                    placeholder="att.net, company.com, gmail.com"
                    className="font-mono text-sm bg-background border-border focus-visible:ring-primary"
                  />
                  <p className="font-mono text-[9px] text-muted-foreground/50">Find people whose email ends with @{advDomain || "domain.com"}</p>
                </div>

                {/* Job Titles */}
                <div className="p-3 border border-border/40 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-primary tracking-widest">JOB_POSITION *</div>
                  <div className="pt-1">
                    <TagInput
                      value={advJobTitles}
                      onChange={setAdvJobTitles}
                      suggestions={JOB_TITLE_SUGGESTIONS}
                      placeholder="CEO, Sales Manager... (type or pick)"
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {["CEO", "CFO", "VP of Sales", "Marketing Director", "Owner"].map(t => (
                      <button key={t} onClick={() => !advJobTitles.includes(t) && setAdvJobTitles(p => [...p, t])}
                        className="font-mono text-[9px] px-1.5 py-0.5 border border-primary/20 text-primary/60 hover:bg-primary/10 hover:text-primary rounded transition-colors">
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Depth */}
                <div className="p-3 border border-border/40 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-muted-foreground tracking-widest">SEARCH_DEPTH</div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { val: "quick", label: "QUICK", desc: "4 queries" },
                      { val: "standard", label: "STANDARD", desc: "6–8 queries" },
                      { val: "deep", label: "DEEP", desc: "12 queries" },
                    ].map(d => (
                      <button key={d.val} onClick={() => setAdvSearchDepth(d.val)}
                        className={`p-2 rounded border font-mono text-[10px] transition-all text-center ${advSearchDepth === d.val ? "border-primary/60 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground/50 hover:text-muted-foreground"}`}>
                        <div className="font-bold">{d.label}</div>
                        <div className="text-[8px] mt-0.5 opacity-70">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* MX Verification */}
                <div className="flex items-center justify-between p-3 border border-border/30 rounded bg-background/20">
                  <div>
                    <div className="font-mono text-xs text-foreground">EMAIL_VERIFICATION</div>
                    <div className="font-mono text-[9px] text-muted-foreground/60">Verify MX records &amp; deliverability</div>
                  </div>
                  <Switch checked={advVerifyMx} onCheckedChange={setAdvVerifyMx} className="data-[state=checked]:bg-primary" />
                </div>

                {/* Location */}
                <div className="p-3 border border-border/40 rounded bg-background/30 relative space-y-3">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-muted-foreground tracking-widest">LOCATION_FILTER</div>
                  <div className="pt-1 space-y-2">
                    <label className="font-mono text-[10px] text-muted-foreground/70 flex items-center gap-1"><MapPin className="w-3 h-3" /> COUNTRY</label>
                    <Select value={advCountry} onValueChange={v => { setAdvCountry(v); setAdvState(""); }}>
                      <SelectTrigger className="font-mono text-xs bg-background border-border focus:ring-primary h-8">
                        <SelectValue placeholder="— SELECT COUNTRY —" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border font-mono text-foreground max-h-56">
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCountry?.hasStates && stateOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] text-muted-foreground/70">
                        {advCountry === "CA" ? "PROVINCE" : "STATE"}
                      </label>
                      <Select value={advState} onValueChange={setAdvState}>
                        <SelectTrigger className="font-mono text-xs bg-background border-border focus:ring-primary h-8">
                          <SelectValue placeholder="— ALL STATES —" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border font-mono text-foreground max-h-56">
                          <SelectItem value="_all" className="text-xs text-muted-foreground">— ALL —</SelectItem>
                          {stateOptions.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Industry Keywords */}
                <div className="p-3 border border-border/40 rounded bg-background/30 relative">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-muted-foreground tracking-widest">INDUSTRY_KEYWORDS</div>
                  <div className="pt-1">
                    <TagInput
                      value={advIndustry}
                      onChange={setAdvIndustry}
                      suggestions={INDUSTRY_SUGGESTIONS}
                      placeholder="wholesale, accounting, construction..."
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {["wholesale", "construction", "accounting", "technology", "healthcare"].map(k => (
                      <button key={k} onClick={() => !advIndustry.includes(k) && setAdvIndustry(p => [...p, k])}
                        className="font-mono text-[9px] px-1.5 py-0.5 border border-border/30 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary rounded transition-colors">
                        + {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lead Target */}
                <div className="p-3 border border-border/40 rounded bg-background/30 relative space-y-3">
                  <div className="absolute -top-2.5 left-3 px-2 bg-card font-mono text-[10px] text-muted-foreground tracking-widest">LEAD_TARGET</div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">COUNT</span>
                    <span className="font-mono text-lg text-primary font-bold">{advTargetCount.toLocaleString()}</span>
                  </div>
                  <Slider
                    min={100} max={10000} step={100}
                    value={[advTargetCount]}
                    onValueChange={([v]) => setAdvTargetCount(v)}
                    className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.slider-track]:bg-primary/30"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-muted-foreground/40">
                    <span>100</span><span>2,500</span><span>5,000</span><span>10,000</span>
                  </div>
                </div>

                {launchBtn("LAUNCH_ADVANCED_FINDER", "ABORT_SEARCH", runAdvanced)}
              </CardContent>
            </Card>
          )}

          {/* ══ DOMAIN CRAWLER ══ */}
          {mode === "crawler" && (
            <Card className="terminal-panel border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm text-primary flex items-center gap-2"><Globe className="w-4 h-4" /> DOMAIN_CRAWLER_CONFIG</CardTitle>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  Extracts mailto links · decodes obfuscated emails · discovers pages via sitemap · WHOIS lookup
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5">TARGET_URLS <span className="text-muted-foreground/40">(one per line)</span></label>
                  <Textarea value={crawlerUrls} onChange={e => setCrawlerUrls(e.target.value)}
                    placeholder={"https://company.com\nhttps://startup.io"} rows={6}
                    className="font-mono text-xs bg-background border-border resize-none focus-visible:ring-primary" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">CRAWL_SUB_PAGES</span>
                    <Switch checked={crawlSubPages} onCheckedChange={setCrawlSubPages} className="data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">VALIDATE_MX_RECORDS</span>
                    <Switch checked={validateMxCrawler} onCheckedChange={setValidateMxCrawler} className="data-[state=checked]:bg-primary" />
                  </div>
                </div>
                {crawlSubPages && (
                  <div className="p-2.5 border border-border/30 rounded bg-background/20 font-mono text-[10px] text-muted-foreground/70 space-y-0.5">
                    <div className="text-primary/60 mb-1">SUB-PAGES TO CRAWL:</div>
                    {["/contact", "/about", "/team", "/staff", "/people", "/leadership"].map(p => (
                      <div key={p} className="pl-2">{'>'} {p}</div>
                    ))}
                  </div>
                )}
                {launchBtn("LAUNCH_CRAWLER", "ABORT_SCAN", runCrawler)}
              </CardContent>
            </Card>
          )}

          {/* ══ TARGETED HUNT ══ */}
          {mode === "targeted" && (
            <Card className="terminal-panel border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm text-primary flex items-center gap-2"><Crosshair className="w-4 h-4" /> TARGETED_HUNT_CONFIG</CardTitle>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  Crawls site for real emails first · WHOIS lookup · then generates pattern permutations
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5">TARGET_DOMAIN</label>
                    <Input value={targetDomain} onChange={e => setTargetDomain(e.target.value)} placeholder="acmecorp.com"
                      className="font-mono text-sm bg-background border-border focus-visible:ring-primary" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5">COMPANY_NAME</label>
                    <Input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="Acme Corporation"
                      className="font-mono text-sm bg-background border-border focus-visible:ring-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5">FIRST_NAMES</label>
                    <Textarea value={firstNames} onChange={e => setFirstNames(e.target.value)} placeholder={"John\nJane\nMike"} rows={5}
                      className="font-mono text-xs bg-background border-border resize-none focus-visible:ring-primary" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5">LAST_NAMES</label>
                    <Textarea value={lastNames} onChange={e => setLastNames(e.target.value)} placeholder={"Smith\nDoe\nJohnson"} rows={5}
                      className="font-mono text-xs bg-background border-border resize-none focus-visible:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground tracking-widest block mb-2">EMAIL_PATTERNS</label>
                  <div className="space-y-1.5">
                    {CRAWLER_PATTERNS.map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <Checkbox checked={selectedPatterns.includes(p.id)}
                          onCheckedChange={() => setSelectedPatterns(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                          className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                        <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">VALIDATE_MX_RECORDS</span>
                  <Switch checked={validateMxTargeted} onCheckedChange={setValidateMxTargeted} className="data-[state=checked]:bg-primary" />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/60 border border-border/30 rounded p-2 bg-background/20">
                  PERMUTATIONS: {firstNames.split(/[\n,]+/).filter(Boolean).length} × {lastNames.split(/[\n,]+/).filter(Boolean).length} × {selectedPatterns.length} = {
                    firstNames.split(/[\n,]+/).filter(Boolean).length * lastNames.split(/[\n,]+/).filter(Boolean).length * selectedPatterns.length
                  } EMAILS
                </div>
                {launchBtn("LAUNCH_HUNT", "ABORT_HUNT", runTargeted)}
              </CardContent>
            </Card>
          )}

          {/* Stats card */}
          {leads.length > 0 && (
            <Card className="terminal-panel border-border/30">
              <CardContent className="pt-4 space-y-2 font-mono text-xs">
                <div className="font-mono text-[10px] text-primary tracking-widest mb-3">SESSION_STATS</div>
                <div className="space-y-1.5">
                  {[
                    ["TOTAL_CAPTURED", leads.length, "text-foreground"],
                    ["MX_VERIFIED", mxValid, "text-primary"],
                    ["MX_INVALID", mxInvalid, "text-destructive/70"],
                    ["DIRECT_FOUND", leads.filter(l => l.method === "found").length, "text-primary"],
                    ["GENERATED", leads.filter(l => l.method === "generated").length, "text-foreground"],
                    ["SCRAPED", leads.filter(l => l.method === "scraped").length, "text-foreground"],
                    ["SELECTED", selectedLeads.length, "text-primary"],
                  ].map(([label, val, cls]) => (
                    <div key={label as string} className="flex justify-between text-muted-foreground">
                      <span>{label}</span><span className={cls as string}>{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right: Terminal + Results ─── */}
        <div className="lg:col-span-2 space-y-4 flex flex-col min-h-0">
          {/* Terminal */}
          <Card className="terminal-panel border-primary/20 flex-shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-xs text-primary flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" /> LIVE_FEED
                  {running && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />}
                  {sessionId && <span className="text-muted-foreground/50 font-normal">SID:{sessionId.slice(0, 8)}</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => setLogsExpanded(!logsExpanded)}>
                    {logsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => setLogs([])}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>
            {logsExpanded && (
              <CardContent className="px-4 pb-3">
                <div className="bg-black/60 rounded border border-border/30 h-[150px] overflow-y-auto p-3 font-mono text-[10px] space-y-0.5">
                  {logs.length === 0
                    ? <div className="text-muted-foreground/30">{'>'} AWAITING COMMAND...</div>
                    : logs.map(l => <div key={l.id} className={LOG_COLORS[l.level]}>{l.message}</div>)}
                  <div ref={logEndRef} />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Results */}
          <Card className="terminal-panel border-border/30 flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-mono text-xs text-primary flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" /> RESULTS
                  {filteredLeads.length > 0 && <Badge variant="outline" className="border-primary/40 text-primary font-mono text-[9px]">{filteredLeads.length}</Badge>}
                </CardTitle>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  {(["all", "valid", "unknown"] as const).map(f => (
                    <button key={f} onClick={() => setFilterMx(f)}
                      className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-colors ${filterMx === f ? "border-primary/60 text-primary bg-primary/10" : "border-border/30 text-muted-foreground/50 hover:text-muted-foreground"}`}>
                      MX:{f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {(["all", "found", "scraped", "generated"] as const).map(f => (
                    <button key={f} onClick={() => setFilterMethod(f)}
                      className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-colors ${filterMethod === f ? "border-primary/60 text-primary bg-primary/10" : "border-border/30 text-muted-foreground/50 hover:text-muted-foreground"}`}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="filter..."
                    className="font-mono text-[10px] bg-background border-border pl-6 h-6 w-28 focus-visible:ring-primary" />
                </div>
                {filteredLeads.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={exportCsv}
                      className="font-mono text-[10px] border-primary/40 text-primary hover:bg-primary/10 h-6 px-2">
                      <FileDown className="w-3 h-3 mr-1" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={importToContacts}
                      className="font-mono text-[10px] border-primary/40 text-primary hover:bg-primary/10 h-6 px-2">
                      <UserPlus className="w-3 h-3 mr-1" /> IMPORT
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>

            <div className="flex-1 overflow-auto px-0">
              {filteredLeads.length === 0 ? (
                <div className="h-full flex items-center justify-center font-mono text-xs text-muted-foreground/40 flex-col gap-2 p-8">
                  {running
                    ? <><RefreshCw className="w-5 h-5 animate-spin text-primary" /><span className="text-primary/50">SCANNING FOR LEADS...</span></>
                    : <><Target className="w-5 h-5" /><span>CONFIGURE A SCAN AND LAUNCH TO CAPTURE LEADS</span></>}
                </div>
              ) : (
                <table className="w-full text-[10px] font-mono">
                  <thead className="sticky top-0 bg-background/90 backdrop-blur z-10">
                    <tr className="border-b border-border/50">
                      <th className="p-2 w-8 text-center">
                        <Checkbox checked={selectAll} onCheckedChange={v => setSelectAll(Boolean(v))}
                          className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      </th>
                      <th className="p-2 text-left text-primary tracking-widest">EMAIL</th>
                      <th className="p-2 text-left text-primary tracking-widest hidden md:table-cell">NAME</th>
                      <th className="p-2 text-left text-primary tracking-widest hidden lg:table-cell">COMPANY</th>
                      <th className="p-2 text-left text-primary tracking-widest">MX</th>
                      <th className="p-2 text-left text-primary tracking-widest">CONF</th>
                      <th className="p-2 text-left text-primary tracking-widest hidden md:table-cell">SRC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, i) => (
                      <tr key={lead.email} onClick={() => setLeads(prev => prev.map(l => l.email === lead.email ? { ...l, selected: !l.selected } : l))}
                        className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-primary/5 ${lead.selected ? "bg-primary/10" : i % 2 === 0 ? "" : "bg-background/30"}`}>
                        <td className="p-2 text-center">
                          <Checkbox checked={lead.selected ?? false}
                            onCheckedChange={() => setLeads(prev => prev.map(l => l.email === lead.email ? { ...l, selected: !l.selected } : l))}
                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            {(lead.method === "found" || lead.method === "scraped") && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" title="Real email found on web" />
                            )}
                            <span className={lead.method === "generated" ? "text-muted-foreground/80" : "text-foreground"}>{lead.email}</span>
                          </div>
                          {lead.pattern && (
                            <div className="text-muted-foreground/35 text-[9px] mt-0.5">
                              {lead.pattern === "mailto" ? "✓ mailto link" :
                               lead.pattern === "whois" ? "✓ WHOIS record" :
                               lead.pattern === "direct" ? "✓ site page" :
                               lead.pattern === "search-direct" ? "✓ search result" :
                               lead.pattern === "crawled" ? "✓ crawled page" :
                               lead.pattern === "text" ? "✓ page text" :
                               `pattern: ${lead.pattern}`}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground hidden md:table-cell">{lead.name ?? "—"}</td>
                        <td className="p-2 text-muted-foreground/70 hidden lg:table-cell">{lead.company ?? "—"}</td>
                        <td className="p-2"><MxBadge valid={lead.mxValid} /></td>
                        <td className="p-2 w-16">
                          <div className="text-muted-foreground mb-0.5">{lead.confidence}%</div>
                          <ConfBar score={lead.confidence} />
                        </td>
                        <td className="p-2 text-muted-foreground/40 hidden md:table-cell">
                          <span className={
                            lead.method === "found" ? "text-primary font-semibold" :
                            lead.method === "scraped" ? "text-primary/70" : "text-muted-foreground/50"
                          }>
                            {lead.method === "found" ? "FOUND" :
                             lead.method === "scraped" ? "SCRAPED" : "GENERATED"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {filteredLeads.length > 0 && (
              <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between text-[9px] font-mono text-muted-foreground flex-shrink-0">
                <span>SHOWING {filteredLeads.length} / {leads.length} · SELECTED {selectedLeads.length}</span>
                <span>MX_OK: {mxValid} · MX_FAIL: {mxInvalid}</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useListTemplates, useCreateTemplate } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus, FileCode, Code, Eye, Pencil, Trash2, Copy,
  ShieldAlert, ShieldCheck, AlertTriangle,
  Paperclip, Globe, X, Upload, FileText, Image as ImageIcon,
  Link as LinkIcon, Search, ChevronRight, Tag, ClipboardCopy, Check,
  Sparkles, Wand2, RefreshCw, ClipboardCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ── Brands ────────────────────────────────────────────────────────────────────

const BRAND_LIST = [
  { name: "Nike", domain: "nike.com" },
  { name: "Adidas", domain: "adidas.com" },
  { name: "Zara", domain: "zara.com" },
  { name: "H&M", domain: "hm.com" },
  { name: "Gucci", domain: "gucci.com" },
  { name: "Louis Vuitton", domain: "louisvuitton.com" },
  { name: "Prada", domain: "prada.com" },
  { name: "Chanel", domain: "chanel.com" },
  { name: "Versace", domain: "versace.com" },
  { name: "Balenciaga", domain: "balenciaga.com" },
  { name: "Burberry", domain: "burberry.com" },
  { name: "Dior", domain: "dior.com" },
  { name: "Armani", domain: "armani.com" },
  { name: "Calvin Klein", domain: "calvinklein.com" },
  { name: "Tommy Hilfiger", domain: "tommy.com" },
  { name: "Ralph Lauren", domain: "ralphlauren.com" },
  { name: "Lacoste", domain: "lacoste.com" },
  { name: "Hugo Boss", domain: "hugoboss.com" },
  { name: "Apple", domain: "apple.com" },
  { name: "Google", domain: "google.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "Amazon", domain: "amazon.com" },
  { name: "Samsung", domain: "samsung.com" },
  { name: "Sony", domain: "sony.com" },
  { name: "Intel", domain: "intel.com" },
  { name: "Dell", domain: "dell.com" },
  { name: "HP", domain: "hp.com" },
  { name: "Lenovo", domain: "lenovo.com" },
  { name: "Tesla", domain: "tesla.com" },
  { name: "BMW", domain: "bmw.com" },
  { name: "Mercedes", domain: "mercedes-benz.com" },
  { name: "Audi", domain: "audi.com" },
  { name: "Ferrari", domain: "ferrari.com" },
  { name: "Porsche", domain: "porsche.com" },
  { name: "Toyota", domain: "toyota.com" },
  { name: "Ford", domain: "ford.com" },
  { name: "Volkswagen", domain: "vw.com" },
  { name: "Honda", domain: "honda.com" },
  { name: "Netflix", domain: "netflix.com" },
  { name: "Spotify", domain: "spotify.com" },
  { name: "YouTube", domain: "youtube.com" },
  { name: "Instagram", domain: "instagram.com" },
  { name: "Facebook", domain: "facebook.com" },
  { name: "LinkedIn", domain: "linkedin.com" },
  { name: "Twitter/X", domain: "x.com" },
  { name: "TikTok", domain: "tiktok.com" },
  { name: "Snapchat", domain: "snapchat.com" },
  { name: "Pinterest", domain: "pinterest.com" },
  { name: "Uber", domain: "uber.com" },
  { name: "Airbnb", domain: "airbnb.com" },
  { name: "Booking.com", domain: "booking.com" },
  { name: "PayPal", domain: "paypal.com" },
  { name: "Visa", domain: "visa.com" },
  { name: "Mastercard", domain: "mastercard.com" },
  { name: "Stripe", domain: "stripe.com" },
  { name: "Shopify", domain: "shopify.com" },
  { name: "eBay", domain: "ebay.com" },
  { name: "Walmart", domain: "walmart.com" },
  { name: "Target", domain: "target.com" },
  { name: "IKEA", domain: "ikea.com" },
  { name: "LEGO", domain: "lego.com" },
  { name: "Coca-Cola", domain: "coca-cola.com" },
  { name: "Pepsi", domain: "pepsi.com" },
  { name: "Red Bull", domain: "redbull.com" },
  { name: "Starbucks", domain: "starbucks.com" },
  { name: "McDonald's", domain: "mcdonalds.com" },
  { name: "KFC", domain: "kfc.com" },
  { name: "Subway", domain: "subway.com" },
  { name: "Adobe", domain: "adobe.com" },
  { name: "Slack", domain: "slack.com" },
  { name: "Salesforce", domain: "salesforce.com" },
  { name: "Dropbox", domain: "dropbox.com" },
  { name: "Zoom", domain: "zoom.us" },
  { name: "HubSpot", domain: "hubspot.com" },
  { name: "Mailchimp", domain: "mailchimp.com" },
  { name: "Oracle", domain: "oracle.com" },
  { name: "IBM", domain: "ibm.com" },
  { name: "Nvidia", domain: "nvidia.com" },
  { name: "Rolex", domain: "rolex.com" },
  { name: "Cartier", domain: "cartier.com" },
  { name: "Lamborghini", domain: "lamborghini.com" },
  { name: "Rolls-Royce", domain: "rolls-roycemotorcars.com" },
  { name: "Under Armour", domain: "underarmour.com" },
  { name: "Puma", domain: "puma.com" },
  { name: "New Balance", domain: "newbalance.com" },
  { name: "Converse", domain: "converse.com" },
  { name: "Vans", domain: "vans.com" },
  { name: "Supreme", domain: "supremenewyork.com" },
  { name: "Uniqlo", domain: "uniqlo.com" },
  { name: "Levi's", domain: "levi.com" },
  { name: "Guess", domain: "guess.com" },
  { name: "Mango", domain: "mango.com" },
  { name: "Pandora", domain: "pandora.net" },
  { name: "Swarovski", domain: "swarovski.com" },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1, "Name required"),
  subject: z.string().min(1, "Subject required"),
  htmlContent: z.string().min(1, "HTML content required"),
});
type TemplateForm = z.infer<typeof templateSchema>;

// ── Spam Score ────────────────────────────────────────────────────────────────

const SPAM_WORDS = [
  "free", "guaranteed", "unlimited", "winner", "congratulations",
  "act now", "buy now", "click here", "order now", "earn money",
  "make money", "no cost", "for free", "no fee", "special offer",
  "limited time", "urgent", "dear friend", "you have been selected",
  "exclusive deal", "cash", "prize", "save big", "risk free",
  "work from home", "extra income", "double your", "lose weight",
];

function computeSpamScore(subject: string, html: string): number {
  const text = (subject + " " + html).toLowerCase();
  let score = 0;
  for (const word of SPAM_WORDS) { if (text.includes(word)) score += 5; }
  const caps = (subject.match(/[A-Z]/g) ?? []).length / Math.max(subject.length, 1);
  if (caps > 0.5) score += 20;
  score += Math.min(((subject + html).match(/!/g) ?? []).length * 3, 15);
  score += Math.min(((html.match(/href=/gi) ?? []).length) * 2, 12);
  score += Math.min((subject.match(/\b[A-Z]{3,}\b/g) ?? []).length * 4, 16);
  score += Math.min((text.match(/\$/g) ?? []).length * 3, 12);
  return Math.min(Math.round(score), 100);
}

function SpamMeter({ subject, html }: { subject: string; html: string }) {
  const score = computeSpamScore(subject, html);
  const { label, color, barColor, icon: Icon } = score < 20
    ? { label: "CLEAN", color: "text-primary", barColor: "bg-primary", icon: ShieldCheck }
    : score < 45
    ? { label: "LOW_RISK", color: "text-primary/70", barColor: "bg-primary/60", icon: ShieldCheck }
    : score < 65
    ? { label: "MODERATE", color: "text-warning", barColor: "bg-warning", icon: AlertTriangle }
    : { label: "HIGH_RISK", color: "text-destructive", barColor: "bg-destructive", icon: ShieldAlert };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest">SPAM_SCORE</span>
        <div className={`flex items-center gap-1 font-mono text-[10px] font-bold ${color}`}>
          <Icon className="w-3 h-3" /> {score} — {label}
        </div>
      </div>
      <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

const PREVIEW_VARS: Record<string, string> = {
  first_name: "Sarah", firstname: "Sarah",
  last_name: "Mitchell", lastname: "Mitchell",
  full_name: "Sarah Mitchell", fullname: "Sarah Mitchell", name: "Sarah Mitchell",
  email: "sarah.mitchell@example.com",
  age: "34", gender: "Female",
  job_title: "Marketing Director", jobtitle: "Marketing Director", title: "Marketing Director",
  company: "Nexus Solutions",
  industry: "Technology",
  website: "www.nexussolutions.com",
  phone: "(415) 867-5309",
  number10: "4158675309", phone_10: "4158675309", phone_raw: "4158675309",
  phone_formatted: "(415) 867-5309",
  phone_type: "iPhone 16 Pro", device: "iPhone 16 Pro",
  carrier: "Verizon",
  street: "742 Evergreen Terrace",
  city: "San Francisco", state: "CA", state_full: "California",
  zip: "94102", zipcode: "94102", postal_code: "94102",
  country: "United States",
  address: "742 Evergreen Terrace, San Francisco, CA 94102",
  date: "March 24, 2026", date_long: "March 24, 2026",
  date_short: "03/24/2026", date_us: "03/24/2026",
  date_iso: "2026-03-24",
  time: "2:47 PM", time_12: "2:47 PM", time_24: "14:47",
  datetime: "March 24, 2026 at 2:47 PM",
  day: "Tuesday", month: "March", year: "2026",
  coupon_code: "CYBER-X7K2", coupon: "CYBER-X7K2",
  tracking_id: "TRK-4F8A2C9E",
  random_number: "847291",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  unsubscribe_url: "https://unsubscribe.example.com/?id=preview",
  click_url: "https://track.example.com/click?id=preview",
};

function previewHtml(html: string): string {
  return html
    .replace(/\{\{(\s*[\w_]+\s*(?:\|[^}]*)?\s*)\}\}/gi, (match, raw) => {
      const key = raw.trim().split("|")[0].trim().toLowerCase();
      return PREVIEW_VARS[key] ?? `<span style="background:#1a3a1a;color:#00ff41;padding:0 2px;border-radius:2px;font-size:0.9em">${match}</span>`;
    })
    .replace(
      /https:\/\/logo\.clearbit\.com\/([^"'\s>?]+)/g,
      (_, d) => `${BASE}/api/proxy/logo?domain=${d.replace(/\?.*$/, "")}`
    );
}

// ── File types ────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimetype: string;
  url: string;
  dataUrl?: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

function isImage(mime: string) { return mime.startsWith("image/"); }

// ── Brand Logo Panel ──────────────────────────────────────────────────────────

function BrandLogoPanel({ onInsert }: { onInsert: (html: string) => void }) {
  const [query, setQuery] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!query.trim()) return BRAND_LIST;
    const q = query.toLowerCase();
    return BRAND_LIST.filter(b => b.name.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q));
  }, [query]);

  const proxyUrl = (domain: string) => `${BASE}/api/proxy/logo?domain=${domain}`;

  const insertLogo = (name: string, domain: string) => {
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const html = `<img src="${clearbitUrl}" alt="${name} logo" style="max-width:180px;height:auto;display:block;margin:12px 0;" />`;
    onInsert(html);
  };

  const insertCustom = () => {
    const d = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "");
    if (!d) return;
    const name = d.split(".")[0];
    insertLogo(name.charAt(0).toUpperCase() + name.slice(1), d);
    setCustomDomain("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 space-y-2 p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            className="pl-7 h-7 font-mono text-xs bg-background/60 border-border/50"
            placeholder="Search Nike, Zara..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <Input
            className="h-7 font-mono text-xs bg-background/60 border-border/50 flex-1"
            placeholder="custom-domain.com"
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value)}
            onKeyDown={e => e.key === "Enter" && insertCustom()}
          />
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-mono" onClick={insertCustom}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map(brand => {
            const isFailed = failed.has(brand.domain);
            return (
              <button
                key={brand.domain}
                onClick={() => insertLogo(brand.name, brand.domain)}
                className="flex flex-col items-center gap-1 p-2 rounded border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                title={`Insert ${brand.name} logo`}
              >
                {isFailed ? (
                  <div className="w-8 h-8 flex items-center justify-center bg-secondary/50 rounded text-[9px] font-mono text-muted-foreground/60 font-bold">
                    {brand.name.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <img
                    src={proxyUrl(brand.domain)}
                    alt={brand.name}
                    className="w-8 h-8 object-contain"
                    onError={() => setFailed(prev => new Set([...prev, brand.domain]))}
                  />
                )}
                <span className="font-mono text-[9px] text-muted-foreground group-hover:text-primary truncate w-full text-center leading-tight">
                  {brand.name}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-6 text-xs font-mono text-muted-foreground/50">
              No brands found. Try a custom domain above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── File Vault Panel ──────────────────────────────────────────────────────────

function FileVaultPanel({ onInsert }: { onInsert: (html: string) => void }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const [dataUrl, fd] = await Promise.all([
        isImage(file.type) ? readAsDataUrl(file) : Promise.resolve(undefined),
        Promise.resolve(new FormData()),
      ]);
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/files/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data: UploadedFile = await res.json();
      setFiles(prev => [{ ...data, dataUrl }, ...prev]);
      toast({ title: "UPLOADED", description: file.name, className: "border-primary bg-background text-primary font-mono" });
    } catch {
      toast({ title: "UPLOAD_ERROR", description: `Failed to upload ${file.name}`, variant: "destructive", className: "font-mono" });
    } finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(uploadFile);
    e.target.value = "";
  };

  const removeFile = async (id: string) => {
    await fetch(`${BASE}/api/files/${id}`, { method: "DELETE" });
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const insertFile = (f: UploadedFile) => {
    if (isImage(f.mimetype) && f.dataUrl) {
      onInsert(`<img src="${f.dataUrl}" alt="${f.name}" style="max-width:100%;height:auto;display:block;margin:12px 0;" />`);
    } else if (isImage(f.mimetype)) {
      const absoluteUrl = `${window.location.origin}${BASE}/api/files/${f.id}`;
      onInsert(`<img src="${absoluteUrl}" alt="${f.name}" style="max-width:100%;height:auto;display:block;margin:12px 0;" />`);
    } else {
      const absoluteUrl = `${window.location.origin}${BASE}/api/files/${f.id}`;
      onInsert(`<a href="${absoluteUrl}" style="color:#00ff41;font-family:monospace;">${f.name}</a>`);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 p-3 border-b border-border/40">
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/50 hover:bg-primary/5"
          } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={`h-6 w-6 mx-auto mb-1.5 ${dragOver ? "text-primary" : "text-muted-foreground/50"}`} />
          <p className="font-mono text-[10px] text-muted-foreground/60">
            {uploading ? "UPLOADING..." : "DROP_FILES or click"}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground/30 mt-0.5">PDF, images, docs — max 20MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt,.zip"
          onChange={handleFileInput}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {files.length === 0 && (
          <div className="text-center py-8 text-xs font-mono text-muted-foreground/40">
            No files uploaded yet.
          </div>
        )}
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-2 p-2 rounded border border-border/30 bg-secondary/20">
            {isImage(f.mimetype)
              ? <ImageIcon className="h-4 w-4 text-primary/60 flex-shrink-0" />
              : <FileText className="h-4 w-4 text-primary/60 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] text-foreground truncate">{f.name}</p>
              <p className="font-mono text-[9px] text-muted-foreground/50">{formatBytes(f.size)}</p>
            </div>
            <button
              onClick={() => insertFile(f)}
              className="p-1 rounded hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
              title={isImage(f.mimetype) ? "Insert image" : "Insert link"}
            >
              {isImage(f.mimetype) ? <ImageIcon className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
            </button>
            <button
              onClick={() => removeFile(f.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Compose Panel ──────────────────────────────────────────────────────────

function AiComposePanel({ onApply }: { onApply: (subject: string, html: string) => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [emailType, setEmailType] = useState("promotional");
  const [length, setLength] = useState("medium");
  const [generating, setGenerating] = useState(false);
  const [rawResult, setRawResult] = useState("");
  const [parsedSubject, setParsedSubject] = useState("");
  const [parsedHtml, setParsedHtml] = useState("");
  const [applied, setApplied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const parseResult = (raw: string) => {
    const sepIdx = raw.indexOf("===");
    if (sepIdx === -1) return { subject: "", html: raw };
    const subjectLine = raw.slice(0, sepIdx).replace(/^SUBJECT:\s*/i, "").trim();
    const html = raw.slice(sepIdx + 3).trim();
    return { subject: subjectLine, html };
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setRawResult("");
    setParsedSubject("");
    setParsedHtml("");
    setApplied(false);

    try {
      const res = await fetch(`${BASE}/api/ai/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), tone, emailType, length }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "AI compose failed" }));
        throw new Error(err.error ?? "AI compose failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.content) {
              accumulated += data.content;
              setRawResult(accumulated);
              const { subject, html } = parseResult(accumulated);
              if (subject) setParsedSubject(subject);
              if (html) setParsedHtml(html);
            }
          } catch (parseErr: any) {
            if (parseErr?.message && !parseErr.message.includes("JSON")) throw parseErr;
          }
        }
      }

      const { subject, html } = parseResult(accumulated);
      setParsedSubject(subject);
      setParsedHtml(html);

      if (!html) throw new Error("AI returned no HTML. Try again.");
      toast({ title: "AI_COMPLETE", description: "Email generated — review and apply", className: "border-primary bg-background text-primary font-mono" });
    } catch (err: any) {
      toast({ title: "AI_FAILED", description: err.message ?? "Generation failed", variant: "destructive", className: "font-mono" });
    } finally {
      setGenerating(false);
    }
  };

  const apply = () => {
    if (!parsedHtml) return;
    onApply(parsedSubject, parsedHtml);
    setApplied(true);
    toast({ title: "APPLIED", description: "HTML injected into editor", className: "border-primary bg-background text-primary font-mono" });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 p-3 border-b border-border/40 space-y-3">
        {/* Prompt */}
        <div className="space-y-1.5">
          <label className="font-mono text-[9px] text-muted-foreground tracking-widest">DESCRIBE YOUR EMAIL</label>
          <Textarea
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setApplied(false); }}
            placeholder="e.g. A follow-up to prospects who downloaded our whitepaper last week. Remind them of the key insight and invite them to book a 15-min demo call."
            className="font-mono text-[11px] bg-background border-border/60 focus-visible:ring-primary min-h-[80px] resize-none leading-relaxed placeholder:text-muted-foreground/40"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
          />
          <p className="font-mono text-[9px] text-muted-foreground/40">Ctrl+Enter to generate</p>
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="space-y-1">
            <label className="font-mono text-[9px] text-muted-foreground/60">TONE</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-7 font-mono text-[10px] bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-[11px]">
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="persuasive">Persuasive</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[9px] text-muted-foreground/60">TYPE</label>
            <Select value={emailType} onValueChange={setEmailType}>
              <SelectTrigger className="h-7 font-mono text-[10px] bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-[11px]">
                <SelectItem value="promotional">Promo</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="cold-outreach">Cold Outreach</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[9px] text-muted-foreground/60">LENGTH</label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger className="h-7 font-mono text-[10px] bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-[11px]">
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={generate}
          disabled={!prompt.trim() || generating}
          className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold h-8 text-xs"
        >
          {generating
            ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> GENERATING...</>
            : <><Sparkles className="w-3 h-3 mr-1.5" /> GENERATE_EMAIL</>
          }
        </Button>
      </div>

      {/* Result area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {generating && !rawResult && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-primary animate-pulse p-2">
            <Sparkles className="w-3 h-3" /> AI is composing your email...
          </div>
        )}

        {parsedSubject && (
          <div className="space-y-1">
            <div className="font-mono text-[9px] text-muted-foreground tracking-widest">SUGGESTED_SUBJECT</div>
            <div className="font-mono text-[11px] text-primary bg-primary/5 border border-primary/20 rounded px-2.5 py-1.5 leading-relaxed">
              {parsedSubject}
            </div>
          </div>
        )}

        {rawResult && (
          <div className="space-y-1.5">
            <div className="font-mono text-[9px] text-muted-foreground tracking-widest flex items-center gap-1.5">
              <Wand2 className="w-3 h-3" />
              {generating ? "GENERATING_HTML..." : "GENERATED_HTML"}
            </div>
            <div
              ref={resultRef}
              className="bg-black/60 border border-border/40 rounded p-2 font-mono text-[9px] leading-relaxed text-foreground/60 max-h-48 overflow-y-auto"
              style={{ scrollbarWidth: "thin", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
            >
              {parsedHtml || rawResult.slice(rawResult.indexOf("===") + 3) || rawResult}
            </div>
          </div>
        )}

        {parsedHtml && !generating && (
          <div className="space-y-1.5 pt-1">
            <Button
              onClick={apply}
              disabled={applied}
              className={`w-full font-mono font-bold h-8 text-xs ${applied ? "bg-primary/20 text-primary border border-primary/40" : "bg-primary text-black hover:bg-primary/80"}`}
            >
              {applied
                ? <><ClipboardCheck className="w-3 h-3 mr-1.5" /> APPLIED_TO_EDITOR</>
                : <><ClipboardCheck className="w-3 h-3 mr-1.5" /> APPLY_TO_EDITOR</>
              }
            </Button>
            <Button
              onClick={generate}
              variant="outline"
              className="w-full font-mono h-7 text-[10px] border-border/40 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" /> REGENERATE
            </Button>
            <p className="font-mono text-[9px] text-muted-foreground/40 text-center">
              AI-generated · spam-free · review before sending
            </p>
          </div>
        )}

        {!rawResult && !generating && (
          <div className="text-center py-6 space-y-2">
            <Sparkles className="w-6 h-6 mx-auto text-primary/30" />
            <p className="font-mono text-[10px] text-muted-foreground/40 leading-relaxed">
              Describe what you want to send and the AI will write a complete, inbox-ready HTML email with your personalization tags already included.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({ open, onOpenChange, onConfirm, name }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void; name: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel max-w-sm max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="font-mono text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> CONFIRM_DELETE
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4 space-y-4">
          <p className="font-mono text-sm text-muted-foreground">
            Delete template <span className="text-foreground font-bold">"{name}"</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 font-mono border-border" onClick={() => onOpenChange(false)}>CANCEL</Button>
            <Button className="flex-1 bg-destructive text-white hover:bg-destructive/80 font-mono" onClick={onConfirm}>PURGE</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Variables Panel ───────────────────────────────────────────────────────────

const VAR_CATALOG = [
  {
    category: "Person",
    color: "text-blue-400",
    vars: [
      { tag: "{{first_name}}", desc: "First name", ex: "Sarah" },
      { tag: "{{last_name}}", desc: "Last name", ex: "Mitchell" },
      { tag: "{{full_name}}", desc: "Full name", ex: "Sarah Mitchell" },
      { tag: "{{email}}", desc: "Email address", ex: "sarah@example.com" },
      { tag: "{{age}}", desc: "Age 22–65", ex: "34" },
      { tag: "{{gender}}", desc: "Gender", ex: "Female" },
      { tag: "{{job_title}}", desc: "Job title", ex: "Marketing Director" },
      { tag: "{{company}}", desc: "Company name", ex: "Nexus Solutions" },
      { tag: "{{industry}}", desc: "Industry sector", ex: "Technology" },
      { tag: "{{website}}", desc: "Company website", ex: "www.nexus.com" },
    ],
  },
  {
    category: "Phone",
    color: "text-green-400",
    vars: [
      { tag: "{{phone}}", desc: "US phone formatted", ex: "(415) 867-5309" },
      { tag: "{{Number10}}", desc: "10-digit raw number", ex: "4158675309" },
      { tag: "{{phone_10}}", desc: "10-digit raw (alias)", ex: "4158675309" },
      { tag: "{{phone_type}}", desc: "Device model", ex: "iPhone 16 Pro" },
      { tag: "{{device}}", desc: "Device (alias)", ex: "Samsung Galaxy S25" },
      { tag: "{{carrier}}", desc: "Mobile carrier", ex: "Verizon" },
    ],
  },
  {
    category: "Location",
    color: "text-yellow-400",
    vars: [
      { tag: "{{address}}", desc: "Full US address", ex: "742 Evergreen Terrace, SF, CA 94102" },
      { tag: "{{street}}", desc: "Street address", ex: "742 Evergreen Terrace" },
      { tag: "{{city}}", desc: "City name", ex: "San Francisco" },
      { tag: "{{state}}", desc: "State abbr", ex: "CA" },
      { tag: "{{state_full}}", desc: "Full state name", ex: "California" },
      { tag: "{{zip}}", desc: "ZIP code", ex: "94102" },
      { tag: "{{country}}", desc: "Country", ex: "United States" },
    ],
  },
  {
    category: "Date & Time",
    color: "text-purple-400",
    vars: [
      { tag: "{{date}}", desc: "Full date", ex: "March 24, 2026" },
      { tag: "{{date_short}}", desc: "Date MM/DD/YYYY", ex: "03/24/2026" },
      { tag: "{{date_iso}}", desc: "ISO date", ex: "2026-03-24" },
      { tag: "{{time}}", desc: "12-hour time", ex: "2:47 PM" },
      { tag: "{{time_24}}", desc: "24-hour time", ex: "14:47" },
      { tag: "{{datetime}}", desc: "Date + time", ex: "March 24, 2026 at 2:47 PM" },
      { tag: "{{day}}", desc: "Day of week", ex: "Tuesday" },
      { tag: "{{month}}", desc: "Month name", ex: "March" },
      { tag: "{{year}}", desc: "4-digit year", ex: "2026" },
    ],
  },
  {
    category: "Utility",
    color: "text-orange-400",
    vars: [
      { tag: "{{coupon_code}}", desc: "Random coupon", ex: "CYBER-X7K2" },
      { tag: "{{tracking_id}}", desc: "Tracking ID", ex: "TRK-4F8A2C9E" },
      { tag: "{{random_number}}", desc: "5–6 digit number", ex: "847291" },
      { tag: "{{uuid}}", desc: "UUID v4", ex: "550e8400-..." },
      { tag: "{{unsubscribe_url}}", desc: "Unsubscribe link", ex: "https://..." },
      { tag: "{{click_url}}", desc: "Click tracking URL", ex: "https://..." },
    ],
  },
];

function VariablesPanel({ onInsert }: { onInsert: (html: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!query.trim()) return VAR_CATALOG;
    const q = query.toLowerCase();
    return VAR_CATALOG.map(cat => ({
      ...cat,
      vars: cat.vars.filter(v => v.tag.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q)),
    })).filter(cat => cat.vars.length > 0);
  }, [query]);

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag).catch(() => {});
    setCopied(tag);
    setTimeout(() => setCopied(null), 1500);
  };

  const insertTag = (tag: string) => {
    onInsert(tag);
    toast({ title: "INSERTED", description: tag, className: "border-primary bg-background text-primary font-mono text-xs" });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            className="pl-7 h-7 font-mono text-xs bg-background/60 border-border/50"
            placeholder="Search tags..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filtered.map(cat => (
          <div key={cat.category}>
            <div className={`font-mono text-[9px] tracking-widest uppercase px-1 pb-1 ${cat.color} opacity-80`}>
              ── {cat.category}
            </div>
            <div className="space-y-0.5">
              {cat.vars.map(v => (
                <div
                  key={v.tag}
                  className="group flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-primary/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-primary/90 truncate">{v.tag}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/60 truncate">{v.desc} · <span className="text-muted-foreground/40">{v.ex}</span></div>
                  </div>
                  <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyTag(v.tag)}
                      className="p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      title="Copy tag"
                    >
                      {copied === v.tag ? <Check className="h-2.5 w-2.5 text-green-400" /> : <ClipboardCopy className="h-2.5 w-2.5" />}
                    </button>
                    <button
                      onClick={() => insertTag(v.tag)}
                      className="p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      title="Insert at cursor"
                    >
                      <ChevronRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-xs font-mono text-muted-foreground/40">No tags found</div>
        )}
      </div>
    </div>
  );
}

// ── Editor Dialog ─────────────────────────────────────────────────────────────

type RightPanel = "files" | "brands" | "vars" | "ai" | null;

function TemplateEditorDialog({
  open, onOpenChange, initial, onSave, isPending, title,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: TemplateForm; onSave: (v: TemplateForm) => void;
  isPending: boolean; title: string;
}) {
  const [previewMode, setPreviewMode] = useState<"code" | "split" | "preview">("split");
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedCursor = useRef<{ start: number; end: number } | null>(null);

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: initial ?? {
      name: "", subject: "",
      htmlContent: `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body style="font-family:sans-serif;background:#111;color:#eee;padding:32px;max-width:600px;margin:0 auto">\n  <h1 style="color:#00ff41">Hello {{first_name | default:"there"}},</h1>\n  <p>Your message here...</p>\n  <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #333;padding-top:12px">To unsubscribe, <a href="{{unsubscribe_url}}" style="color:#555">click here</a>.</p>\n</body>\n</html>`,
    },
  });

  useEffect(() => { if (initial) form.reset(initial); }, [initial, form]);

  const html = form.watch("htmlContent");
  const subject = form.watch("subject");
  const rendered = useMemo(() => previewHtml(html), [html]);

  const saveCursor = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      savedCursor.current = { start: el.selectionStart, end: el.selectionEnd };
    }
  }, []);

  const insertAtCursor = useCallback((snippet: string) => {
    const current = form.getValues("htmlContent");

    if (previewMode === "preview") {
      setPreviewMode("split");
    }

    const el = textareaRef.current;
    const pos = savedCursor.current;

    let start: number;
    let end: number;

    if (pos !== null) {
      start = pos.start;
      end = pos.end;
    } else if (el) {
      start = el.selectionStart ?? current.length;
      end = el.selectionEnd ?? current.length;
    } else {
      const bodyClose = current.lastIndexOf("</body>");
      start = end = bodyClose > -1 ? bodyClose : current.length;
    }

    start = Math.min(start, current.length);
    end = Math.min(end, current.length);

    const newVal = current.slice(0, start) + snippet + current.slice(end);
    form.setValue("htmlContent", newVal, { shouldDirty: true, shouldValidate: true });

    const newPos = start + snippet.length;
    savedCursor.current = { start: newPos, end: newPos };

    setTimeout(() => {
      const fresh = textareaRef.current;
      if (fresh) {
        fresh.focus();
        fresh.setSelectionRange(newPos, newPos);
      }
    }, 50);
  }, [form, previewMode]);

  const togglePanel = (panel: RightPanel) => {
    setRightPanel(prev => prev === panel ? null : panel);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel max-w-[96vw] w-[1400px] max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="font-mono text-primary flex items-center gap-2 text-sm">
              <Code className="w-5 h-5" /> {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* View toggles */}
              <div className="flex gap-1">
                {(["code", "split", "preview"] as const).map(m => (
                  <button key={m} onClick={() => setPreviewMode(m)}
                    className={`font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${previewMode === m ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
                    {m === "code" ? "CODE" : m === "split" ? "SPLIT" : "PREVIEW"}
                  </button>
                ))}
              </div>
              {/* Panel toggles */}
              <div className="h-4 w-px bg-border/40" />
              <button
                onClick={() => togglePanel("files")}
                className={`flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${rightPanel === "files" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                title="File Vault — attach files and insert into email"
              >
                <Paperclip className="h-3 w-3" /> FILES
              </button>
              <button
                onClick={() => togglePanel("brands")}
                className={`flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${rightPanel === "brands" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                title="Brand Logos — search and insert brand logos"
              >
                <Globe className="h-3 w-3" /> BRANDS
              </button>
              <button
                onClick={() => togglePanel("vars")}
                className={`flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${rightPanel === "vars" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                title="Variables — browse and insert merge tags"
              >
                <Tag className="h-3 w-3" /> VARS
              </button>
              <button
                onClick={() => togglePanel("ai")}
                className={`flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${rightPanel === "ai" ? "border-primary bg-primary/15 text-primary shadow-[0_0_8px_rgba(0,255,65,0.3)]" : "border-primary/40 text-primary/70 hover:text-primary hover:border-primary/60"}`}
                title="AI Compose — generate spam-free email with AI"
              >
                <Sparkles className="h-3 w-3" /> AI
              </button>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="flex flex-col flex-1 min-h-0 px-6 pb-5 pt-4 gap-3">
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-4 flex-shrink-0">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-muted-foreground text-[10px] tracking-widest">ID_TAG</FormLabel>
                  <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border h-8" placeholder="Onboarding v2" /></FormControl>
                  <FormMessage className="text-destructive font-mono text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="font-mono text-muted-foreground text-[10px] tracking-widest">SUBJECT_LINE</FormLabel>
                  <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border h-8" placeholder="Welcome to the matrix, {{first_name}}" /></FormControl>
                  <FormMessage className="text-destructive font-mono text-xs" />
                </FormItem>
              )} />
            </div>

            {/* Spam score */}
            <div className="flex-shrink-0">
              <SpamMeter subject={subject} html={html} />
            </div>

            {/* Main area: editor + optional right panel */}
            <div className="flex-1 min-h-0 flex gap-3">
              {/* Editor / Preview */}
              <div className="flex-1 min-h-0 flex gap-3 min-w-0">
                {(previewMode === "code" || previewMode === "split") && (
                  <div className={`flex flex-col ${previewMode === "split" ? "w-1/2" : "w-full"} min-h-0`}>
                    <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                      <span className="font-mono text-[10px] text-muted-foreground">SOURCE_CODE</span>
                      <span className="font-mono text-[9px] text-primary/50 hidden sm:block">
                        {"{{"+'first_name'+"}}"}  {"{{"+'email'+"}}"}  {"{{"+'company'+"}}"}
                      </span>
                    </div>
                    <FormField control={form.control} name="htmlContent" render={({ field }) => (
                      <FormItem className="flex-1 min-h-0">
                        <FormControl className="h-full">
                          <Textarea
                            {...field}
                            ref={(el) => {
                              field.ref(el);
                              textareaRef.current = el;
                            }}
                            onBlur={saveCursor}
                            onClick={saveCursor}
                            onKeyUp={saveCursor}
                            className="font-mono text-xs bg-background border-border h-full min-h-[300px] resize-none focus-visible:ring-primary text-primary/90 leading-relaxed"
                          />
                        </FormControl>
                        <FormMessage className="text-destructive font-mono text-xs mt-1" />
                      </FormItem>
                    )} />
                  </div>
                )}

                {(previewMode === "preview" || previewMode === "split") && (
                  <div className={`flex flex-col ${previewMode === "split" ? "w-1/2" : "w-full"} min-h-0`}>
                    <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                      <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> LIVE_PREVIEW</span>
                      <span className="font-mono text-[9px] text-muted-foreground/40">Sample data applied</span>
                    </div>
                    <div className="flex-1 min-h-0 rounded border border-border/50 overflow-hidden bg-white">
                      <iframe
                        srcDoc={rendered || "<p style='padding:16px;font-family:sans-serif;color:#888'>Start typing HTML to preview...</p>"}
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin allow-popups allow-forms"
                        title="Email Preview"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right panel */}
              {rightPanel && (
                <div className={`${rightPanel === "ai" ? "w-[280px]" : "w-[220px]"} flex-shrink-0 flex flex-col border border-border/40 rounded-lg overflow-hidden bg-background/40 ${rightPanel === "ai" ? "border-primary/20" : ""}`}>
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-secondary/30 flex-shrink-0">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setRightPanel("files")}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${rightPanel === "files" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Paperclip className="h-2.5 w-2.5" /> FILES
                      </button>
                      <button
                        onClick={() => setRightPanel("brands")}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${rightPanel === "brands" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Globe className="h-2.5 w-2.5" /> BRANDS
                      </button>
                      <button
                        onClick={() => setRightPanel("vars")}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${rightPanel === "vars" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Tag className="h-2.5 w-2.5" /> VARS
                      </button>
                      <button
                        onClick={() => setRightPanel("ai")}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${rightPanel === "ai" ? "bg-primary/15 text-primary" : "text-primary/60 hover:text-primary"}`}
                      >
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </button>
                    </div>
                    <button onClick={() => setRightPanel(null)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Panel body */}
                  <div className="flex-1 min-h-0">
                    {rightPanel === "files" && <FileVaultPanel onInsert={insertAtCursor} />}
                    {rightPanel === "brands" && <BrandLogoPanel onInsert={insertAtCursor} />}
                    {rightPanel === "vars" && <VariablesPanel onInsert={insertAtCursor} />}
                    {rightPanel === "ai" && (
                      <AiComposePanel
                        onApply={(subject, html) => {
                          if (subject) form.setValue("subject", subject, { shouldDirty: true });
                          form.setValue("htmlContent", html, { shouldDirty: true, shouldValidate: true });
                          setPreviewMode("split");
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 flex justify-end">
              <Button type="submit" disabled={isPending} className="bg-primary text-black hover:bg-primary/80 font-mono font-bold px-8">
                {isPending ? "SAVING..." : "COMMIT_CHANGES"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Templates() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: number; data: TemplateForm } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ name: string; subject: string; html: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: templates, isLoading, refetch } = useListTemplates();
  const createMutation = useCreateTemplate();

  const openNew = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (t: any) => {
    setEditTarget({ id: t.id, data: { name: t.name, subject: t.subject, htmlContent: t.htmlContent } });
    setEditorOpen(true);
  };
  const openClone = (t: any) => {
    setEditTarget({ id: -1, data: { name: `${t.name} (copy)`, subject: t.subject, htmlContent: t.htmlContent } });
    setEditorOpen(true);
  };

  const handleSave = async (values: TemplateForm) => {
    setSaving(true);
    try {
      if (editTarget && editTarget.id > 0) {
        await fetch(`${BASE}/api/templates/${editTarget.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        toast({ title: "UPDATED", description: "Template saved", className: "border-primary bg-background text-primary font-mono" });
      } else {
        await createMutation.mutateAsync({ data: { ...values, textContent: "" } });
        toast({ title: "COMPILED", description: "New template created", className: "border-primary bg-background text-primary font-mono" });
      }
      setEditorOpen(false);
      setEditTarget(null);
      refetch();
    } catch {
      toast({ title: "ERROR", description: "Save failed", variant: "destructive", className: "font-mono" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${BASE}/api/templates/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "PURGED", description: `Template deleted`, className: "border-primary bg-background text-primary font-mono" });
      refetch();
    } catch {
      toast({ title: "ERROR", description: "Delete failed", variant: "destructive", className: "font-mono" });
    } finally { setDeleteTarget(null); }
  };

  return (
    <PageTransition className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">TEMPLATE_LAB</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Live preview · Spam score · File attachments · Brand logos
          </p>
        </div>
        <Button onClick={openNew} className="bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono">
          <Plus className="w-4 h-4 mr-2" /> COMPILE_NEW
        </Button>
      </div>

      <Card className="terminal-panel flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center text-primary"><TerminalText text="> LOADING_TEMPLATES..." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-background/50 sticky top-0 backdrop-blur">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-primary text-xs w-[220px]">TEMPLATE_ID</TableHead>
                  <TableHead className="font-mono text-primary text-xs">SUBJECT_LINE</TableHead>
                  <TableHead className="font-mono text-primary text-xs hidden md:table-cell">SPAM</TableHead>
                  <TableHead className="font-mono text-primary text-xs hidden lg:table-cell w-[160px]">LAST_MODIFIED</TableHead>
                  <TableHead className="font-mono text-primary text-xs w-[120px] text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((t) => {
                  const spamScore = computeSpamScore(t.subject, t.htmlContent);
                  const spamColor = spamScore < 20 ? "text-primary" : spamScore < 45 ? "text-primary/60" : spamScore < 65 ? "text-warning" : "text-destructive";
                  return (
                    <TableRow key={t.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-bold text-foreground truncate">{t.name}</span>
                        </div>
                        {t.mergeTags && t.mergeTags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {t.mergeTags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="font-mono text-[9px] border-primary/20 text-primary/60 py-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-xs">{t.subject}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className={`font-mono text-[10px] font-bold ${spamColor}`}>{spamScore}%</div>
                        <div className="w-16 h-1 bg-border/30 rounded-full overflow-hidden mt-0.5">
                          <div className={`h-full ${spamScore < 20 ? "bg-primary" : spamScore < 45 ? "bg-primary/60" : spamScore < 65 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${spamScore}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell">
                        {format(new Date(t.updatedAt), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewTarget({ name: t.name, subject: t.subject, html: t.htmlContent })} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Preview">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openClone(t)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Clone">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: t.id, name: t.name })} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!templates?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-mono">
                      NO_TEMPLATES_FOUND — click COMPILE_NEW to start
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editTarget?.data}
        onSave={handleSave}
        isPending={saving || createMutation.isPending}
        title={editTarget && editTarget.id > 0 ? `> EDIT: ${editTarget.data.name}` : `> TEMPLATE_EDITOR`}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.name ?? ""}
      />

      <Dialog open={!!previewTarget} onOpenChange={v => !v && setPreviewTarget(null)}>
        <DialogContent className="dialog-panel max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-border">
            <DialogTitle className="font-mono text-primary text-sm">{'> '}TEMPLATE_PREVIEW: {previewTarget?.name}</DialogTitle>
            <p className="font-mono text-[10px] text-muted-foreground">SUBJECT: {previewTarget?.subject}</p>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-white rounded-b-lg">
            <iframe
              srcDoc={previewTarget?.html ?? ""}
              className="w-full h-full"
              style={{ minHeight: 500, border: "none" }}
              title="Template preview"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

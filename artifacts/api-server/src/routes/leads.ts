import { Router, type IRouter } from "express";
import * as dns from "dns/promises";
import * as crypto from "crypto";
import { db, leads } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const SKIP_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "schema.org",
  "w3.org", "sentry.io", "cloudflare.com", "jquery.com", "google.com",
  "facebook.com", "twitter.com", "linkedin.com", "instagram.com",
  "wpcf7.net", "gravatar.com", "wordpress.org", "doubleclick.net",
  "googletagmanager.com", "googleanalytics.com", "yourdomain.com",
  "yourcompany.com", "yoursite.com", "email.com", "domain.com",
  "mail.com", "mailchimp.com", "sendgrid.net", "amazonaws.com",
  "mailgun.org", "constantcontact.com", "hubspot.com",
  "noreply.com", "no-reply.com",
]);

const CONTACT_SUBPATHS = [
  "/contact", "/contact-us", "/about", "/about-us", "/team",
  "/our-team", "/staff", "/people", "/company", "/leadership",
  "/management", "/support", "/help", "/info", "/reach-us",
  "/contact.html", "/about.html", "/team.html",
  "/who-we-are", "/meet-the-team", "/our-people",
  "/executive-team", "/board", "/directors",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

const EMAIL_PATTERNS = [
  { id: "first.last",   label: "john.doe@",    fn: (f: string, l: string) => `${f}.${l}` },
  { id: "firstlast",    label: "johndoe@",     fn: (f: string, l: string) => `${f}${l}` },
  { id: "first",        label: "john@",        fn: (f: string, _: string) => f },
  { id: "f.last",       label: "j.doe@",       fn: (f: string, l: string) => `${f[0]}.${l}` },
  { id: "flast",        label: "jdoe@",        fn: (f: string, l: string) => `${f[0]}${l}` },
  { id: "last.first",   label: "doe.john@",    fn: (f: string, l: string) => `${l}.${f}` },
  { id: "lastf",        label: "doej@",        fn: (f: string, l: string) => `${l}${f[0]}` },
  { id: "first_last",   label: "john_doe@",    fn: (f: string, l: string) => `${f}_${l}` },
];

// ─── MX Cache ────────────────────────────────────────────────────────────────

const MX_CACHE: Map<string, boolean> = new Map();

async function checkMx(domain: string): Promise<boolean> {
  if (MX_CACHE.has(domain)) return MX_CACHE.get(domain)!;
  try {
    const records = await dns.resolveMx(domain);
    const valid = records.length > 0;
    MX_CACHE.set(domain, valid);
    return valid;
  } catch {
    MX_CACHE.set(domain, false);
    return false;
  }
}

// ─── Web Fetching ────────────────────────────────────────────────────────────

async function fetchPage(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": randomUA(),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          if (attempt < retries) { await sleep(1000 * (attempt + 1)); continue; }
        }
        return null;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html") && !ct.includes("text")) return null;
      const text = await res.text();
      return text.slice(0, 600_000);
    } catch {
      if (attempt < retries) await sleep(500);
    }
  }
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Email Extraction ────────────────────────────────────────────────────────

function extractEmails(html: string, _sourceUrl: string): Array<{ email: string; domain: string; nameGuess: string | null; source: "mailto" | "text" }> {
  const seen = new Set<string>();
  const results: Array<{ email: string; domain: string; nameGuess: string | null; source: "mailto" | "text" }> = [];

  // Priority 1: mailto: links — most reliable
  const mailtoRx = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let m;
  while ((m = mailtoRx.exec(html)) !== null) {
    const email = m[1].toLowerCase().replace(/[.,;:'"]+$/, "");
    if (isValidEmail(email) && !seen.has(email)) {
      seen.add(email);
      const [local, domain] = email.split("@");
      results.push({ email, domain, nameGuess: guessNameFromLocal(local), source: "mailto" });
    }
  }

  // Priority 2: Obfuscated emails — "john [at] domain [dot] com"
  const obfuscated = deobfuscateEmails(html);
  for (const email of obfuscated) {
    if (!seen.has(email)) {
      seen.add(email);
      const [local, domain] = email.split("@");
      results.push({ email, domain, nameGuess: guessNameFromLocal(local), source: "text" });
    }
  }

  // Priority 3: Plain text emails
  const matches = html.match(EMAIL_REGEX) ?? [];
  for (const raw of matches) {
    const email = raw.toLowerCase().trim().replace(/[.,;:'"]+$/, "");
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    const [local, domain] = email.split("@");
    results.push({ email, domain, nameGuess: guessNameFromLocal(local), source: "text" });
  }

  return results;
}

function isValidEmail(email: string): boolean {
  if (!email.includes("@")) return false;
  const [local, domain] = email.split("@");
  if (!domain || !local || local.length < 2 || local.length > 60) return false;
  if (SKIP_DOMAINS.has(domain)) return false;
  if (domain.endsWith(".png") || domain.endsWith(".jpg") || domain.endsWith(".css") || domain.endsWith(".js")) return false;
  if (domain.split(".").pop()!.length < 2) return false;
  return true;
}

function deobfuscateEmails(text: string): string[] {
  const results: string[] = [];
  // "john [at] domain [dot] com" / "john at domain dot com"
  const patterns = [
    /([a-z0-9._%+\-]+)\s*[\[\(]?\s*at\s*[\]\)]?\s*([a-z0-9.\-]+)\s*[\[\(]?\s*dot\s*[\]\)]?\s*([a-z]{2,})/gi,
    /([a-z0-9._%+\-]+)\s*@\s*([a-z0-9.\-]+)\s*\.\s*([a-z]{2,})/gi,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(text)) !== null) {
      const email = `${m[1].trim()}@${m[2].trim()}.${m[3].trim()}`.toLowerCase();
      if (isValidEmail(email)) results.push(email);
    }
  }
  return results;
}

function guessNameFromLocal(local: string): string | null {
  const clean = local.replace(/[^a-z.+\-_]/gi, "").toLowerCase();
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length >= 2 && parts[0].length >= 2 && parts[1].length >= 2) {
      return `${cap(parts[0])} ${cap(parts[1])}`;
    }
  }
  if (clean.includes("_")) {
    const parts = clean.split("_");
    if (parts.length >= 2 && parts[0].length >= 2 && parts[1].length >= 2) {
      return `${cap(parts[0])} ${cap(parts[1])}`;
    }
  }
  return null;
}

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }
function guessCompany(domain: string): string {
  return domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sitemap Discovery ───────────────────────────────────────────────────────

async function discoverPagesFromSitemap(baseUrl: string): Promise<string[]> {
  const pages: string[] = [];
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-0.xml"]) {
    const html = await fetchPage(`${baseUrl}${path}`);
    if (!html) continue;
    const locs = html.match(/<loc>([^<]+)<\/loc>/g) ?? [];
    for (const loc of locs.slice(0, 30)) {
      const url = loc.replace(/<\/?loc>/g, "").trim();
      const lower = url.toLowerCase();
      if (lower.includes("contact") || lower.includes("team") || lower.includes("about") ||
          lower.includes("people") || lower.includes("staff") || lower.includes("leadership") ||
          lower.includes("directory") || lower.includes("member")) {
        pages.push(url);
      }
    }
    if (pages.length > 0) break;
  }
  return pages.slice(0, 10);
}

// ─── WHOIS Email Lookup ──────────────────────────────────────────────────────

async function lookupWhoisEmail(domain: string): Promise<string[]> {
  const emails: string[] = [];
  try {
    const res = await fetch(`https://www.whois.com/whois/${domain}`, {
      headers: { "User-Agent": randomUA(), "Accept": "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return emails;
    const html = await res.text();
    // Look for emails in WHOIS data sections
    const whoisSection = html.match(/Registrant[\s\S]{0,2000}?(?:Technical|Name Server|DNSSEC)/i)?.[0] ?? html;
    const found = whoisSection.match(EMAIL_REGEX) ?? [];
    for (const e of found) {
      const email = e.toLowerCase().replace(/[.,;]+$/, "");
      if (isValidEmail(email) && !SKIP_DOMAINS.has(email.split("@")[1])) {
        emails.push(email);
      }
    }
  } catch { /* ignore */ }
  return [...new Set(emails)].slice(0, 5);
}

// ─── Search Engines ──────────────────────────────────────────────────────────

async function searchDDG(query: string): Promise<string | null> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://duckduckgo.com/",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("duckduckgo") && text.length > 5000) return text;
    return null;
  } catch { return null; }
}

async function searchBing(query: string): Promise<string | null> {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&first=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.bing.com/",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("bing") && text.length > 3000) return text;
    return null;
  } catch { return null; }
}

async function searchWeb(query: string): Promise<{ html: string; source: string } | null> {
  const ddg = await searchDDG(query);
  if (ddg) return { html: ddg, source: "DDG" };
  await sleep(400);
  const bing = await searchBing(query);
  if (bing) return { html: bing, source: "BING" };
  return null;
}

// Extract direct email hits and snippet text from search results
function mineSearchResult(html: string, targetDomain: string): { emails: string[]; text: string } {
  // Direct @domain emails in results
  const domainEscaped = targetDomain.replace(/\./g, "\\.");
  const emailRx = new RegExp(`[a-zA-Z0-9._%+\\-]+@${domainEscaped}`, "gi");
  const emails = (html.match(emailRx) ?? []).map(e => e.toLowerCase());

  // Also grab general text for name extraction (strip tags)
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  return { emails: [...new Set(emails)], text };
}

// ─── Name Extraction ─────────────────────────────────────────────────────────

const NOT_NAMES = new Set([
  "The", "This", "That", "Your", "Our", "Their", "Some", "More", "Most",
  "Best", "Top", "New", "All", "Any", "Use", "Get", "See", "Find",
  "Help", "With", "From", "For", "And", "But", "Not", "Are", "Was",
  "Has", "Have", "Can", "Will", "Inc", "LLC", "Ltd", "Corp", "Co",
  "Sales", "Marketing", "Finance", "Operations", "Human", "Resources",
  "Chief", "Vice", "Senior", "Junior", "Director", "Manager", "Officer",
  "Executive", "President", "Head", "Lead", "Principal", "General",
  "Account", "Business", "Regional", "National", "Global", "Corporate",
  "January", "February", "March", "April", "June", "July", "August",
  "September", "October", "November", "December", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Read", "View",
  "Learn", "Click", "Here", "More", "About", "Contact", "Email", "Phone",
  "Street", "Avenue", "Drive", "Suite", "Floor", "City", "State", "Zip",
  "United", "States", "America", "Canada", "Kingdom", "Australia",
]);

function looksLikeName(word: string): boolean {
  if (word.length < 2 || word.length > 22) return false;
  if (NOT_NAMES.has(word)) return false;
  if (/[0-9]/.test(word)) return false;
  if (/^[A-Z]{2,}$/.test(word)) return false;
  return /^[A-Z][a-z]{1,21}$/.test(word);
}

interface ExtractedName { firstName: string; lastName: string; full: string; confidence: number; }

function extractNamesFromText(text: string): ExtractedName[] {
  const found: ExtractedName[] = [];
  const seen = new Set<string>();

  // Pattern 1: "FirstName LastName - Job Title"
  const titleRx = /([A-Z][a-z]{1,18})\s+([A-Z][a-z]{1,22})\s*[-–|·,]\s*(?:CEO|CFO|CTO|COO|CMO|VP|Vice|Chief|Director|Manager|President|Owner|Founder|Head|Officer|Executive|Sales|Marketing|HR|General|Senior|Partner|Principal|Consultant|Analyst|Engineer|Developer|Lead|Associate|Coordinator|Specialist|Controller|Recruiter|Attorney|Counsel|Advisor|Broker|Agent)/g;
  let m;
  while ((m = titleRx.exec(text)) !== null) {
    const [, f, l] = m;
    if (!looksLikeName(f) || !looksLikeName(l)) continue;
    const full = `${f} ${l}`;
    if (!seen.has(full)) { seen.add(full); found.push({ firstName: f, lastName: l, full, confidence: 92 }); }
  }

  // Pattern 2: Email local part "john.doe@" → "John Doe"
  const emailLocalRx = /([a-z]{2,12})\.([a-z]{2,15})@[a-z0-9.\-]+\.[a-z]{2,}/gi;
  while ((m = emailLocalRx.exec(text)) !== null) {
    const f = cap(m[1]), l = cap(m[2]);
    if (!looksLikeName(f) || !looksLikeName(l)) continue;
    const full = `${f} ${l}`;
    if (!seen.has(full)) { seen.add(full); found.push({ firstName: f, lastName: l, full, confidence: 75 }); }
  }

  // Pattern 3: "Name, Title at Company" or "Name | Title"
  const nameAtRx = /([A-Z][a-z]{1,18})\s+([A-Z][a-z]{1,22})\s*[|,]\s*(?:CEO|CFO|CTO|COO|VP|Director|Manager|President|Owner|Founder|Head|Officer|Senior|Lead|Analyst|Engineer|Partner|Consultant|Attorney|Agent|Advisor|Recruiter|Coordinator)/g;
  while ((m = nameAtRx.exec(text)) !== null) {
    const [, f, l] = m;
    if (!looksLikeName(f) || !looksLikeName(l)) continue;
    const full = `${f} ${l}`;
    if (!seen.has(full)) { seen.add(full); found.push({ firstName: f, lastName: l, full, confidence: 85 }); }
  }

  // Pattern 4: General consecutive capitalized words (lower confidence)
  const generalRx = /([A-Z][a-z]{2,15})\s+([A-Z][a-z]{2,20})/g;
  while ((m = generalRx.exec(text)) !== null) {
    const [, f, l] = m;
    if (!looksLikeName(f) || !looksLikeName(l)) continue;
    const full = `${f} ${l}`;
    if (!seen.has(full)) {
      seen.add(full);
      found.push({ firstName: f, lastName: l, full, confidence: 42 });
    }
    if (found.length >= 120) break;
  }

  return found.sort((a, b) => b.confidence - a.confidence);
}

// ─── Search Query Builder ────────────────────────────────────────────────────

function buildSearchQueries(
  domain: string, jobTitles: string[], country: string, state: string,
  industryKeywords: string[], searchDepth: string
): string[] {
  const queries: string[] = [];
  const locationStr = [state, country].filter(Boolean).join(", ");
  const industryStr = industryKeywords.slice(0, 2).join(" ");

  // Direct email search (highest priority)
  queries.push(`"@${domain}" email contact`);
  queries.push(`site:${domain} email contact`);

  for (const title of jobTitles.slice(0, 4)) {
    queries.push(`"${title}" "@${domain}"`);
    queries.push(`"${title}" "${domain}" contact email`);
    if (locationStr) queries.push(`"${title}" "${domain}" "${locationStr}"`);
    if (industryStr) queries.push(`"${title}" "${domain}" ${industryStr} email`);
    if (searchDepth !== "quick") {
      queries.push(`"${domain}" "${title}" linkedin`);
      queries.push(`"${title}" "${domain}" company directory`);
      if (industryStr && locationStr) queries.push(`${industryStr} ${locationStr} "${title}" "${domain}"`);
    }
  }

  // Catch-all
  queries.push(`${domain} email address contact`);
  queries.push(`${domain} staff directory emails`);

  const maxQ = searchDepth === "quick" ? 5 : searchDepth === "deep" ? 14 : 10;
  return [...new Set(queries)].slice(0, maxQ);
}

// ─── SSE Helper ──────────────────────────────────────────────────────────────

function sseWrite(res: any, event: string, data: any) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === "function") res.flush();
  } catch { /* client disconnected */ }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// DOMAIN CRAWLER
router.post("/leads/crawl", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const { urls = [], crawlSubPages = true, validateMx = true, maxSubPages = 8 } = req.body as {
    urls: string[]; crawlSubPages: boolean; validateMx: boolean; maxSubPages: number;
  };

  const sessionId = crypto.randomUUID();
  const allFound = new Map<string, any>();

  sseWrite(res, "session", { sessionId });
  sseWrite(res, "log", { message: `> SESSION ${sessionId.slice(0, 8)} INITIATED`, level: "info" });
  sseWrite(res, "log", { message: `> TARGETS: ${urls.length} URL${urls.length !== 1 ? "S" : ""}`, level: "info" });
  sseWrite(res, "log", { message: `> ENGINE: mailto extractor + obfuscation decoder + regex scanner`, level: "trace" });

  for (const rawUrl of urls.slice(0, 20)) {
    let url = rawUrl.trim();
    if (!url.startsWith("http")) url = `https://${url}`;

    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {
      sseWrite(res, "log", { message: `> INVALID URL: ${url}`, level: "warn" }); continue;
    }

    const base = `https://${domain}`;
    sseWrite(res, "log", { message: `> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, level: "info" });
    sseWrite(res, "log", { message: `> CRAWLING: ${domain}`, level: "info" });

    // Discover pages: specified URL + common subpaths + sitemap
    const pagesToCrawl: string[] = [url];
    if (crawlSubPages) {
      for (const path of CONTACT_SUBPATHS.slice(0, maxSubPages)) {
        pagesToCrawl.push(`${base}${path}`);
      }
      // Also discover from sitemap
      sseWrite(res, "log", { message: `  → DISCOVERING PAGES VIA SITEMAP...`, level: "trace" });
      const sitemapPages = await discoverPagesFromSitemap(base);
      if (sitemapPages.length > 0) {
        sseWrite(res, "log", { message: `  ✓ SITEMAP: ${sitemapPages.length} RELEVANT PAGES FOUND`, level: "success" });
        pagesToCrawl.push(...sitemapPages);
      }
    }

    const company = guessCompany(domain);
    let pageCount = 0;

    for (const pageUrl of [...new Set(pagesToCrawl)]) {
      sseWrite(res, "log", { message: `  → FETCHING: ${pageUrl}`, level: "trace" });
      const html = await fetchPage(pageUrl);
      if (!html) {
        sseWrite(res, "log", { message: `  × NO_RESPONSE: ${pageUrl}`, level: "warn" }); continue;
      }
      pageCount++;
      const found = extractEmails(html, pageUrl);
      const newOnes = found.filter(f => !allFound.has(f.email));
      sseWrite(res, "log", {
        message: `  ✓ ${pageUrl.split("/").slice(-1)[0] || "homepage"}: ${found.length} emails (${found.filter(f => f.source === "mailto").length} mailto, ${newOnes.length} new)`,
        level: newOnes.length > 0 ? "success" : "trace",
      });

      for (const { email, domain: emailDomain, nameGuess, source } of found) {
        if (allFound.has(email)) continue;

        let mxValid: boolean | null = null;
        if (validateMx) mxValid = await checkMx(emailDomain);

        const lead = {
          sessionId, email, name: nameGuess, company, domain,
          sourceUrl: pageUrl, method: "scraped", mxValid,
          confidence: source === "mailto" ? (mxValid ? 95 : 75) : (mxValid ? 82 : 50),
          pattern: source,
        };
        allFound.set(email, lead);
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { email, name: nameGuess, company, domain, sourceUrl: pageUrl, method: "scraped", mxValid, confidence: lead.confidence, pattern: source });
        sseWrite(res, "log", {
          message: `  ✉ ${source === "mailto" ? "✓ MAILTO" : "  TEXT"}: ${email} [MX: ${mxValid === true ? "✓" : mxValid === false ? "✗" : "?"}]`,
          level: mxValid ? "success" : "warn",
        });
      }
    }

    // WHOIS lookup for domain registrant email
    sseWrite(res, "log", { message: `  → WHOIS LOOKUP: ${domain}`, level: "trace" });
    const whoisEmails = await lookupWhoisEmail(domain);
    for (const email of whoisEmails) {
      if (allFound.has(email)) continue;
      const [, emailDomain] = email.split("@");
      const mxValid = validateMx ? await checkMx(emailDomain) : null;
      const lead = {
        sessionId, email, name: null, company, domain,
        sourceUrl: `whois:${domain}`, method: "scraped", mxValid,
        confidence: 70, pattern: "whois",
      };
      allFound.set(email, lead);
      await db.insert(leads).values(lead).onConflictDoNothing();
      sseWrite(res, "lead", { ...lead });
      sseWrite(res, "log", { message: `  ✉ WHOIS: ${email}`, level: "success" });
    }

    const domainLeads = [...allFound.values()].filter(l => l.domain === domain).length;
    sseWrite(res, "log", { message: `> DOMAIN DONE: ${domain} — ${pageCount} PAGES, ${domainLeads} UNIQUE LEADS`, level: "info" });
  }

  sseWrite(res, "log", { message: `> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, level: "info" });
  sseWrite(res, "log", { message: `> SCAN COMPLETE — ${allFound.size} TOTAL UNIQUE LEADS`, level: "success" });
  sseWrite(res, "done", { total: allFound.size, sessionId });
  res.end();
});

// TARGETED HUNT
router.post("/leads/targeted", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const { domain, company, firstNames = [], lastNames = [], patterns = ["first.last", "firstlast", "first", "f.last"], validateMx = true } = req.body as {
    domain: string; company: string; firstNames: string[]; lastNames: string[]; patterns: string[]; validateMx: boolean;
  };

  const sessionId = crypto.randomUUID();
  const cleanDomain = domain.trim().toLowerCase().replace(/^[@\s]+/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const companyName = company || guessCompany(cleanDomain);

  sseWrite(res, "session", { sessionId });
  sseWrite(res, "log", { message: `> TARGETED_HUNT: ${cleanDomain}`, level: "info" });
  sseWrite(res, "log", { message: `> NAMES: ${firstNames.length} FIRST × ${lastNames.length} LAST = ${firstNames.length * lastNames.length * patterns.length} PERMUTATIONS`, level: "info" });

  // Phase 1: MX check
  let mxValid: boolean | null = null;
  if (validateMx) {
    sseWrite(res, "log", { message: `> PHASE 1: MX RECORD VALIDATION`, level: "info" });
    mxValid = await checkMx(cleanDomain);
    sseWrite(res, "log", {
      message: mxValid ? `  ✓ MX CONFIRMED — ${cleanDomain} ACCEPTS MAIL` : `  ⚠ NO MX RECORDS — VERIFY DOMAIN`,
      level: mxValid ? "success" : "warn",
    });
  }

  // Phase 2: Crawl company site for real emails
  sseWrite(res, "log", { message: `> PHASE 2: SITE CRAWL — HUNTING REAL EMAILS`, level: "info" });
  const sitePagesToCheck = [
    `https://${cleanDomain}`,
    `https://${cleanDomain}/team`, `https://${cleanDomain}/about`,
    `https://${cleanDomain}/contact`, `https://${cleanDomain}/leadership`,
    `https://${cleanDomain}/staff`, `https://${cleanDomain}/people`,
    `https://${cleanDomain}/our-team`, `https://${cleanDomain}/about-us`,
    `https://${cleanDomain}/contact-us`,
  ];

  // Sitemap discovery
  const sitemapPages = await discoverPagesFromSitemap(`https://${cleanDomain}`);
  if (sitemapPages.length) {
    sseWrite(res, "log", { message: `  → SITEMAP: ${sitemapPages.length} ADDITIONAL PAGES`, level: "trace" });
    sitePagesToCheck.push(...sitemapPages);
  }

  const scrapedEmails = new Set<string>();
  let scraped = 0;

  for (const pageUrl of [...new Set(sitePagesToCheck)]) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    const found = extractEmails(html, pageUrl);
    const domainOnes = found.filter(f => f.domain === cleanDomain);
    if (domainOnes.length > 0) {
      sseWrite(res, "log", { message: `  ✓ ${pageUrl}: ${domainOnes.length} email(s) from @${cleanDomain}`, level: "success" });
      for (const { email, nameGuess, source } of domainOnes.slice(0, 30)) {
        if (scrapedEmails.has(email)) continue;
        scrapedEmails.add(email);
        const lead = {
          sessionId, email, name: nameGuess, company: companyName, domain: cleanDomain,
          sourceUrl: pageUrl, method: "scraped", mxValid,
          confidence: source === "mailto" ? 96 : 85, pattern: source,
        };
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { ...lead });
        sseWrite(res, "log", { message: `  ✉ REAL: ${email} [${source}]`, level: "success" });
        scraped++;
      }
    }
  }

  // WHOIS
  const whoisEmails = await lookupWhoisEmail(cleanDomain);
  for (const email of whoisEmails) {
    if (!scrapedEmails.has(email)) {
      scrapedEmails.add(email);
      const lead = {
        sessionId, email, name: null, company: companyName, domain: cleanDomain,
        sourceUrl: `whois:${cleanDomain}`, method: "scraped", mxValid, confidence: 70, pattern: "whois",
      };
      await db.insert(leads).values(lead).onConflictDoNothing();
      sseWrite(res, "lead", { ...lead });
      sseWrite(res, "log", { message: `  ✉ WHOIS: ${email}`, level: "success" });
      scraped++;
    }
  }

  sseWrite(res, "log", { message: `  → ${scraped} REAL EMAILS FOUND ON SITE`, level: scraped > 0 ? "success" : "warn" });

  // Phase 3: Pattern generation
  sseWrite(res, "log", { message: `> PHASE 3: PATTERN GENERATION`, level: "info" });
  const selectedPatterns = EMAIL_PATTERNS.filter(p => patterns.includes(p.id));
  let generated = 0;

  for (const firstName of firstNames.slice(0, 50)) {
    for (const lastName of lastNames.slice(0, 50)) {
      const f = firstName.trim().toLowerCase().replace(/[^a-z]/g, "");
      const l = lastName.trim().toLowerCase().replace(/[^a-z]/g, "");
      if (!f || !l) continue;
      const fullName = `${cap(f)} ${cap(l)}`;

      for (const pat of selectedPatterns) {
        const local = pat.fn(f, l);
        const email = `${local}@${cleanDomain}`;
        if (scrapedEmails.has(email)) continue; // skip if already found for real

        const confidence = mxValid
          ? pat.id === "first.last" ? 78 : pat.id === "firstlast" ? 72 : pat.id === "first" ? 65 : pat.id === "f.last" ? 62 : 55
          : 20;

        const lead = {
          sessionId, email, name: fullName, company: companyName, domain: cleanDomain,
          sourceUrl: null, method: "generated", mxValid, confidence, pattern: pat.id,
        };
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { ...lead });
        generated++;
        if (generated % 10 === 0) sseWrite(res, "log", { message: `  → ${generated} PATTERNS GENERATED...`, level: "trace" });
      }
      await sleep(1);
    }
  }

  sseWrite(res, "log", { message: `> HUNT COMPLETE — ${scraped} REAL + ${generated} GENERATED`, level: "success" });
  sseWrite(res, "done", { total: scraped + generated, sessionId });
  res.end();
});

// ADVANCED FINDER
router.post("/leads/advanced-find", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const {
    domain: rawDomain = "", jobTitles = [], country = "", state = "",
    industryKeywords = [], searchDepth = "standard", targetCount = 500, verifyMx = true,
  } = req.body as {
    domain: string; jobTitles: string[]; country: string; state: string;
    industryKeywords: string[]; searchDepth: string; targetCount: number; verifyMx: boolean;
  };

  const domain = rawDomain.trim().toLowerCase()
    .replace(/^[@\s]+/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const sessionId = crypto.randomUUID();
  const captured = new Map<string, any>();

  sseWrite(res, "session", { sessionId });
  sseWrite(res, "log", { message: `> ADVANCED_FINDER SESSION ${sessionId.slice(0, 8)}`, level: "info" });
  sseWrite(res, "log", { message: `> TARGET DOMAIN: @${domain}`, level: "info" });
  sseWrite(res, "log", { message: `> POSITIONS: ${jobTitles.join(", ") || "ANY"}`, level: "info" });
  sseWrite(res, "log", { message: `> LOCATION: ${[state, country].filter(Boolean).join(", ") || "GLOBAL"}`, level: "info" });
  sseWrite(res, "log", { message: `> DEPTH: ${searchDepth.toUpperCase()} · TARGET: ${targetCount}`, level: "info" });
  sseWrite(res, "log", { message: `> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, level: "info" });

  // PHASE 1: MX validation
  let mxValid: boolean | null = null;
  if (verifyMx) {
    sseWrite(res, "log", { message: `> PHASE 1: MX RECORD ANALYSIS`, level: "info" });
    mxValid = await checkMx(domain);
    sseWrite(res, "log", {
      message: mxValid ? `  ✓ ${domain} — MX CONFIRMED` : `  ⚠ ${domain} — NO MX RECORDS`,
      level: mxValid ? "success" : "warn",
    });
  }

  // PHASE 2: Direct site crawl — find real emails first
  sseWrite(res, "log", { message: `> PHASE 2: DIRECT SITE CRAWL`, level: "info" });
  const sitePages = [
    `https://${domain}`, `https://www.${domain}`,
    `https://${domain}/team`, `https://${domain}/about`,
    `https://${domain}/contact`, `https://${domain}/leadership`,
    `https://${domain}/staff`, `https://${domain}/people`,
    `https://${domain}/our-team`, `https://${domain}/about-us`,
    `https://${domain}/contact-us`, `https://${domain}/management`,
    `https://${domain}/executive-team`, `https://${domain}/board`,
    `https://${domain}/directory`,
  ];

  // Add sitemap-discovered pages
  const sitemapDiscovered = await discoverPagesFromSitemap(`https://${domain}`);
  if (sitemapDiscovered.length) {
    sseWrite(res, "log", { message: `  → SITEMAP: +${sitemapDiscovered.length} PAGES`, level: "trace" });
    sitePages.push(...sitemapDiscovered);
  }

  const namePool = new Map<string, ExtractedName>();
  let directHits = 0;

  for (const pageUrl of [...new Set(sitePages)]) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    // Extract real emails from this page
    const emails = extractEmails(html, pageUrl);
    const domainEmails = emails.filter(e => e.domain === domain);
    if (domainEmails.length > 0) {
      sseWrite(res, "log", { message: `  ✓ ${pageUrl.replace(`https://${domain}`, "") || "/"}: ${domainEmails.length} direct email(s)`, level: "success" });
      for (const { email, nameGuess, source } of domainEmails) {
        if (captured.has(email)) continue;
        const lead = {
          sessionId, email, name: nameGuess, company: guessCompany(domain), domain,
          sourceUrl: pageUrl, method: "found", mxValid,
          confidence: source === "mailto" ? 97 : 88, pattern: "direct",
        };
        captured.set(email, lead);
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { ...lead });
        sseWrite(res, "log", { message: `  ✉ DIRECT: ${email} [${source}]`, level: "success" });
        directHits++;
      }
    }

    // Extract names from the page text for pattern generation later
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const names = extractNamesFromText(text);
    for (const name of names.slice(0, 30)) {
      if (!namePool.has(name.full)) namePool.set(name.full, name);
    }
  }

  sseWrite(res, "log", { message: `  → SITE CRAWL DONE: ${directHits} DIRECT HITS, ${namePool.size} NAMES FROM PAGES`, level: directHits > 0 ? "success" : "info" });

  // PHASE 3: WHOIS lookup
  sseWrite(res, "log", { message: `> PHASE 3: WHOIS LOOKUP`, level: "info" });
  const whoisEmails = await lookupWhoisEmail(domain);
  for (const email of whoisEmails) {
    if (!captured.has(email)) {
      const lead = {
        sessionId, email, name: null, company: guessCompany(domain), domain,
        sourceUrl: `whois:${domain}`, method: "found", mxValid, confidence: 72, pattern: "whois",
      };
      captured.set(email, lead);
      await db.insert(leads).values(lead).onConflictDoNothing();
      sseWrite(res, "lead", { ...lead });
      sseWrite(res, "log", { message: `  ✉ WHOIS: ${email}`, level: "success" });
    }
  }
  if (whoisEmails.length === 0) sseWrite(res, "log", { message: `  → No WHOIS emails found`, level: "trace" });

  // PHASE 4: Web intelligence search
  const queries = buildSearchQueries(domain, jobTitles.length ? jobTitles : ["CEO", "Manager", "Director"], country, state, industryKeywords, searchDepth);
  sseWrite(res, "log", { message: `> PHASE 4: WEB INTELLIGENCE (${queries.length} QUERIES)`, level: "info" });

  for (let qi = 0; qi < queries.length; qi++) {
    if (captured.size >= Math.min(targetCount, 5000)) break;

    const query = queries[qi];
    sseWrite(res, "log", { message: `  [${qi + 1}/${queries.length}] ${query}`, level: "trace" });

    const result = await searchWeb(query);
    if (!result) {
      sseWrite(res, "log", { message: `  × QUERY ${qi + 1}: NO RESULTS`, level: "warn" }); continue;
    }

    const { emails: directEmails, text } = mineSearchResult(result.html, domain);

    // Direct email hits from search results
    let newDirect = 0;
    for (const emailRaw of directEmails.slice(0, 15)) {
      const email = emailRaw.toLowerCase();
      if (!captured.has(email) && isValidEmail(email)) {
        const local = email.split("@")[0];
        const nameParts = local.replace(/[._\-]/g, " ").split(/\s+/);
        const nameGuess = nameParts.length >= 2 ? nameParts.map(cap).join(" ") : null;
        const lead = {
          sessionId, email,
          name: nameGuess, company: guessCompany(domain), domain,
          sourceUrl: `${result.source}:${query.slice(0, 40)}`,
          method: "found", mxValid, confidence: 93, pattern: "search-direct",
        };
        captured.set(email, lead);
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { ...lead });
        sseWrite(res, "log", { message: `  ✉ DIRECT HIT: ${email} [${result.source}]`, level: "success" });
        newDirect++;
      }
    }

    // Extract names from search results
    const names = extractNamesFromText(text);
    let newNames = 0;
    for (const name of names) {
      if (!namePool.has(name.full)) {
        namePool.set(name.full, name);
        newNames++;
      }
    }
    sseWrite(res, "log", {
      message: `  ✓ QUERY ${qi + 1} [${result.source}]: ${newDirect} direct, ${newNames} new names (+${namePool.size} total)`,
      level: (newDirect > 0 || newNames > 0) ? "success" : "trace",
    });

    // Crawl some result URLs for more emails
    const resultUrls = result.html.match(/href="(https?:\/\/[^"]{10,200})"/g) ?? [];
    const urlsToVisit = resultUrls
      .map(h => h.slice(6, -1))
      .filter(u => {
        try {
          const host = new URL(u).hostname;
          return host.includes(domain) || u.includes("contact") || u.includes("team") || u.includes("about");
        } catch { return false; }
      })
      .slice(0, 3);

    for (const visitUrl of urlsToVisit) {
      const html = await fetchPage(visitUrl);
      if (!html) continue;
      const found = extractEmails(html, visitUrl);
      const domainEmails = found.filter(f => f.domain === domain);
      for (const { email, nameGuess, source } of domainEmails) {
        if (captured.has(email)) continue;
        const lead = {
          sessionId, email, name: nameGuess, company: guessCompany(domain), domain,
          sourceUrl: visitUrl, method: "found", mxValid,
          confidence: source === "mailto" ? 95 : 85, pattern: "crawled",
        };
        captured.set(email, lead);
        await db.insert(leads).values(lead).onConflictDoNothing();
        sseWrite(res, "lead", { ...lead });
        sseWrite(res, "log", { message: `    ✉ CRAWLED: ${email}`, level: "success" });
      }
    }

    await sleep(350);
  }

  // PHASE 5: Pattern generation from name pool
  const maxToGenerate = Math.max(0, Math.min(targetCount, 5000) - captured.size);
  sseWrite(res, "log", { message: `> PHASE 5: PERMUTATION ENGINE`, level: "info" });
  sseWrite(res, "log", { message: `> NAME POOL: ${namePool.size} IDENTITIES · GENERATING UP TO ${maxToGenerate} MORE`, level: "info" });

  const ADV_PATTERNS: Array<{ id: string; fn: (f: string, l: string) => string; weight: number }> = [
    { id: "first.last",  fn: (f, l) => `${f}.${l}`,   weight: 5 },
    { id: "firstlast",   fn: (f, l) => `${f}${l}`,    weight: 4 },
    { id: "first",       fn: (f)    => f,              weight: 3 },
    { id: "f.last",      fn: (f, l) => `${f[0]}.${l}`, weight: 3 },
    { id: "flast",       fn: (f, l) => `${f[0]}${l}`,  weight: 2 },
    { id: "last.first",  fn: (f, l) => `${l}.${f}`,   weight: 2 },
  ];

  let generated = 0;
  for (const [, person] of namePool) {
    if (generated >= maxToGenerate) break;
    const f = person.firstName.toLowerCase().replace(/[^a-z]/g, "");
    const l = person.lastName.toLowerCase().replace(/[^a-z]/g, "");
    if (!f || !l || f.length < 2 || l.length < 2) continue;

    for (const pat of ADV_PATTERNS) {
      if (generated >= maxToGenerate) break;
      const email = `${pat.fn(f, l)}@${domain}`;
      if (captured.has(email)) continue;

      const baseConf = mxValid ? (person.confidence >= 85 ? 80 : person.confidence >= 70 ? 65 : 48) : 22;
      const lead = {
        sessionId, email, name: person.full, company: guessCompany(domain), domain,
        sourceUrl: null, method: "generated", mxValid,
        confidence: Math.min(94, baseConf + pat.weight * 2), pattern: pat.id,
      };
      captured.set(email, lead);
      await db.insert(leads).values(lead).onConflictDoNothing();
      sseWrite(res, "lead", { ...lead });
      generated++;
      if (generated % 30 === 0) sseWrite(res, "log", { message: `  → ${captured.size} TOTAL LEADS...`, level: "trace" });
    }
  }

  const directCount = [...captured.values()].filter(l => l.method === "found").length;
  const genCount = [...captured.values()].filter(l => l.method === "generated").length;

  sseWrite(res, "log", { message: `> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, level: "info" });
  sseWrite(res, "log", { message: `> ADVANCED_FINDER COMPLETE`, level: "success" });
  sseWrite(res, "log", { message: `> DIRECT/FOUND: ${directCount} · GENERATED: ${genCount} · TOTAL: ${captured.size}`, level: "success" });
  sseWrite(res, "done", { total: captured.size, sessionId });
  res.end();
});

// ─── Support Routes ───────────────────────────────────────────────────────────

router.get("/leads/sessions", async (req, res) => {
  const rows = await db.select().from(leads).orderBy(leads.createdAt);
  const bySession: Record<string, any[]> = {};
  for (const row of rows) {
    if (!bySession[row.sessionId]) bySession[row.sessionId] = [];
    bySession[row.sessionId].push(row);
  }
  const sessions = Object.entries(bySession).map(([sessionId, items]) => ({
    sessionId, count: items.length,
    verified: items.filter(i => i.mxValid).length,
    createdAt: items[0].createdAt,
    sample: items.slice(0, 3).map(i => i.email),
  }));
  res.json({ sessions: sessions.reverse() });
});

router.get("/leads/list", async (req, res) => {
  const { sessionId } = req.query;
  const rows = sessionId
    ? await db.select().from(leads).where(eq(leads.sessionId, String(sessionId)))
    : await db.select().from(leads).orderBy(leads.createdAt);
  res.json({ leads: rows });
});

router.post("/leads/import", async (req, res) => {
  const rows = await db.select().from(leads).where(eq(leads.sessionId, req.body.sessionId ?? ""));
  const ids = req.body.ids as number[] | undefined;
  const toImport = ids ? rows.filter(r => ids.includes(r.id)) : rows;
  const { contacts } = await import("@workspace/db");
  let imported = 0;
  for (const lead of toImport) {
    try {
      await db.insert(contacts).values({
        email: lead.email, name: lead.name ?? lead.email.split("@")[0],
        company: lead.company, tags: JSON.stringify(["scraped"]),
      }).onConflictDoNothing();
      await db.update(leads).set({ importedAt: new Date() }).where(eq(leads.id, lead.id));
      imported++;
    } catch { /* skip dupes */ }
  }
  res.json({ imported, total: toImport.length });
});

router.delete("/leads/session/:sessionId", async (req, res) => {
  await db.delete(leads).where(eq(leads.sessionId, req.params.sessionId));
  res.json({ ok: true });
});

export default router;

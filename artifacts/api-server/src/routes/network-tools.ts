import { Router, type IRouter } from "express";
import * as net from "net";
import * as dns from "dns/promises";

const router: IRouter = Router();

const SCAN_TIMEOUT_MS = 4000;

function scanPort(host: string, port: number, timeout = SCAN_TIMEOUT_MS): Promise<{
  port: number;
  open: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (open: boolean, error: string | null = null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, open, latencyMs: open ? Date.now() - start : null, error });
    };

    socket.setTimeout(timeout);
    socket.connect(port, host, () => finish(true));
    socket.on("timeout", () => finish(false, "TIMEOUT"));
    socket.on("error", (err: NodeJS.ErrnoException) => {
      const msg = err.code === "ECONNREFUSED" ? "REFUSED" :
                  err.code === "EHOSTUNREACH" ? "UNREACHABLE" :
                  err.code === "ENETUNREACH" ? "NET_UNREACHABLE" : err.code ?? "ERROR";
      finish(false, msg);
    });
  });
}

const SMTP_PORTS = [25, 465, 587, 2525];

const ENCRYPTION_FOR_PORT: Record<number, string> = {
  25: "starttls",
  465: "ssl",
  587: "starttls",
  2525: "starttls",
};

const KNOWN_PROVIDERS: Array<{
  pattern: RegExp;
  name: string;
  host: string;
  port: number;
  encryption: "none" | "ssl" | "tls" | "starttls";
  note: string;
}> = [
  { pattern: /gmail\.com|googlemail\.com/i,    name: "Google / Gmail",      host: "smtp.gmail.com",                                  port: 587, encryption: "starttls", note: "Use App Password if 2FA enabled" },
  { pattern: /google\.com/i,                   name: "Google Workspace",    host: "smtp.gmail.com",                                  port: 587, encryption: "starttls", note: "Admin must allow SMTP access" },
  { pattern: /outlook\.com|hotmail\.com|live\.com|msn\.com/i, name: "Microsoft Outlook", host: "smtp-mail.outlook.com",             port: 587, encryption: "starttls", note: "Enable SMTP in account settings" },
  { pattern: /office365\.com|microsoft\.com/i, name: "Microsoft 365",       host: "smtp.office365.com",                              port: 587, encryption: "starttls", note: "Admin consent may be required" },
  { pattern: /yahoo\.com|ymail\.com/i,         name: "Yahoo Mail",          host: "smtp.mail.yahoo.com",                             port: 587, encryption: "starttls", note: "Generate an App Password" },
  { pattern: /icloud\.com|me\.com|mac\.com/i,  name: "Apple iCloud",        host: "smtp.mail.me.com",                                port: 587, encryption: "starttls", note: "Use app-specific password" },
  { pattern: /zoho\.com/i,                     name: "Zoho Mail",           host: "smtp.zoho.com",                                   port: 587, encryption: "starttls", note: "Zoho One or Mail Plus required" },
  { pattern: /mailgun\.com|mailgun\.org/i,      name: "Mailgun",             host: "smtp.mailgun.org",                                port: 587, encryption: "starttls", note: "Use SMTP credentials from dashboard" },
  { pattern: /sendgrid\.com/i,                 name: "SendGrid",            host: "smtp.sendgrid.net",                               port: 587, encryption: "starttls", note: "Username is 'apikey', password is your API key" },
  { pattern: /postmark(app)?\.com/i,           name: "Postmark",            host: "smtp.postmarkapp.com",                            port: 587, encryption: "starttls", note: "Server API token as password" },
  { pattern: /ses\.|amazonaws\.com/i,          name: "Amazon SES",          host: "email-smtp.us-east-1.amazonaws.com",              port: 587, encryption: "starttls", note: "Verify domain + email first in AWS console" },
  { pattern: /sendinblue\.com|brevo\.com/i,    name: "Brevo (Sendinblue)",  host: "smtp-relay.brevo.com",                            port: 587, encryption: "starttls", note: "Use SMTP key from your account" },
  { pattern: /godaddy\.com|secureserver\.net/i,name: "GoDaddy",             host: "smtpout.secureserver.net",                        port: 465, encryption: "ssl",      note: "Use your email address as username" },
  { pattern: /namecheap\.com/i,                name: "Namecheap Private",   host: "mail.privateemail.com",                           port: 587, encryption: "starttls", note: "Private Email hosting" },
  { pattern: /protonmail\.com|proton\.me/i,    name: "ProtonMail Bridge",   host: "127.0.0.1",                                       port: 1025, encryption: "starttls", note: "Requires ProtonMail Bridge app running locally" },
  { pattern: /fastmail\.(com|fm)/i,            name: "Fastmail",            host: "smtp.fastmail.com",                               port: 587, encryption: "starttls", note: "Use app password for SMTP" },
];

router.post("/network/scan-ports", async (req, res) => {
  const { host, ports = SMTP_PORTS } = req.body;

  if (!host || typeof host !== "string") {
    return res.status(400).json({ error: "HOST_REQUIRED" });
  }

  req.log.info({ host, ports }, "Starting port scan");

  try {
    const results = await Promise.all(
      (ports as number[]).map((port) => scanPort(host.trim(), port))
    );

    const openPorts = results.filter((r) => r.open);
    const recommendation = openPorts.length > 0
      ? openPorts.sort((a, b) => {
          const preferred = [587, 465, 2525, 25];
          return preferred.indexOf(a.port) - preferred.indexOf(b.port);
        })[0]
      : null;

    res.json({
      host,
      results,
      openCount: openPorts.length,
      recommendation: recommendation ? {
        port: recommendation.port,
        latencyMs: recommendation.latencyMs,
        encryption: ENCRYPTION_FOR_PORT[recommendation.port] ?? "starttls",
        reason: `Port ${recommendation.port} responded in ${recommendation.latencyMs}ms`,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "Port scan failed");
    res.status(500).json({ error: "SCAN_FAILED" });
  }
});

router.post("/network/auto-detect-smtp", async (req, res) => {
  const { domain } = req.body;

  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "DOMAIN_REQUIRED" });
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");
  req.log.info({ domain: cleanDomain }, "Auto-detecting SMTP for domain");

  let mxRecords: dns.MxRecord[] = [];
  let mxHost = "";
  let dnsError: string | null = null;

  try {
    mxRecords = await dns.resolveMx(cleanDomain);
    mxRecords.sort((a, b) => a.priority - b.priority);
    mxHost = mxRecords[0]?.exchange ?? "";
  } catch (err: any) {
    dnsError = err.code ?? "DNS_LOOKUP_FAILED";
  }

  const providerMatch = KNOWN_PROVIDERS.find((p) =>
    p.pattern.test(cleanDomain) || (mxHost && p.pattern.test(mxHost))
  );

  let genericSuggestion = null;
  if (!providerMatch) {
    genericSuggestion = {
      name: `Custom (${cleanDomain})`,
      host: `mail.${cleanDomain}`,
      port: 587,
      encryption: "starttls" as const,
      note: "Generic fallback — scan ports to confirm which are open",
    };
  }

  const suggestion = providerMatch ?? genericSuggestion!;

  const portScanResults = await Promise.all(
    SMTP_PORTS.map((p) => scanPort(suggestion.host, p, 1500))
  );

  const openPort = portScanResults
    .filter((r) => r.open)
    .sort((a, b) => [587, 465, 2525, 25].indexOf(a.port) - [587, 465, 2525, 25].indexOf(b.port))[0];

  if (openPort && openPort.port !== suggestion.port) {
    suggestion.port = openPort.port;
    suggestion.encryption = ENCRYPTION_FOR_PORT[openPort.port] as any ?? suggestion.encryption;
  }

  const allBlocked = portScanResults.every((r) => !r.open);
  const allTimedOut = portScanResults.every((r) => !r.open && r.error === "TIMEOUT");

  res.json({
    domain: cleanDomain,
    mxRecords: mxRecords.map((mx) => ({ host: mx.exchange, priority: mx.priority })),
    mxHost,
    dnsError,
    provider: providerMatch ? { name: providerMatch.name, note: providerMatch.note } : null,
    suggestion: {
      host: suggestion.host,
      port: suggestion.port,
      encryption: suggestion.encryption,
      note: suggestion.note,
    },
    portScan: portScanResults,
    allBlocked,
    allTimedOut,
  });
});

router.get("/network/info", async (req, res) => {
  const referenceHost = "smtp.gmail.com";

  const [port25, port465, port587, port2525] = await Promise.all([
    scanPort(referenceHost, 25, 4000),
    scanPort(referenceHost, 465, 4000),
    scanPort(referenceHost, 587, 4000),
    scanPort(referenceHost, 2525, 4000),
  ]);

  let externalIp = "UNKNOWN";
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    const ipData = await ipRes.json() as { ip?: string };
    externalIp = ipData.ip ?? "UNKNOWN";
  } catch {
    externalIp = "DETECTION_FAILED";
  }

  const port25Blocked = !port25.open;
  const hasUsablePorts = port465.open || port587.open || port2525.open;

  res.json({
    externalIp,
    ports: {
      25: { ...port25, label: "SMTP (legacy)", blocked: port25Blocked },
      465: { ...port465, label: "SMTPS (SSL)", blocked: !port465.open },
      587: { ...port587, label: "SUBMISSION (STARTTLS)", blocked: !port587.open },
      2525: { ...port2525, label: "ALTERNATE", blocked: !port2525.open },
    },
    port25Blocked,
    hasUsablePorts,
    recommendation: !hasUsablePorts
      ? "ALL_PORTS_BLOCKED — check firewall or use a relay service"
      : port25Blocked
        ? "PORT_25_BLOCKED — use 587 (STARTTLS) or 465 (SSL/SMTPS)"
        : "PORT_25_AVAILABLE — direct SMTP sending possible",
    isp: port25Blocked ? "ISP/HOST_BLOCKS_PORT_25" : "PORT_25_UNRESTRICTED",
  });
});

export default router;

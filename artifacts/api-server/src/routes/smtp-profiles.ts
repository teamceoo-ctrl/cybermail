import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { smtpProfilesTable, insertSmtpProfileSchema } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const sanitizeProfile = (p: typeof smtpProfilesTable.$inferSelect) => ({
  id: p.id,
  name: p.name,
  host: p.host,
  port: p.port,
  encryption: p.encryption,
  username: p.username,
  fromName: p.fromName,
  fromEmail: p.fromEmail,
  dailyLimit: p.dailyLimit,
  hourlyLimit: p.hourlyLimit,
  status: p.status,
  isDefault: p.isDefault,
  socks5Enabled: p.socks5Enabled,
  socks5Host: p.socks5Host,
  socks5Port: p.socks5Port,
  createdAt: p.createdAt.toISOString(),
});

function buildTransport(profile: typeof smtpProfilesTable.$inferSelect, opts?: { fast?: boolean }) {
  const enc = profile.encryption;
  const isSSL = enc === "ssl" || enc === "tls";
  const isSTARTTLS = enc === "starttls";
  const timeout = opts?.fast ? 8000 : 15000;

  return nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: isSSL,
    requireTLS: isSTARTTLS,
    auth: {
      user: profile.username,
      pass: profile.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: opts?.fast ? 7000 : 10000,
    greetingTimeout: opts?.fast ? 5000 : 8000,
    socketTimeout: timeout,
  });
}

function classifySmtpError(err: any): { code: string; detail: string } {
  const msg: string = (err?.message ?? "").toLowerCase();
  const code: string = err?.code ?? "";

  if (code === "ETIMEDOUT" || code === "ESOCKET" || msg.includes("timeout")) {
    return {
      code: "TIMEOUT",
      detail: `Connection to ${err?.address ?? "server"} timed out — the port may be blocked by your hosting provider's firewall. Try a different port or use a SOCKS5 proxy.`,
    };
  }
  if (code === "ECONNREFUSED") {
    return {
      code: "REFUSED",
      detail: "Connection refused — check that the hostname and port are correct.",
    };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      code: "DNS_FAIL",
      detail: "Hostname could not be resolved — check the SMTP host address.",
    };
  }
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return {
      code: "UNREACHABLE",
      detail: "Host is unreachable — the network path is blocked or the server is down.",
    };
  }
  if (msg.includes("invalid login") || msg.includes("authentication") || msg.includes("535") || msg.includes("534")) {
    return {
      code: "AUTH_FAIL",
      detail: "Authentication failed — check your username and password.",
    };
  }
  if (msg.includes("starttls") || msg.includes("must issue a starttls")) {
    return {
      code: "TLS_REQUIRED",
      detail: "Server requires STARTTLS — set encryption to STARTTLS.",
    };
  }
  if (msg.includes("certificate") || msg.includes("self signed")) {
    return {
      code: "CERT_ERROR",
      detail: "TLS certificate error — the server certificate may be self-signed or expired.",
    };
  }
  return {
    code: "SMTP_ERROR",
    detail: err?.message ?? "Unknown SMTP error",
  };
}

router.get("/smtp-profiles", async (req, res) => {
  try {
    const profiles = await db.select().from(smtpProfilesTable).orderBy(desc(smtpProfilesTable.createdAt));
    res.json(profiles.map(sanitizeProfile));
  } catch (err) {
    req.log.error({ err }, "Error listing SMTP profiles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/smtp-profiles", async (req, res) => {
  try {
    const data = insertSmtpProfileSchema.parse(req.body);
    if (data.isDefault) {
      await db.update(smtpProfilesTable).set({ isDefault: false });
    }
    const [profile] = await db.insert(smtpProfilesTable).values(data).returning();
    res.status(201).json(sanitizeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Error creating SMTP profile");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/smtp-profiles/:id", async (req, res) => {
  try {
    if (req.body.isDefault) {
      await db.update(smtpProfilesTable).set({ isDefault: false });
    }
    const [profile] = await db
      .update(smtpProfilesTable)
      .set(req.body)
      .where(eq(smtpProfilesTable.id, Number(req.params.id)))
      .returning();
    if (!profile) return res.status(404).json({ error: "SMTP profile not found" });
    res.json(sanitizeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Error updating SMTP profile");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/smtp-profiles/:id", async (req, res) => {
  try {
    await db.delete(smtpProfilesTable).where(eq(smtpProfilesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting SMTP profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/smtp-profiles/:id/verify", async (req, res) => {
  try {
    const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, Number(req.params.id)));
    if (!profile) return res.status(404).json({ error: "SMTP profile not found" });

    const startTime = Date.now();

    let portOpen = false;
    let portError: string | null = null;
    try {
      const { createConnection } = await import("net");
      await new Promise<void>((resolve, reject) => {
        const sock = createConnection({ host: profile.host, port: profile.port });
        const timer = setTimeout(() => { sock.destroy(); reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })); }, 5000);
        sock.once("connect", () => { clearTimeout(timer); sock.destroy(); portOpen = true; resolve(); });
        sock.once("error", (e) => { clearTimeout(timer); reject(e); });
      });
    } catch (tcpErr: any) {
      portError = classifySmtpError(tcpErr).code;
    }

    if (!portOpen) {
      const latencyMs = Date.now() - startTime;
      await db.update(smtpProfilesTable).set({ status: "failed" }).where(eq(smtpProfilesTable.id, profile.id));
      const hint = portError === "TIMEOUT"
        ? `Port ${profile.port} is not reachable from this server — it may be blocked by a firewall. Try a different port (e.g. 587 or 465) or configure a SOCKS5 proxy.`
        : portError === "REFUSED"
        ? `Connection to ${profile.host}:${profile.port} was refused — verify the hostname and port.`
        : portError === "DNS_FAIL"
        ? `Cannot resolve hostname "${profile.host}" — check the SMTP host setting.`
        : `TCP connection to ${profile.host}:${profile.port} failed (${portError}).`;
      return res.json({ success: false, errorCode: portError ?? "TCP_FAIL", message: hint, latencyMs });
    }

    const transport = buildTransport(profile, { fast: true });
    try {
      await transport.verify();
      const latencyMs = Date.now() - startTime;
      await db.update(smtpProfilesTable).set({ status: "verified" }).where(eq(smtpProfilesTable.id, profile.id));
      transport.close();
      res.json({
        success: true,
        message: `Connected to ${profile.host}:${profile.port} — SMTP handshake OK.`,
        latencyMs,
      });
    } catch (smtpErr: any) {
      const latencyMs = Date.now() - startTime;
      const classified = classifySmtpError(smtpErr);
      await db.update(smtpProfilesTable).set({ status: "failed" }).where(eq(smtpProfilesTable.id, profile.id));
      transport.close();
      req.log.warn({ host: profile.host, port: profile.port, code: classified.code }, "SMTP verify failed");
      res.json({
        success: false,
        errorCode: classified.code,
        message: classified.detail,
        latencyMs,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Error verifying SMTP profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/smtp-profiles/:id/send-test", async (req, res) => {
  try {
    const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, Number(req.params.id)));
    if (!profile) return res.status(404).json({ error: "SMTP profile not found" });

    const { toEmail } = req.body as { toEmail: string };
    if (!toEmail) return res.status(400).json({ error: "toEmail is required" });

    const transport = buildTransport(profile);

    const info = await transport.sendMail({
      from: `"${profile.fromName}" <${profile.fromEmail}>`,
      to: toEmail,
      subject: `[TEST] SMTP Connection Test — ${profile.name}`,
      text: `This is a live test email sent from your CyberMail SMTP profile "${profile.name}" (${profile.host}:${profile.port}).\n\nIf you receive this, your SMTP relay is configured correctly and mail delivery is working.\n\n— CyberMail Platform`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:monospace;background:#0a0f0a;color:#00ff41;padding:32px;max-width:560px;margin:0 auto;">
  <h2 style="color:#00ff41;letter-spacing:2px;border-bottom:1px solid #00ff41;padding-bottom:12px;">&#x25b6; SMTP TEST EMAIL</h2>
  <p style="color:#aaa;">This is a <strong style="color:#00ff41;">live test email</strong> sent from your CyberMail SMTP profile.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <tr><td style="color:#666;padding:6px 0;">Profile</td><td style="color:#00ff41;">${profile.name}</td></tr>
    <tr><td style="color:#666;padding:6px 0;">Host</td><td style="color:#00ff41;">${profile.host}:${profile.port}</td></tr>
    <tr><td style="color:#666;padding:6px 0;">From</td><td style="color:#00ff41;">${profile.fromEmail}</td></tr>
    <tr><td style="color:#666;padding:6px 0;">Encryption</td><td style="color:#00ff41;">${profile.encryption.toUpperCase()}</td></tr>
  </table>
  <p style="color:#aaa;">If you received this, your relay is <strong style="color:#00ff41;">fully operational</strong>.</p>
  <p style="color:#555;font-size:12px;margin-top:32px;border-top:1px solid #222;padding-top:12px;">Sent by CyberMail Platform</p>
</body>
</html>`,
    });

    transport.close();

    res.json({
      success: true,
      message: `Test email delivered to ${toEmail}`,
      messageId: info.messageId,
    });
  } catch (err: any) {
    req.log.error({ err }, "Error sending test email via SMTP profile");
    res.status(500).json({ error: err?.message ?? "Failed to send test email" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { analyzeDeliverability } from "../lib/deliverability.js";
import { db } from "@workspace/db";
import { smtpProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

router.post("/analyze/deliverability", async (req, res) => {
  try {
    const { fromName, fromEmail, subject, htmlContent, replyTo } = req.body as {
      fromName?: string;
      fromEmail?: string;
      subject?: string;
      htmlContent?: string;
      replyTo?: string;
    };

    if (!subject && !htmlContent) {
      return res.status(400).json({ error: "Provide at least a subject or htmlContent to analyze" });
    }

    const report = analyzeDeliverability({
      fromName: fromName ?? "",
      fromEmail: fromEmail ?? "",
      subject: subject ?? "",
      htmlContent: htmlContent ?? "",
      replyTo,
    });

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Error analyzing deliverability");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/analyze/send-test", async (req, res) => {
  try {
    const { smtpProfileId, toEmail, fromName, fromEmail, subject, htmlContent, replyTo } = req.body as {
      smtpProfileId?: number;
      toEmail?: string;
      fromName?: string;
      fromEmail?: string;
      subject?: string;
      htmlContent?: string;
      replyTo?: string;
    };

    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ error: "Valid recipient email is required" });
    }
    if (!subject && !htmlContent) {
      return res.status(400).json({ error: "Email must have a subject or body to send" });
    }

    let profile: typeof smtpProfilesTable.$inferSelect | undefined;

    if (smtpProfileId) {
      const [found] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, smtpProfileId)).limit(1);
      profile = found;
    } else {
      const [def] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.isDefault, true)).limit(1);
      if (!def) {
        const [any] = await db.select().from(smtpProfilesTable).limit(1);
        profile = any;
      } else {
        profile = def;
      }
    }

    if (!profile) {
      return res.status(400).json({ error: "No SMTP profile found. Add an SMTP profile first." });
    }

    const transport = nodemailer.createTransport({
      host: profile.host,
      port: profile.port,
      secure: profile.encryption === "ssl",
      requireTLS: profile.encryption === "starttls",
      auth: { user: profile.username, pass: profile.password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    const senderEmail = fromEmail || profile.fromEmail;
    const senderName = fromName || profile.fromName;

    await transport.sendMail({
      from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
      to: toEmail,
      subject: subject || "(No subject — inbox tester)",
      html: htmlContent || "<p>Test email from CyberMail Inbox Tester</p>",
      ...(replyTo ? { replyTo } : {}),
    });

    res.json({ success: true, sentVia: profile.name, to: toEmail });
  } catch (err: any) {
    req.log.error({ err }, "Error sending test email");
    res.status(500).json({ error: err?.message ?? "Failed to send test email" });
  }
});

export default router;

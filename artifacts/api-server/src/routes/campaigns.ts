import { Router, type IRouter, type Request, type Response } from "express";
import { EventEmitter } from "events";
import { db } from "@workspace/db";
import {
  campaignsTable, insertCampaignSchema, smtpProfilesTable, templatesTable,
  contactsTable, segmentsTable, suppressionListTable
} from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { resolveVars } from "../lib/template-vars";

const router: IRouter = Router();

const campaignEmitters = new Map<number, EventEmitter>();

function getEmitter(id: number): EventEmitter {
  if (!campaignEmitters.has(id)) {
    const em = new EventEmitter();
    em.setMaxListeners(50);
    campaignEmitters.set(id, em);
  }
  return campaignEmitters.get(id)!;
}

function emitEvent(campaignId: number, type: string, payload: Record<string, unknown>) {
  const emitter = campaignEmitters.get(campaignId);
  if (emitter) emitter.emit("event", { type, ...payload, ts: Date.now() });
}

const serializeCampaign = (c: typeof campaignsTable.$inferSelect) => ({
  ...c,
  scheduledAt: c.scheduledAt?.toISOString() ?? null,
  sentAt: c.sentAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

function buildTransport(profile: typeof smtpProfilesTable.$inferSelect) {
  return nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.encryption === "ssl",
    requireTLS: profile.encryption === "starttls",
    auth: { user: profile.username, pass: profile.password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    socketTimeout: 15000,
    pool: true,
    maxConnections: 5,
    maxMessages: Infinity,
  } as any);
}

async function getContactsForCampaign(
  segmentId: number | null,
  tagFilter?: string | null,
) {
  let contacts = await db.select().from(contactsTable).where(eq(contactsTable.status, "active"));

  if (tagFilter) {
    contacts = contacts.filter(c => (c.tags ?? []).includes(tagFilter));
  } else if (segmentId && segmentId !== 0) {
    const [segment] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, segmentId));
    if (segment) {
      const criteria = segment.criteria as Record<string, unknown> ?? {};
      if (criteria.tag) {
        contacts = contacts.filter(c => (c.tags ?? []).includes(criteria.tag as string));
      }
    }
  }

  return contacts;
}

async function filterSuppressed(contacts: typeof contactsTable.$inferSelect[]) {
  const suppressions = await db.select().from(suppressionListTable);
  const suppressedEmails = new Set(suppressions.filter(s => s.type === "email").map(s => s.value.toLowerCase()));
  const suppressedDomains = new Set(suppressions.filter(s => s.type === "domain").map(s => s.value.toLowerCase()));
  return contacts.filter(c => {
    const email = c.email.toLowerCase();
    const domain = email.split("@")[1] ?? "";
    return !suppressedEmails.has(email) && !suppressedDomains.has(domain);
  });
}

router.get("/campaigns", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    let query = db.select().from(campaignsTable);
    if (status) {
      query = query.where(eq(campaignsTable.status, status as any)) as typeof query;
    }
    const campaigns = await query.orderBy(desc(campaignsTable.createdAt));
    res.json(campaigns.map(serializeCampaign));
  } catch (err) {
    req.log.error({ err }, "Error listing campaigns");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const data = insertCampaignSchema.parse(req.body);
    const [campaign] = await db.insert(campaignsTable).values(data).returning();
    res.status(201).json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Error creating campaign");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Error getting campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  try {
    const [campaign] = await db
      .update(campaignsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(campaignsTable.id, Number(req.params.id)))
      .returning();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Error updating campaign");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    await db.delete(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/campaigns/:id/events", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emitter = getEmitter(id);

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === "function") (res as any).flush();
  };

  send({ type: "connected", campaignId: id });

  const handler = (event: Record<string, unknown>) => { send(event); };
  emitter.on("event", handler);

  req.on("close", () => { emitter.off("event", handler); });
});

router.post("/campaigns/:id/preview-render", async (req, res) => {
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    let htmlTemplate = `<p>Hello {{first_name}},</p><p>${campaign.subject}</p>`;
    let subjectTemplate = campaign.subject;

    if (campaign.templateId) {
      const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, campaign.templateId));
      if (template?.htmlContent) htmlTemplate = template.htmlContent;
      if (template?.subject) subjectTemplate = template.subject || subjectTemplate;
    }

    const sampleContact = req.body?.contact ?? {};
    const vars = {
      first_name: sampleContact.firstName ?? "Alex",
      last_name: sampleContact.lastName ?? "Johnson",
      email: sampleContact.email ?? "alex.johnson@example.com",
      company: sampleContact.company ?? "Acme Corp",
      full_name: [sampleContact.firstName, sampleContact.lastName].filter(Boolean).join(" ") || "Alex Johnson",
      unsubscribe_url: `https://${campaign.fromEmail.split("@")[1] ?? "example.com"}/unsubscribe?preview=1`,
    };

    const html = resolveVars(htmlTemplate, vars);
    const subject = resolveVars(subjectTemplate, vars);

    res.json({ html, subject, fromName: campaign.fromName, fromEmail: campaign.fromEmail });
  } catch (err: any) {
    req.log.error({ err }, "Error rendering preview");
    res.status(500).json({ error: err?.message ?? "Preview failed" });
  }
});

router.post("/campaigns/:id/launch", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
      return res.status(400).json({ error: `Campaign is "${campaign.status}" — can only launch draft, scheduled, or paused campaigns` });
    }

    if (!campaign.smtpProfileId && !(campaign.roundRobinSmtpIds?.length)) {
      return res.status(400).json({ error: "No SMTP profile selected. Assign one before launching." });
    }

    const allSmtpIds: number[] = campaign.roundRobinSmtpIds?.length
      ? campaign.roundRobinSmtpIds.map(Number)
      : [campaign.smtpProfileId!];

    const profiles = await Promise.all(
      allSmtpIds.map(pid => db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, pid)).then(r => r[0]))
    );
    const validProfiles = profiles.filter(Boolean) as typeof smtpProfilesTable.$inferSelect[];
    if (validProfiles.length === 0) return res.status(404).json({ error: "SMTP profile(s) not found" });

    let htmlTemplate = `<p>Hello {{first_name}},</p><p>${campaign.subject}</p>`;
    let subjectTemplate = campaign.subject;
    let subjectVariant = campaign.abSubjectVariant ?? null;

    if (campaign.templateId) {
      const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, campaign.templateId));
      if (template?.htmlContent) htmlTemplate = template.htmlContent;
      if (template?.subject) subjectTemplate = template.subject || subjectTemplate;
    }

    let contacts = await getContactsForCampaign(campaign.segmentId, campaign.tagFilter);
    contacts = await filterSuppressed(contacts);

    if (contacts.length === 0) {
      return res.status(400).json({ error: "No eligible contacts (after suppression filter). Import contacts or check your suppression list." });
    }

    let abSplitPoint = contacts.length;
    const splitPct = campaign.abSplitPercent;
    if (subjectVariant && splitPct && splitPct > 0 && splitPct < 100) {
      abSplitPoint = Math.floor(contacts.length * (splitPct / 100));
    }

    await db.update(campaignsTable).set({
      status: "sending",
      totalRecipients: contacts.length,
      sentAt: new Date(),
      sent: 0,
      delivered: 0,
      bounced: 0,
      updatedAt: new Date(),
    }).where(eq(campaignsTable.id, id));

    res.json({
      success: true,
      message: `Broadcast launched to ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`,
      totalRecipients: contacts.length,
      roundRobin: validProfiles.length > 1,
      abTest: !!subjectVariant,
      suppressedFiltered: true,
    });

    setImmediate(async () => {
      const transports = validProfiles.map(p => buildTransport(p));
      let sent = 0;
      let delivered = 0;
      let bounced = 0;
      let pauseChecks = 0;
      let paused = false;

      emitEvent(id, "start", { total: contacts.length, profileName: validProfiles.map(p => p.name).join(", ") });

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        if (paused) break;

        pauseChecks++;
        if (pauseChecks % 10 === 0) {
          const [fresh] = await db.select({ status: campaignsTable.status }).from(campaignsTable).where(eq(campaignsTable.id, id));
          if (fresh?.status === "paused") { paused = true; break; }
        }

        const useVariant = subjectVariant && i >= abSplitPoint;
        const activeSubject = useVariant ? subjectVariant! : subjectTemplate;

        const vars = {
          first_name: contact.firstName ?? "",
          last_name: contact.lastName ?? "",
          email: contact.email,
          company: contact.company ?? "",
          full_name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
          unsubscribe_url: `https://${campaign.fromEmail.split("@")[1] ?? "example.com"}/unsubscribe?cid=${id}&uid=${Buffer.from(contact.email).toString("base64url")}`,
        };

        const html = resolveVars(htmlTemplate, vars);
        const subject = resolveVars(activeSubject, vars);
        const fromName = resolveVars(campaign.fromName, vars);
        const fromEmail = resolveVars(campaign.fromEmail, vars);
        const sendingDomain = fromEmail.split("@")[1] ?? "mail.example.com";
        const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}.${id}@${sendingDomain}>`;
        const unsubMailto = `<mailto:unsubscribe@${sendingDomain}?subject=unsubscribe>`;
        const unsubHttp = `<${vars.unsubscribe_url}>`;

        const transport = transports[i % transports.length];

        try {
          await transport.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: contact.email,
            replyTo: `"${fromName}" <${fromEmail}>`,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
            headers: {
              "Message-ID": msgId,
              "MIME-Version": "1.0",
              "Precedence": "bulk",
              "X-Mailer": "CyberMail/2.0",
              "X-Campaign-ID": String(id),
              "X-Priority": "3",
              "List-Unsubscribe": `${unsubHttp}, ${unsubMailto}`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });

          sent++;
          delivered++;

          emitEvent(id, "sent", {
            email: contact.email,
            name: vars.full_name || contact.email,
            subject,
            sent,
            delivered,
            bounced,
            total: contacts.length,
            variant: useVariant ? "B" : "A",
          });
        } catch (sendErr: any) {
          sent++;
          bounced++;

          emitEvent(id, "bounced", {
            email: contact.email,
            name: vars.full_name || contact.email,
            error: sendErr?.message ?? "Send failed",
            sent,
            delivered,
            bounced,
            total: contacts.length,
          });
        }

        if (sent % 5 === 0 || sent === contacts.length) {
          await db.update(campaignsTable).set({ sent, delivered, bounced, updatedAt: new Date() })
            .where(eq(campaignsTable.id, id)).catch(() => {});
        }
      }

      for (const t of transports) t.close();

      const finalStatus = paused ? "paused" : "sent";
      await db.update(campaignsTable).set({ status: finalStatus, sent, delivered, bounced, updatedAt: new Date() })
        .where(eq(campaignsTable.id, id)).catch(() => {});

      emitEvent(id, "complete", { status: finalStatus, sent, delivered, bounced, total: contacts.length });

      setTimeout(() => { campaignEmitters.delete(id); }, 60000);
    });

  } catch (err: any) {
    req.log.error({ err }, "Error launching campaign");
    await db.update(campaignsTable).set({ status: "failed", updatedAt: new Date() })
      .where(eq(campaignsTable.id, id)).catch(() => {});
    if (!res.headersSent) res.status(500).json({ error: err?.message ?? "Launch failed" });
  }
});

router.post("/campaigns/:id/send-test", async (req, res) => {
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const { toEmail } = req.body as { toEmail: string };
    if (!toEmail) return res.status(400).json({ error: "toEmail is required" });

    if (!campaign.smtpProfileId) {
      return res.status(400).json({ error: "No SMTP profile assigned. Add one before sending." });
    }

    const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, campaign.smtpProfileId));
    if (!profile) return res.status(404).json({ error: "SMTP profile not found" });

    let htmlTemplate = `<p>Hello {{first_name}},</p><p>This is a test send for <strong>${campaign.name}</strong>.</p>`;
    let subjectTemplate = campaign.subject;

    if (campaign.templateId) {
      const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, campaign.templateId));
      if (template?.htmlContent) htmlTemplate = template.htmlContent;
      if (template?.subject) subjectTemplate = template.subject || subjectTemplate;
    }

    const vars = {
      first_name: "Test",
      last_name: "Recipient",
      email: toEmail,
      company: "Test Company",
      full_name: "Test Recipient",
      job_title: "Marketing Director",
      phone: "(555) 867-5309",
      city: "New York",
      state: "NY",
      unsubscribe_url: `https://${campaign.fromEmail.split("@")[1] ?? "example.com"}/unsubscribe?test=1`,
    };

    const html = resolveVars(htmlTemplate, vars);
    const subject = resolveVars(`[TEST] ${subjectTemplate}`, vars);
    const fromName = resolveVars(campaign.fromName, vars);
    const fromEmail = resolveVars(campaign.fromEmail, vars);
    const sendingDomain = fromEmail.split("@")[1] ?? "mail.example.com";
    const msgId = `<test.${Date.now()}.${Math.random().toString(36).slice(2)}@${sendingDomain}>`;

    const transport = buildTransport(profile);
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      replyTo: `"${fromName}" <${fromEmail}>`,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      headers: {
        "Message-ID": msgId,
        "MIME-Version": "1.0",
        "Precedence": "bulk",
        "X-Mailer": "CyberMail/2.0",
        "X-Campaign-ID": String(campaign.id),
        "X-Priority": "3",
        "List-Unsubscribe": `<${vars.unsubscribe_url}>, <mailto:unsubscribe@${sendingDomain}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    transport.close();

    res.json({ success: true, message: `Test sent to ${toEmail} via ${profile.name}`, messageId: info.messageId });
  } catch (err: any) {
    req.log.error({ err }, "Error sending test email");
    res.status(500).json({ error: err?.message ?? "Failed to send test email" });
  }
});

router.post("/campaigns/:id/pause", async (req, res) => {
  try {
    const [campaign] = await db.update(campaignsTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(campaignsTable.id, Number(req.params.id))).returning();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    emitEvent(Number(req.params.id), "paused", {});
    res.json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Error pausing campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns/:id/resume", async (req, res) => {
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status !== "paused") return res.status(400).json({ error: "Campaign is not paused" });

    const allSmtpIds: number[] = campaign.roundRobinSmtpIds?.length
      ? campaign.roundRobinSmtpIds.map(Number)
      : campaign.smtpProfileId ? [campaign.smtpProfileId] : [];

    if (allSmtpIds.length === 0) return res.status(400).json({ error: "No SMTP profile configured" });

    const profiles = await Promise.all(
      allSmtpIds.map(pid => db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, pid)).then(r => r[0]))
    );
    const validProfiles = profiles.filter(Boolean) as typeof smtpProfilesTable.$inferSelect[];
    if (validProfiles.length === 0) return res.status(404).json({ error: "SMTP profile not found" });

    let htmlTemplate = `<p>Hello {{first_name}},</p><p>${campaign.subject}</p>`;
    let subjectTemplate = campaign.subject;
    if (campaign.templateId) {
      const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, campaign.templateId));
      if (template?.htmlContent) htmlTemplate = template.htmlContent;
      if (template?.subject) subjectTemplate = template.subject || subjectTemplate;
    }

    let contacts = await getContactsForCampaign(campaign.segmentId, campaign.tagFilter);
    contacts = await filterSuppressed(contacts);
    const remaining = contacts.slice(campaign.sent ?? 0);

    const [updated] = await db.update(campaignsTable)
      .set({ status: "sending", updatedAt: new Date() })
      .where(eq(campaignsTable.id, campaign.id)).returning();
    res.json(serializeCampaign(updated));

    setImmediate(async () => {
      const transports = validProfiles.map(p => buildTransport(p));
      let sent = campaign.sent ?? 0;
      let delivered = campaign.delivered ?? 0;
      let bounced = campaign.bounced ?? 0;
      let pauseChecks = 0;
      let paused = false;

      emitEvent(campaign.id, "start", { total: contacts.length, profileName: validProfiles.map(p => p.name).join(", "), resumed: true });

      for (let i = 0; i < remaining.length; i++) {
        const contact = remaining[i];
        if (paused) break;
        pauseChecks++;
        if (pauseChecks % 10 === 0) {
          const [fresh] = await db.select({ status: campaignsTable.status }).from(campaignsTable).where(eq(campaignsTable.id, campaign.id));
          if (fresh?.status === "paused") { paused = true; break; }
        }

        const vars = {
          first_name: contact.firstName ?? "",
          last_name: contact.lastName ?? "",
          email: contact.email,
          company: contact.company ?? "",
          full_name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
          unsubscribe_url: `https://${campaign.fromEmail.split("@")[1] ?? "example.com"}/unsubscribe?cid=${campaign.id}&uid=${Buffer.from(contact.email).toString("base64url")}`,
        };

        const html = resolveVars(htmlTemplate, vars);
        const subject = resolveVars(subjectTemplate, vars);
        const fromName = resolveVars(campaign.fromName, vars);
        const fromEmail = resolveVars(campaign.fromEmail, vars);
        const sendingDomain = fromEmail.split("@")[1] ?? "mail.example.com";

        const transport = transports[i % transports.length];

        try {
          await transport.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: contact.email,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
          });
          sent++; delivered++;
          emitEvent(campaign.id, "sent", { email: contact.email, sent, delivered, bounced, total: contacts.length });
        } catch {
          sent++; bounced++;
          emitEvent(campaign.id, "bounced", { email: contact.email, sent, delivered, bounced, total: contacts.length });
        }

        if (sent % 5 === 0) {
          await db.update(campaignsTable).set({ sent, delivered, bounced, updatedAt: new Date() })
            .where(eq(campaignsTable.id, campaign.id)).catch(() => {});
        }
      }

      for (const t of transports) t.close();
      const finalStatus = paused ? "paused" : "sent";
      await db.update(campaignsTable).set({ status: finalStatus, sent, delivered, bounced, updatedAt: new Date() })
        .where(eq(campaignsTable.id, campaign.id)).catch(() => {});
      emitEvent(campaign.id, "complete", { status: finalStatus, sent, delivered, bounced, total: contacts.length });
      setTimeout(() => { campaignEmitters.delete(campaign.id); }, 60000);
    });
  } catch (err) {
    req.log.error({ err }, "Error resuming campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function processScheduledCampaigns() {
  try {
    const now = new Date();
    const scheduled = await db.select().from(campaignsTable).where(eq(campaignsTable.status, "scheduled"));
    for (const campaign of scheduled) {
      if (!campaign.scheduledAt || campaign.scheduledAt > now) continue;
      await db.update(campaignsTable).set({ status: "draft", updatedAt: new Date() }).where(eq(campaignsTable.id, campaign.id));
    }
  } catch { /* ignore */ }
}

export default router;

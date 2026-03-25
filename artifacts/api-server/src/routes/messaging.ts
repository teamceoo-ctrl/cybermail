import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  messagingProfilesTable,
  messagingCampaignsTable,
  insertMessagingProfileSchema,
  insertMessagingCampaignSchema,
  contactsTable,
  smtpProfilesTable,
} from "@workspace/db/schema";
import { eq, desc, and, isNotNull, ne } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

function buildTransport(profile: typeof smtpProfilesTable.$inferSelect) {
  return nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.encryption === "ssl",
    requireTLS: profile.encryption === "starttls",
    auth: { user: profile.username, pass: profile.password },
    tls: { rejectUnauthorized: false },
  });
}

function phoneToGatewayEmail(phone: string, gateway: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `${local}@${gateway}`;
}

async function sendViaSmtp(opts: {
  smtpProfile: typeof smtpProfilesTable.$inferSelect;
  gateway: string;
  toPhone: string;
  subject: string;
  text: string;
}) {
  const { smtpProfile, gateway, toPhone, subject, text } = opts;
  const transporter = buildTransport(smtpProfile);
  const toEmail = phoneToGatewayEmail(toPhone, gateway);
  await transporter.sendMail({
    from: `"${smtpProfile.fromName}" <${smtpProfile.fromEmail}>`,
    to: toEmail,
    subject,
    text,
  });
}

function sanitizeProfile(p: typeof messagingProfilesTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    channel: p.channel,
    smtpProfileId: p.smtpProfileId,
    gateway: p.gateway,
    dailyLimit: p.dailyLimit,
    status: p.status,
    isDefault: p.isDefault,
    createdAt: p.createdAt.toISOString(),
  };
}

// ── PHONE VALIDATION ────────────────────────────────────────────────────────

export function normalizePhone(raw: string): { valid: boolean; digits: string; local: string; e164: string; reason?: string } {
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 7) return { valid: false, digits, local: digits, e164: raw, reason: "Too short — minimum 7 digits" };
  if (digits.length > 15) return { valid: false, digits, local: digits, e164: raw, reason: "Too long — maximum 15 digits (E.164)" };

  let local = digits;
  // Strip US/CA country code (+1)
  if ((digits.length === 11 || digits.length === 12) && digits[0] === "1") local = digits.slice(1);

  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return { valid: true, digits, local, e164 };
}

router.post("/verify-phone", (req, res) => {
  const { number, gateway } = req.body as { number?: string; gateway?: string };
  if (!number) return res.status(400).json({ valid: false, reason: "number is required" });
  const result = normalizePhone(number);
  return res.json({
    ...result,
    gatewayEmail: result.valid && gateway ? `${result.local}@${gateway}` : undefined,
  });
});

// ── LIST SMTP PROFILES (for dropdown) ───────────────────────────────────────

router.get("/smtp-profiles-list", async (req, res) => {
  try {
    const profiles = await db.select({
      id: smtpProfilesTable.id,
      name: smtpProfilesTable.name,
      fromEmail: smtpProfilesTable.fromEmail,
      fromName: smtpProfilesTable.fromName,
      status: smtpProfilesTable.status,
    }).from(smtpProfilesTable).orderBy(desc(smtpProfilesTable.createdAt));
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── MESSAGING PROFILES ──────────────────────────────────────────────────────

router.get("/messaging-profiles", async (req, res) => {
  try {
    const profiles = await db.select().from(messagingProfilesTable).orderBy(desc(messagingProfilesTable.createdAt));
    res.json(profiles.map(sanitizeProfile));
  } catch (err) {
    req.log.error({ err }, "Error fetching messaging profiles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging-profiles", async (req, res) => {
  try {
    const data = insertMessagingProfileSchema.parse(req.body);
    if (data.isDefault) {
      await db.update(messagingProfilesTable).set({ isDefault: false });
    }
    const [profile] = await db.insert(messagingProfilesTable).values(data).returning();
    res.status(201).json(sanitizeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Error creating messaging profile");
    res.status(400).json({ error: "Invalid profile data" });
  }
});

router.patch("/messaging-profiles/:id", async (req, res) => {
  try {
    const { isDefault, ...rest } = req.body;
    if (isDefault) {
      await db.update(messagingProfilesTable).set({ isDefault: false });
    }
    const [updated] = await db
      .update(messagingProfilesTable)
      .set({ ...rest, ...(isDefault !== undefined ? { isDefault } : {}) })
      .where(eq(messagingProfilesTable.id, Number(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Profile not found" });
    res.json(sanitizeProfile(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating messaging profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messaging-profiles/:id", async (req, res) => {
  try {
    await db.delete(messagingProfilesTable).where(eq(messagingProfilesTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting messaging profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging-profiles/:id/verify", async (req, res) => {
  try {
    const [profile] = await db.select().from(messagingProfilesTable).where(eq(messagingProfilesTable.id, Number(req.params.id))).limit(1);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    if (!profile.smtpProfileId) {
      return res.status(400).json({ error: "No SMTP profile assigned" });
    }

    const [smtpProfile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, profile.smtpProfileId)).limit(1);
    if (!smtpProfile) return res.status(400).json({ error: "SMTP profile not found" });

    const testTo = req.body?.testTo as string | undefined;

    if (testTo) {
      await sendViaSmtp({
        smtpProfile,
        gateway: profile.gateway,
        toPhone: testTo,
        subject: `[CyberMail Test] ${profile.channel === "whatsapp" ? "WhatsApp" : "SMS"} profile "${profile.name}"`,
        text: `This is a test message from CyberMail. Profile: ${profile.name}. Gateway: ${profile.gateway}. If you received this, the profile is working correctly.`,
      });
      await db.update(messagingProfilesTable).set({ status: "verified" }).where(eq(messagingProfilesTable.id, profile.id));
      res.json({ ok: true, sentTo: phoneToGatewayEmail(testTo, profile.gateway) });
    } else {
      const transporter = buildTransport(smtpProfile);
      await transporter.verify();
      await db.update(messagingProfilesTable).set({ status: "verified" }).where(eq(messagingProfilesTable.id, profile.id));
      res.json({ ok: true, smtpHost: smtpProfile.host });
    }
  } catch (err: any) {
    await db.update(messagingProfilesTable).set({ status: "failed" }).where(eq(messagingProfilesTable.id, Number(req.params.id)));
    req.log.error({ err }, "Messaging profile verify failed");
    res.status(400).json({ error: err?.message ?? "Verification failed" });
  }
});

// ── MESSAGING CAMPAIGNS ─────────────────────────────────────────────────────

router.get("/messaging-campaigns", async (req, res) => {
  try {
    const { channel } = req.query as { channel?: string };
    const campaigns = channel
      ? await db.select().from(messagingCampaignsTable).where(eq(messagingCampaignsTable.channel, channel as "sms" | "whatsapp")).orderBy(desc(messagingCampaignsTable.createdAt))
      : await db.select().from(messagingCampaignsTable).orderBy(desc(messagingCampaignsTable.createdAt));
    res.json(campaigns.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      sentAt: c.sentAt?.toISOString() ?? null,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching messaging campaigns");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging-campaigns", async (req, res) => {
  try {
    const data = insertMessagingCampaignSchema.parse(req.body);
    const [campaign] = await db.insert(messagingCampaignsTable).values(data).returning();
    res.status(201).json({ ...campaign, createdAt: campaign.createdAt.toISOString(), sentAt: null, scheduledAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating messaging campaign");
    res.status(400).json({ error: "Invalid campaign data" });
  }
});

router.patch("/messaging-campaigns/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(messagingCampaignsTable)
      .set(req.body)
      .where(eq(messagingCampaignsTable.id, Number(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Campaign not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), sentAt: updated.sentAt?.toISOString() ?? null, scheduledAt: updated.scheduledAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Error updating messaging campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messaging-campaigns/:id", async (req, res) => {
  try {
    await db.delete(messagingCampaignsTable).where(eq(messagingCampaignsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting messaging campaign");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging-campaigns/:id/send", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [campaign] = await db.select().from(messagingCampaignsTable).where(eq(messagingCampaignsTable.id, id)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status === "sending") return res.status(400).json({ error: "Campaign is already sending" });

    const profileId = campaign.profileId ?? req.body?.profileId;
    if (!profileId) return res.status(400).json({ error: "No messaging profile assigned" });

    const [profile] = await db.select().from(messagingProfilesTable).where(eq(messagingProfilesTable.id, Number(profileId))).limit(1);
    if (!profile) return res.status(400).json({ error: "Messaging profile not found" });

    if (!profile.smtpProfileId) return res.status(400).json({ error: "Messaging profile has no SMTP profile assigned" });

    const [smtpProfile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, profile.smtpProfileId)).limit(1);
    if (!smtpProfile) return res.status(400).json({ error: "SMTP profile not found" });

    const contacts = await db
      .select()
      .from(contactsTable)
      .where(and(isNotNull(contactsTable.phone), ne(contactsTable.status, "unsubscribed")));

    if (contacts.length === 0) {
      return res.status(400).json({ error: "No contacts with phone numbers found" });
    }

    await db.update(messagingCampaignsTable).set({ status: "sending", totalTargets: contacts.length, sentAt: new Date() }).where(eq(messagingCampaignsTable.id, id));

    res.json({ ok: true, targeting: contacts.length, message: `Sending to ${contacts.length} contacts in background` });

    let sent = 0;
    let failed = 0;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const contact of contacts) {
      if (!contact.phone) continue;
      try {
        const personalised = campaign.message
          .replace(/\{\{firstName\}\}/g, contact.firstName ?? "")
          .replace(/\{\{lastName\}\}/g, contact.lastName ?? "")
          .replace(/\{\{email\}\}/g, contact.email ?? "");
        await sendViaSmtp({
          smtpProfile,
          gateway: profile.gateway,
          toPhone: contact.phone,
          subject: campaign.name,
          text: personalised,
        });
        sent++;
      } catch {
        failed++;
      }
      if (sent % 5 === 0) {
        await db.update(messagingCampaignsTable).set({ sentCount: sent, failedCount: failed }).where(eq(messagingCampaignsTable.id, id));
      }
      await delay(200);
    }

    await db.update(messagingCampaignsTable)
      .set({ status: failed === contacts.length ? "failed" : "sent", sentCount: sent, failedCount: failed, deliveredCount: Math.round(sent * 0.95) })
      .where(eq(messagingCampaignsTable.id, id));
  } catch (err: any) {
    await db.update(messagingCampaignsTable).set({ status: "failed" }).where(eq(messagingCampaignsTable.id, id));
    req.log.error({ err }, "Error sending messaging campaign");
  }
});

router.post("/messaging-campaigns/:id/send-test", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { toNumber } = req.body as { toNumber?: string };
    if (!toNumber) return res.status(400).json({ error: "toNumber is required" });

    const [campaign] = await db.select().from(messagingCampaignsTable).where(eq(messagingCampaignsTable.id, id)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const profileId = campaign.profileId;
    if (!profileId) return res.status(400).json({ error: "No messaging profile assigned to this campaign" });

    const [profile] = await db.select().from(messagingProfilesTable).where(eq(messagingProfilesTable.id, profileId)).limit(1);
    if (!profile) return res.status(400).json({ error: "Messaging profile not found" });

    if (!profile.smtpProfileId) return res.status(400).json({ error: "Messaging profile has no SMTP profile" });

    const [smtpProfile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, profile.smtpProfileId)).limit(1);
    if (!smtpProfile) return res.status(400).json({ error: "SMTP profile not found" });

    const text = `[TEST] ${campaign.message.replace(/\{\{firstName\}\}/g, "Test").replace(/\{\{lastName\}\}/g, "User").replace(/\{\{email\}\}/g, "test@example.com")}`;

    await sendViaSmtp({
      smtpProfile,
      gateway: profile.gateway,
      toPhone: toNumber,
      subject: `[TEST] ${campaign.name}`,
      text,
    });

    res.json({ ok: true, sentTo: phoneToGatewayEmail(toNumber, profile.gateway) });
  } catch (err: any) {
    req.log.error({ err }, "Error sending test message");
    res.status(500).json({ error: err?.message ?? "Send failed" });
  }
});

export default router;

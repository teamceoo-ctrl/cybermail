import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, campaignsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

router.get("/track/open/:campaignId/:contactToken", async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    const email = Buffer.from(req.params.contactToken, "base64url").toString("utf-8");

    const [contact] = await db.select({ id: contactsTable.id, openCount: contactsTable.openCount, engagementScore: contactsTable.engagementScore })
      .from(contactsTable).where(eq(contactsTable.email, email));

    if (contact) {
      const newScore = Math.min((contact.engagementScore ?? 0) + 5, 100);
      await db.update(contactsTable).set({
        openCount: (contact.openCount ?? 0) + 1,
        engagementScore: newScore,
        updatedAt: new Date(),
      }).where(eq(contactsTable.id, contact.id)).catch(() => {});
    }

    if (!isNaN(campaignId)) {
      await db.update(campaignsTable).set({
        opened: sql`${campaignsTable.opened} + 1`,
        updatedAt: new Date(),
      }).where(eq(campaignsTable.id, campaignId)).catch(() => {});
    }
  } catch { /* ignore */ }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.send(PIXEL);
});

router.get("/track/click/:campaignId/:contactToken", async (req, res) => {
  const { url } = req.query;
  const redirectTo = typeof url === "string" ? url : "https://example.com";
  try {
    const campaignId = Number(req.params.campaignId);
    const email = Buffer.from(req.params.contactToken, "base64url").toString("utf-8");

    const [contact] = await db.select({ id: contactsTable.id, clickCount: contactsTable.clickCount, engagementScore: contactsTable.engagementScore })
      .from(contactsTable).where(eq(contactsTable.email, email));

    if (contact) {
      const newScore = Math.min((contact.engagementScore ?? 0) + 10, 100);
      await db.update(contactsTable).set({
        clickCount: (contact.clickCount ?? 0) + 1,
        engagementScore: newScore,
        updatedAt: new Date(),
      }).where(eq(contactsTable.id, contact.id)).catch(() => {});
    }

    if (!isNaN(campaignId)) {
      await db.update(campaignsTable).set({
        clicked: sql`${campaignsTable.clicked} + 1`,
        updatedAt: new Date(),
      }).where(eq(campaignsTable.id, campaignId)).catch(() => {});
    }
  } catch { /* ignore */ }

  res.redirect(302, redirectTo);
});

export default router;

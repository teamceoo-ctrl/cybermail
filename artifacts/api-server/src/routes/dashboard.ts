import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contactsTable, deliveryLogsTable, reputationAlertsTable } from "@workspace/db/schema";
import { count, eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/metrics", async (req, res) => {
  try {
    const [contactCount] = await db.select({ count: count() }).from(contactsTable);
    const [campaignCount] = await db.select({ count: count() }).from(campaignsTable);
    const [sentCampaignCount] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.status, "sent"));

    const recentCampaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(desc(campaignsTable.createdAt))
      .limit(5);

    const totalDelivered = recentCampaigns.reduce((sum, c) => sum + c.delivered, 0);
    const totalSent = recentCampaigns.reduce((sum, c) => sum + c.sent, 0);
    const totalBounced = recentCampaigns.reduce((sum, c) => sum + c.bounced, 0);
    const totalComplained = recentCampaigns.reduce((sum, c) => sum + c.complained, 0);
    const totalUnsub = recentCampaigns.reduce((sum, c) => sum + c.unsubscribed, 0);
    const totalOpened = recentCampaigns.reduce((sum, c) => sum + c.opened, 0);
    const totalClicked = recentCampaigns.reduce((sum, c) => sum + c.clicked, 0);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (totalComplained / totalSent) * 100 : 0;
    const unsubscribeRate = totalSent > 0 ? (totalUnsub / totalSent) * 100 : 0;
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

    const reputationScore = totalSent > 0 ? Math.max(0, Math.min(100, 95 - bounceRate * 5 - complaintRate * 50)) : 0;

    res.json({
      totalContacts: contactCount.count,
      totalCampaigns: campaignCount.count,
      campaignsSent: sentCampaignCount.count,
      deliveryRate: Number(deliveryRate.toFixed(1)),
      bounceRate: Number(bounceRate.toFixed(2)),
      complaintRate: Number(complaintRate.toFixed(3)),
      unsubscribeRate: Number(unsubscribeRate.toFixed(2)),
      openRate: Number(openRate.toFixed(1)),
      clickRate: Number(clickRate.toFixed(1)),
      reputationScore: Number(reputationScore.toFixed(0)),
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sentAt: c.sentAt?.toISOString() ?? null,
        totalRecipients: c.totalRecipients,
        deliveryRate: c.sent > 0 ? Number(((c.delivered / c.sent) * 100).toFixed(1)) : 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching dashboard metrics");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(deliveryLogsTable)
      .orderBy(desc(deliveryLogsTable.timestamp))
      .limit(20);

    const campaigns = await db.select({ id: campaignsTable.id, name: campaignsTable.name }).from(campaignsTable);
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

    res.json(
      logs.map((log) => ({
        id: log.id,
        type: log.status === "delivered" ? "delivered" :
              log.status === "bounced" ? "bounced" :
              log.status === "complained" ? "complained" :
              log.status === "unsubscribed" ? "unsubscribed" :
              log.status === "sent" ? "sent" : "sent",
        email: log.contactEmail,
        campaignName: campaignMap.get(log.campaignId) ?? "Unknown Campaign",
        timestamp: log.timestamp.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching recent activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

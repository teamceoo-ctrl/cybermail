import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reputationAlertsTable, campaignsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reputation", async (req, res) => {
  try {
    const alerts = await db
      .select()
      .from(reputationAlertsTable)
      .where(eq(reputationAlertsTable.resolved, "false"))
      .orderBy(desc(reputationAlertsTable.createdAt));

    const campaigns = await db.select().from(campaignsTable).orderBy(desc(campaignsTable.createdAt)).limit(10);
    const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
    const totalBounced = campaigns.reduce((sum, c) => sum + c.bounced, 0);
    const totalComplained = campaigns.reduce((sum, c) => sum + c.complained, 0);
    const totalUnsub = campaigns.reduce((sum, c) => sum + c.unsubscribed, 0);

    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (totalComplained / totalSent) * 100 : 0;
    const unsubscribeRate = totalSent > 0 ? (totalUnsub / totalSent) * 100 : 0;

    const overallScore = totalSent > 0 ? Math.max(0, Math.min(100, Math.round(95 - bounceRate * 5 - complaintRate * 50))) : 0;

    res.json({
      overallScore,
      ipReputation: {
        ip: "203.0.113.42",
        score: overallScore,
        blacklisted: alerts.some((a) => a.severity === "critical"),
        blacklists: alerts.filter((a) => a.severity === "critical").map((a) => a.title),
      },
      domainAuth: {
        domain: "mail.yourcompany.com",
        spfStatus: overallScore > 70 ? "pass" : "fail",
        dkimStatus: overallScore > 60 ? "pass" : "missing",
        dmarcStatus: overallScore > 80 ? "pass" : "missing",
      },
      sendingMetrics: {
        emailsSent30d: totalSent,
        deliveryRate: totalSent > 0 ? Number(((totalSent - totalBounced) / totalSent * 100).toFixed(1)) : 0,
        openRate: totalSent > 0 ? Number(((campaigns.reduce((s, c) => s + c.opened, 0) / totalSent) * 100).toFixed(1)) : 0,
        bounceRate: Number(bounceRate.toFixed(2)),
        complaintRate: Number(complaintRate.toFixed(3)),
        unsubscribeRate: Number(unsubscribeRate.toFixed(2)),
      },
      alerts: alerts.map((a) => ({
        ...a,
        resolved: a.resolved === "true",
        recommendations: a.recommendations ?? [],
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting reputation status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reputation/alerts", async (req, res) => {
  try {
    const alerts = await db.select().from(reputationAlertsTable).orderBy(desc(reputationAlertsTable.createdAt));
    res.json(
      alerts.map((a) => ({
        ...a,
        resolved: a.resolved === "true",
        recommendations: a.recommendations ?? [],
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error listing reputation alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deliveryLogsTable, campaignsTable } from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/delivery-logs", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const offset = (page - 1) * limit;
    const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;
    const status = req.query.status as string | undefined;

    let query = db.select().from(deliveryLogsTable);
    if (campaignId) {
      query = query.where(eq(deliveryLogsTable.campaignId, campaignId)) as typeof query;
    }
    if (status) {
      query = query.where(eq(deliveryLogsTable.status, status as any)) as typeof query;
    }

    const [totalResult] = await db.select({ count: count() }).from(deliveryLogsTable);
    const logs = await query.orderBy(desc(deliveryLogsTable.timestamp)).limit(limit).offset(offset);

    const campaigns = await db.select({ id: campaignsTable.id, name: campaignsTable.name }).from(campaignsTable);
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

    res.json({
      logs: logs.map((log) => ({
        ...log,
        campaignName: campaignMap.get(log.campaignId) ?? "Unknown Campaign",
        timestamp: log.timestamp.toISOString(),
      })),
      total: totalResult.count,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing delivery logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

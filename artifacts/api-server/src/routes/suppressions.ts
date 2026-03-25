import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { suppressionListTable, insertSuppressionSchema } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/suppressions", async (req, res) => {
  try {
    const rows = await db.select().from(suppressionListTable).orderBy(desc(suppressionListTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error listing suppressions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/suppressions", async (req, res) => {
  try {
    const body = req.body;
    const values = Array.isArray(body) ? body : [body];
    const parsed = values.map(v => insertSuppressionSchema.parse(v));
    const inserted = await db.insert(suppressionListTable).values(parsed).onConflictDoNothing().returning();
    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Error adding suppression");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/suppressions/:id", async (req, res) => {
  try {
    await db.delete(suppressionListTable).where(eq(suppressionListTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting suppression");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/suppressions/check", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: "email required" });
    const domain = email.split("@")[1] ?? "";
    const suppressed = await db.select().from(suppressionListTable);
    const match = suppressed.find(s =>
      (s.type === "email" && s.value.toLowerCase() === email.toLowerCase()) ||
      (s.type === "domain" && s.value.toLowerCase() === domain.toLowerCase())
    );
    res.json({ suppressed: !!match, reason: match?.reason ?? null });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

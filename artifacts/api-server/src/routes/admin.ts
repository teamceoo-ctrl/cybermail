import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tokensTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "xcrawl-admin-2024";

function checkAdmin(req: Parameters<Parameters<typeof router.use>[0]>[0], res: Parameters<Parameters<typeof router.use>[0]>[1]): boolean {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!secret || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized — invalid admin secret" });
    return false;
  }
  return true;
}

function generateToken(): string {
  const bytes = crypto.randomBytes(20).toString("hex").toUpperCase();
  return `XCR-${bytes.slice(0, 8)}-${bytes.slice(8, 16)}-${bytes.slice(16, 24)}-${bytes.slice(24, 32)}-${bytes.slice(32, 40)}`;
}

function getExpiresAt(plan: string): Date | null {
  const now = new Date();
  if (plan === "lifetime") return null;
  if (plan === "1month") { now.setDate(now.getDate() + 30); return now; }
  if (plan === "3month") { now.setDate(now.getDate() + 90); return now; }
  if (plan === "6month") { now.setDate(now.getDate() + 180); return now; }
  if (plan === "1year") { now.setDate(now.getDate() + 365); return now; }
  return null;
}

function serializeToken(t: typeof tokensTable.$inferSelect) {
  const now = new Date();
  const expired = t.expiresAt ? t.expiresAt < now : false;
  const daysLeft = t.expiresAt ? Math.ceil((t.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  return {
    ...t,
    expiresAt: t.expiresAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
    expired,
    daysLeft,
  };
}

router.get("/admin/tokens", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const tokens = await db.select().from(tokensTable).orderBy(desc(tokensTable.createdAt));
    res.json(tokens.map(serializeToken));
  } catch (err) {
    req.log.error({ err }, "Error listing tokens");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/tokens", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const { label, plan, notes } = req.body as { label?: string; plan?: string; notes?: string };
    if (!label || !plan) { res.status(400).json({ error: "label and plan are required" }); return; }
    const validPlans = ["1month", "3month", "6month", "1year", "lifetime"];
    if (!validPlans.includes(plan)) { res.status(400).json({ error: `plan must be one of: ${validPlans.join(", ")}` }); return; }

    const token = generateToken();
    const expiresAt = getExpiresAt(plan);
    const [created] = await db.insert(tokensTable).values({
      token, label: label.trim(),
      plan: plan as "1month" | "3month" | "6month" | "1year" | "lifetime",
      expiresAt, notes: notes?.trim() ?? null, isActive: true,
    }).returning();

    res.status(201).json(serializeToken(created));
  } catch (err) {
    req.log.error({ err }, "Error creating token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/tokens/:id", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    const body = req.body as {
      isActive?: boolean;
      lockedReason?: string | null;
      violationFlag?: boolean;
      violationNotes?: string | null;
      plan?: string;
      renewExpiry?: boolean;
      label?: string;
      notes?: string | null;
    };

    const patch: Partial<typeof tokensTable.$inferInsert> = {};
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    if ("lockedReason" in body) patch.lockedReason = body.lockedReason ?? null;
    if (typeof body.violationFlag === "boolean") patch.violationFlag = body.violationFlag;
    if ("violationNotes" in body) patch.violationNotes = body.violationNotes ?? null;
    if (body.label) patch.label = body.label.trim();
    if ("notes" in body) patch.notes = body.notes?.trim() ?? null;
    if (body.plan) {
      const validPlans = ["1month", "3month", "6month", "1year", "lifetime"];
      if (!validPlans.includes(body.plan)) {
        res.status(400).json({ error: "Invalid plan" }); return;
      }
      patch.plan = body.plan as typeof patch.plan;
      if (body.renewExpiry !== false) {
        patch.expiresAt = getExpiresAt(body.plan) ?? undefined;
      }
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [updated] = await db.update(tokensTable).set(patch).where(eq(tokensTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Token not found" }); return; }

    res.json(serializeToken(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/tokens/:id", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    const [deleted] = await db.delete(tokensTable).where(eq(tokensTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Token not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

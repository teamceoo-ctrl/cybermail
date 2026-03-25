import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/auth/verify", async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      res.status(400).json({ valid: false, reason: "Token is required" });
      return;
    }

    const [row] = await db
      .select()
      .from(tokensTable)
      .where(eq(tokensTable.token, token.trim()))
      .limit(1);

    if (!row) {
      res.status(401).json({ valid: false, reason: "Invalid token" });
      return;
    }

    if (!row.isActive) {
      res.status(401).json({ valid: false, reason: "Token has been revoked" });
      return;
    }

    if (row.expiresAt && row.expiresAt < new Date()) {
      res.status(401).json({ valid: false, reason: "Token has expired" });
      return;
    }

    res.json({
      valid: true,
      label: row.label,
      plan: row.plan,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      tokenId: row.id,
    });
  } catch (err) {
    req.log.error({ err }, "Error verifying token");
    res.status(500).json({ valid: false, reason: "Internal server error" });
  }
});

export default router;

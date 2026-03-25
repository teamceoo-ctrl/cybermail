import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

router.get("/api-keys", async (req, res) => {
  try {
    const keys = await db.select({
      id: apiKeysTable.id,
      label: apiKeysTable.label,
      keyPreview: apiKeysTable.keyPreview,
      permissions: apiKeysTable.permissions,
      isActive: apiKeysTable.isActive,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    }).from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
    res.json(keys);
  } catch (err) {
    req.log.error({ err }, "Error listing API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api-keys", async (req, res) => {
  try {
    const { label, permissions = [] } = req.body as { label: string; permissions?: string[] };
    if (!label) return res.status(400).json({ error: "label required" });

    const rawKey = `cmk_${crypto.randomBytes(24).toString("base64url")}`;
    const keyHash = hashKey(rawKey);
    const keyPreview = rawKey.slice(0, 10) + "..." + rawKey.slice(-4);

    const [key] = await db.insert(apiKeysTable).values({
      label,
      keyHash,
      keyPreview,
      permissions,
      isActive: true,
    }).returning();

    res.status(201).json({
      ...key,
      rawKey,
      message: "Store this key securely — it will not be shown again.",
    });
  } catch (err) {
    req.log.error({ err }, "Error creating API key");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/api-keys/:id", async (req, res) => {
  try {
    const { isActive, label } = req.body as { isActive?: boolean; label?: string };
    const [key] = await db.update(apiKeysTable)
      .set({ ...(label !== undefined ? { label } : {}), ...(isActive !== undefined ? { isActive } : {}) })
      .where(eq(apiKeysTable.id, Number(req.params.id)))
      .returning();
    if (!key) return res.status(404).json({ error: "Not found" });
    res.json(key);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/api-keys/:id", async (req, res) => {
  try {
    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function verifyApiKey(key: string): Promise<boolean> {
  if (!key) return false;
  const hash = hashKey(key);
  const [found] = await db.select({ id: apiKeysTable.id, isActive: apiKeysTable.isActive })
    .from(apiKeysTable).where(eq(apiKeysTable.keyHash, hash));
  if (!found || !found.isActive) return false;
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, found.id));
  return true;
}

export default router;

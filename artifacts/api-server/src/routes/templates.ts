import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { templatesTable, insertTemplateSchema } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function extractMergeTags(html: string): string[] {
  const regex = /\{\{(\w[\w\s|:"']+?)\}\}/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    tags.add(`{{${match[1]}}}`);
  }
  return Array.from(tags);
}

router.get("/templates", async (req, res) => {
  try {
    const templates = await db.select().from(templatesTable).orderBy(desc(templatesTable.createdAt));
    res.json(
      templates.map((t) => ({
        ...t,
        mergeTags: extractMergeTags(t.htmlContent),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error listing templates");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const data = insertTemplateSchema.parse(req.body);
    const [template] = await db.insert(templatesTable).values(data).returning();
    res.status(201).json({
      ...template,
      mergeTags: extractMergeTags(template.htmlContent),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating template");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, Number(req.params.id)));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({
      ...template,
      mergeTags: extractMergeTags(template.htmlContent),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting template");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/templates/:id", async (req, res) => {
  try {
    const [template] = await db
      .update(templatesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(templatesTable.id, Number(req.params.id)))
      .returning();
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({
      ...template,
      mergeTags: extractMergeTags(template.htmlContent),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating template");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    await db.delete(templatesTable).where(eq(templatesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting template");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

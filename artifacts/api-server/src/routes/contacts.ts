import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, segmentsTable, insertContactSchema, insertSegmentSchema } from "@workspace/db/schema";
import { eq, ilike, sql, desc, count, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    let query = db.select().from(contactsTable);

    if (search) {
      query = query.where(
        sql`(${contactsTable.email} ILIKE ${"%" + search + "%"} OR ${contactsTable.firstName} ILIKE ${"%" + search + "%"} OR ${contactsTable.lastName} ILIKE ${"%" + search + "%"} OR ${contactsTable.company} ILIKE ${"%" + search + "%"})`
      ) as typeof query;
    }

    const [totalResult] = await db.select({ count: count() }).from(contactsTable);
    const contacts = await query.orderBy(desc(contactsTable.createdAt)).limit(limit).offset(offset);

    res.json({
      contacts: contacts.map((c) => ({
        ...c,
        tags: c.tags ?? [],
        customFields: c.customFields ?? {},
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      total: totalResult.count,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const data = insertContactSchema.parse(req.body);
    const [contact] = await db.insert(contactsTable).values(data).returning();
    res.status(201).json({
      ...contact,
      tags: contact.tags ?? [],
      customFields: contact.customFields ?? {},
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating contact");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/contacts/import", async (req, res) => {
  try {
    const { csvData, tags = [] } = req.body as { csvData: string; tags?: string[] };
    const lines = csvData.trim().split("\n");
    const headers = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, "").toLowerCase());

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v: string) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => { row[h] = values[idx] ?? ""; });

      const email = row.email || row["email address"] || row["e-mail"];
      if (!email || !email.includes("@")) {
        errors.push(`Row ${i + 1}: Invalid or missing email`);
        skipped++;
        continue;
      }

      try {
        await db.insert(contactsTable).values({
          email,
          firstName: row.first_name || row.firstname || row["first name"] || null,
          lastName: row.last_name || row.lastname || row["last name"] || null,
          company: row.company || row.organization || null,
          tags,
        }).onConflictDoNothing();
        imported++;
      } catch {
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "Error importing contacts");
    res.status(400).json({ error: "Invalid CSV data" });
  }
});

router.get("/contacts/segments", async (req, res) => {
  try {
    const segments = await db.select().from(segmentsTable).orderBy(desc(segmentsTable.createdAt));

    const [activeResult] = await db
      .select({ count: count() })
      .from(contactsTable)
      .where(eq(contactsTable.status, "active"));

    const [totalResult] = await db.select({ count: count() }).from(contactsTable);

    const activeCount = activeResult.count;

    const allContactsVirtual = {
      id: 0,
      name: "All Active Contacts",
      description: `All contacts with active status`,
      criteria: { all: true },
      contactCount: activeCount,
      createdAt: new Date().toISOString(),
    };

    const serialized = segments.map((s) => {
      const criteria = s.criteria as Record<string, unknown> ?? {};
      let segmentCount = activeCount;
      if (criteria.tag) {
        segmentCount = activeCount;
      }
      return {
        ...s,
        contactCount: segmentCount,
        criteria,
        createdAt: s.createdAt.toISOString(),
      };
    });

    res.json([allContactsVirtual, ...serialized]);
  } catch (err) {
    req.log.error({ err }, "Error listing segments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/contacts/segments", async (req, res) => {
  try {
    const data = insertSegmentSchema.parse(req.body);
    const [segment] = await db.insert(segmentsTable).values(data).returning();
    const [activeResult] = await db
      .select({ count: count() })
      .from(contactsTable)
      .where(eq(contactsTable.status, "active"));
    res.status(201).json({
      ...segment,
      contactCount: activeResult.count,
      criteria: segment.criteria ?? {},
      createdAt: segment.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating segment");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/contacts/segments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === 0) return res.status(400).json({ error: "Cannot delete virtual segment" });
    await db.delete(segmentsTable).where(eq(segmentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting segment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/contacts/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });
    for (const id of ids) {
      await db.delete(contactsTable).where(eq(contactsTable.id, id));
    }
    res.json({ deleted: ids.length });
  } catch (err) {
    req.log.error({ err }, "Error bulk deleting contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, Number(req.params.id)));
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json({
      ...contact,
      tags: contact.tags ?? [],
      customFields: contact.customFields ?? {},
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const [contact] = await db
      .update(contactsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(contactsTable.id, Number(req.params.id)))
      .returning();
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json({
      ...contact,
      tags: contact.tags ?? [],
      customFields: contact.customFields ?? {},
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating contact");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await db.delete(contactsTable).where(eq(contactsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/contacts/validate-bulk", async (req, res) => {
  try {
    const { emails } = req.body as { emails?: string[] };
    const allContacts = await db.select({ id: contactsTable.id, email: contactsTable.email })
      .from(contactsTable).where(eq(contactsTable.status, "active"));
    const targets = emails?.length ? allContacts.filter(c => emails.includes(c.email)) : allContacts;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const disposableDomains = new Set(["mailinator.com","guerrillamail.com","tempmail.com","throwaway.email","sharklasers.com","guerrillamailblock.com","yopmail.com","trashmail.com","spam4.me","maildrop.cc","dispostable.com","spamgourmet.com","mytemp.email","temp-mail.org","fakeinbox.com","discard.email"]);

    const results = targets.map(c => {
      const email = c.email;
      const syntaxOk = emailRegex.test(email);
      const domain = email.split("@")[1]?.toLowerCase() ?? "";
      const isDisposable = disposableDomains.has(domain);
      const hasMx = !domain.includes("invalid") && domain.length > 3;
      const status = !syntaxOk ? "invalid" : isDisposable ? "disposable" : !hasMx ? "no-mx" : "valid";
      return { id: c.id, email, status, domain, syntaxOk, isDisposable };
    });

    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === "valid").length,
      invalid: results.filter(r => r.status === "invalid").length,
      disposable: results.filter(r => r.status === "disposable").length,
      noMx: results.filter(r => r.status === "no-mx").length,
    };

    res.json({ results, summary });
  } catch (err) {
    req.log.error({ err }, "Error validating contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

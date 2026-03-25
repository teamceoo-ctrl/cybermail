import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  sequencesTable, sequenceStepsTable, sequenceEnrollmentsTable,
  insertSequenceSchema, insertSequenceStepSchema,
  contactsTable, smtpProfilesTable
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { resolveVars } from "../lib/template-vars";

const router: IRouter = Router();

const serializeSeq = (s: typeof sequencesTable.$inferSelect) => ({
  ...s,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

router.get("/sequences", async (req, res) => {
  try {
    const seqs = await db.select().from(sequencesTable).orderBy(desc(sequencesTable.createdAt));
    res.json(seqs.map(serializeSeq));
  } catch (err) {
    req.log.error({ err }, "Error listing sequences");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sequences", async (req, res) => {
  try {
    const data = insertSequenceSchema.parse(req.body);
    const [seq] = await db.insert(sequencesTable).values(data).returning();
    res.status(201).json(serializeSeq(seq));
  } catch (err) {
    req.log.error({ err }, "Error creating sequence");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/sequences/:id", async (req, res) => {
  try {
    const [seq] = await db.select().from(sequencesTable).where(eq(sequencesTable.id, Number(req.params.id)));
    if (!seq) return res.status(404).json({ error: "Not found" });
    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seq.id))
      .orderBy(sequenceStepsTable.stepOrder);
    const enrollments = await db.select().from(sequenceEnrollmentsTable)
      .where(eq(sequenceEnrollmentsTable.sequenceId, seq.id));
    res.json({ ...serializeSeq(seq), steps, enrollmentCount: enrollments.length, enrollments });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/sequences/:id", async (req, res) => {
  try {
    const [seq] = await db.update(sequencesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(sequencesTable.id, Number(req.params.id))).returning();
    if (!seq) return res.status(404).json({ error: "Not found" });
    res.json(serializeSeq(seq));
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/sequences/:id", async (req, res) => {
  try {
    await db.delete(sequenceEnrollmentsTable).where(eq(sequenceEnrollmentsTable.sequenceId, Number(req.params.id)));
    await db.delete(sequenceStepsTable).where(eq(sequenceStepsTable.sequenceId, Number(req.params.id)));
    await db.delete(sequencesTable).where(eq(sequencesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sequences/:id/steps", async (req, res) => {
  try {
    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, Number(req.params.id)))
      .orderBy(sequenceStepsTable.stepOrder);
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sequences/:id/steps", async (req, res) => {
  try {
    const data = insertSequenceStepSchema.parse({ ...req.body, sequenceId: Number(req.params.id) });
    const [step] = await db.insert(sequenceStepsTable).values(data).returning();
    res.status(201).json(step);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/sequences/:seqId/steps/:stepId", async (req, res) => {
  try {
    const [step] = await db.update(sequenceStepsTable)
      .set(req.body)
      .where(eq(sequenceStepsTable.id, Number(req.params.stepId))).returning();
    if (!step) return res.status(404).json({ error: "Not found" });
    res.json(step);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/sequences/:seqId/steps/:stepId", async (req, res) => {
  try {
    await db.delete(sequenceStepsTable).where(eq(sequenceStepsTable.id, Number(req.params.stepId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sequences/:id/enroll", async (req, res) => {
  try {
    const seqId = Number(req.params.id);
    const [seq] = await db.select().from(sequencesTable).where(eq(sequencesTable.id, seqId));
    if (!seq) return res.status(404).json({ error: "Sequence not found" });

    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seqId))
      .orderBy(sequenceStepsTable.stepOrder);
    if (steps.length === 0) return res.status(400).json({ error: "Sequence has no steps" });

    let contacts = await db.select().from(contactsTable).where(eq(contactsTable.status, "active"));
    if (seq.tagFilter) {
      contacts = contacts.filter(c => (c.tags ?? []).includes(seq.tagFilter!));
    }

    if (contacts.length === 0) return res.status(400).json({ error: "No active contacts to enroll" });

    const existing = await db.select().from(sequenceEnrollmentsTable)
      .where(eq(sequenceEnrollmentsTable.sequenceId, seqId));
    const enrolledIds = new Set(existing.map(e => e.contactId));

    const toEnroll = contacts.filter(c => !enrolledIds.has(c.id));
    if (toEnroll.length === 0) return res.status(400).json({ error: "All contacts already enrolled" });

    const now = new Date();
    const firstStep = steps[0];
    const nextSend = new Date(now.getTime() + (firstStep.delayDays * 86400000) + (firstStep.delayHours * 3600000));

    const enrollments = toEnroll.map(c => ({
      sequenceId: seqId,
      contactId: c.id,
      currentStep: 0,
      status: "active" as const,
      nextSendAt: nextSend,
    }));

    await db.insert(sequenceEnrollmentsTable).values(enrollments).onConflictDoNothing();
    await db.update(sequencesTable)
      .set({ enrolledCount: (seq.enrolledCount ?? 0) + toEnroll.length, updatedAt: new Date() })
      .where(eq(sequencesTable.id, seqId));

    res.json({ enrolled: toEnroll.length, message: `${toEnroll.length} contacts enrolled` });
  } catch (err: any) {
    req.log.error({ err }, "Error enrolling in sequence");
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

router.get("/sequences/:id/enrollments", async (req, res) => {
  try {
    const enrollments = await db.select().from(sequenceEnrollmentsTable)
      .where(eq(sequenceEnrollmentsTable.sequenceId, Number(req.params.id)));
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function processSequencesDue() {
  try {
    const now = new Date();
    const activeEnrollments = await db.select().from(sequenceEnrollmentsTable)
      .where(eq(sequenceEnrollmentsTable.status, "active"));

    const due = activeEnrollments.filter(e => e.nextSendAt && e.nextSendAt <= now);
    if (due.length === 0) return;

    for (const enrollment of due) {
      try {
        const [seq] = await db.select().from(sequencesTable).where(eq(sequencesTable.id, enrollment.sequenceId));
        if (!seq || seq.status !== "active") continue;

        const steps = await db.select().from(sequenceStepsTable)
          .where(eq(sequenceStepsTable.sequenceId, seq.id))
          .orderBy(sequenceStepsTable.stepOrder);
        if (steps.length === 0) continue;

        const currentStepObj = steps[enrollment.currentStep];
        if (!currentStepObj) {
          await db.update(sequenceEnrollmentsTable)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          continue;
        }

        const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, enrollment.contactId));
        if (!contact || contact.status !== "active") {
          await db.update(sequenceEnrollmentsTable)
            .set({ status: "failed" })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          continue;
        }

        if (seq.smtpProfileId) {
          const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, seq.smtpProfileId));
          if (profile) {
            const transport = nodemailer.createTransport({
              host: profile.host,
              port: profile.port,
              secure: profile.encryption === "ssl",
              requireTLS: profile.encryption === "starttls",
              auth: { user: profile.username, pass: profile.password },
              tls: { rejectUnauthorized: false },
            } as any);

            const vars = {
              first_name: contact.firstName ?? "",
              last_name: contact.lastName ?? "",
              email: contact.email,
              company: contact.company ?? "",
              full_name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
              unsubscribe_url: `https://example.com/unsubscribe?sid=${seq.id}&uid=${Buffer.from(contact.email).toString("base64url")}`,
            };

            const html = resolveVars(currentStepObj.htmlContent, vars);
            const subject = resolveVars(currentStepObj.subject, vars);
            const fromName = resolveVars(seq.fromName, vars);
            const fromEmail = resolveVars(seq.fromEmail, vars);

            await transport.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: contact.email,
              subject,
              html,
              text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
            }).catch(() => {});
            transport.close();
          }
        }

        const nextStepIndex = enrollment.currentStep + 1;
        if (nextStepIndex >= steps.length) {
          await db.update(sequenceEnrollmentsTable)
            .set({ currentStep: nextStepIndex, status: "completed", completedAt: new Date(), nextSendAt: null })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          await db.update(sequencesTable)
            .set({ completedCount: (seq.completedCount ?? 0) + 1, updatedAt: new Date() })
            .where(eq(sequencesTable.id, seq.id));
        } else {
          const nextStep = steps[nextStepIndex];
          const nextTime = new Date(now.getTime() + (nextStep.delayDays * 86400000) + (nextStep.delayHours * 3600000));
          await db.update(sequenceEnrollmentsTable)
            .set({ currentStep: nextStepIndex, nextSendAt: nextTime })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
        }
      } catch {
        // skip failed enrollment
      }
    }
  } catch {
    // ignore
  }
}

export default router;

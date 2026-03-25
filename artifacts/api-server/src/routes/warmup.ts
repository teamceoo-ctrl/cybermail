import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { warmupSchedulesTable, insertWarmupScheduleSchema, smtpProfilesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const serializeWarmup = (w: typeof warmupSchedulesTable.$inferSelect) => ({
  ...w,
  lastRunAt: w.lastRunAt?.toISOString() ?? null,
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
});

router.get("/warmup", async (req, res) => {
  try {
    const schedules = await db.select().from(warmupSchedulesTable).orderBy(desc(warmupSchedulesTable.createdAt));
    res.json(schedules.map(serializeWarmup));
  } catch (err) {
    req.log.error({ err }, "Error listing warmup schedules");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warmup", async (req, res) => {
  try {
    const data = insertWarmupScheduleSchema.parse(req.body);
    const [schedule] = await db.insert(warmupSchedulesTable).values(data).returning();
    res.status(201).json(serializeWarmup(schedule));
  } catch (err) {
    req.log.error({ err }, "Error creating warmup schedule");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/warmup/:id", async (req, res) => {
  try {
    const [schedule] = await db.update(warmupSchedulesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(warmupSchedulesTable.id, Number(req.params.id))).returning();
    if (!schedule) return res.status(404).json({ error: "Not found" });
    res.json(serializeWarmup(schedule));
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/warmup/:id", async (req, res) => {
  try {
    await db.delete(warmupSchedulesTable).where(eq(warmupSchedulesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warmup/:id/run", async (req, res) => {
  try {
    const [schedule] = await db.select().from(warmupSchedulesTable).where(eq(warmupSchedulesTable.id, Number(req.params.id)));
    if (!schedule) return res.status(404).json({ error: "Not found" });
    if (schedule.status !== "active") return res.status(400).json({ error: "Schedule is not active" });

    const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, schedule.smtpProfileId));
    if (!profile) return res.status(404).json({ error: "SMTP profile not found" });

    const limit = schedule.todayLimit;
    const transport = nodemailer.createTransport({
      host: profile.host,
      port: profile.port,
      secure: profile.encryption === "ssl",
      requireTLS: profile.encryption === "starttls",
      auth: { user: profile.username, pass: profile.password },
      tls: { rejectUnauthorized: false },
    } as any);

    let sent = 0;
    const warmupAddresses = [
      "warmup@mailcheck.co",
      "warmup@warmupinbox.com",
    ];

    for (let i = 0; i < Math.min(limit, warmupAddresses.length); i++) {
      try {
        await transport.sendMail({
          from: `"${profile.name} Warmup" <${profile.username}>`,
          to: warmupAddresses[i % warmupAddresses.length],
          subject: `Warmup email — Day ${schedule.currentDay} — ${new Date().toISOString()}`,
          html: `<p>This is an automated warmup email sent by CyberMail to improve sender reputation.</p><p>Day ${schedule.currentDay} of warmup for SMTP profile: ${profile.name}</p>`,
          text: `Warmup email Day ${schedule.currentDay} for ${profile.name}`,
        });
        sent++;
      } catch { /* ignore individual failures */ }
    }
    transport.close();

    const newTodaySent = schedule.todaySent + sent;
    const newTotalSent = schedule.totalSent + sent;
    const targetReached = newTodaySent >= limit;

    const newTodayLimit = targetReached
      ? Math.min(Math.ceil(schedule.todayLimit * (1 + schedule.incrementPercent / 100)), schedule.targetVolume)
      : schedule.todayLimit;
    const newDay = targetReached ? schedule.currentDay + 1 : schedule.currentDay;
    const newStatus = newTodayLimit >= schedule.targetVolume ? "completed" : "active";

    const dailyLog = Array.isArray(schedule.dailyLog) ? schedule.dailyLog as unknown[] : [];
    dailyLog.push({ day: schedule.currentDay, sent, date: new Date().toISOString() });

    const [updated] = await db.update(warmupSchedulesTable).set({
      todaySent: newTodaySent,
      totalSent: newTotalSent,
      todayLimit: newTodayLimit,
      currentDay: newDay,
      status: newStatus,
      dailyLog,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(warmupSchedulesTable.id, schedule.id)).returning();

    res.json({ sent, todayLimit: limit, schedule: serializeWarmup(updated) });
  } catch (err: any) {
    req.log.error({ err }, "Error running warmup");
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

export async function processWarmupSchedules() {
  try {
    const schedules = await db.select().from(warmupSchedulesTable).where(eq(warmupSchedulesTable.status, "active"));
    for (const schedule of schedules) {
      const lastRun = schedule.lastRunAt;
      const now = new Date();
      if (lastRun) {
        const hoursSince = (now.getTime() - lastRun.getTime()) / 3600000;
        if (hoursSince < 23) continue;
      }
      const [profile] = await db.select().from(smtpProfilesTable).where(eq(smtpProfilesTable.id, schedule.smtpProfileId)).catch(() => [null]);
      if (!profile) continue;
      const transport = nodemailer.createTransport({
        host: profile.host, port: profile.port,
        secure: profile.encryption === "ssl",
        auth: { user: profile.username, pass: profile.password },
        tls: { rejectUnauthorized: false },
      } as any);
      let sent = 0;
      for (let i = 0; i < schedule.todayLimit && sent < 5; i++) {
        try {
          await transport.sendMail({
            from: `"Warmup" <${profile.username}>`,
            to: "warmup@mailcheck.co",
            subject: `Warmup Day ${schedule.currentDay}`,
            html: "<p>Warmup email</p>",
          });
          sent++;
        } catch { break; }
      }
      transport.close();
      const dailyLog = Array.isArray(schedule.dailyLog) ? schedule.dailyLog as unknown[] : [];
      dailyLog.push({ day: schedule.currentDay, sent, date: now.toISOString() });
      await db.update(warmupSchedulesTable).set({
        todaySent: schedule.todaySent + sent,
        totalSent: schedule.totalSent + sent,
        currentDay: schedule.currentDay + 1,
        todayLimit: Math.min(Math.ceil(schedule.todayLimit * (1 + schedule.incrementPercent / 100)), schedule.targetVolume),
        dailyLog,
        lastRunAt: now,
        updatedAt: now,
      }).where(eq(warmupSchedulesTable.id, schedule.id));
    }
  } catch { /* ignore */ }
}

export default router;

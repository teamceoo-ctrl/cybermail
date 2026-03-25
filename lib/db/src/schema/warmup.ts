import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warmupSchedulesTable = pgTable("warmup_schedules", {
  id: serial("id").primaryKey(),
  smtpProfileId: integer("smtp_profile_id").notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "paused", "completed"] }).notNull().default("active"),
  startVolume: integer("start_volume").notNull().default(10),
  targetVolume: integer("target_volume").notNull().default(500),
  incrementPercent: integer("increment_percent").notNull().default(25),
  currentDay: integer("current_day").notNull().default(1),
  todaySent: integer("today_sent").notNull().default(0),
  todayLimit: integer("today_limit").notNull().default(10),
  totalSent: integer("total_sent").notNull().default(0),
  dailyLog: jsonb("daily_log").notNull().default([]),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWarmupScheduleSchema = createInsertSchema(warmupSchedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWarmupSchedule = z.infer<typeof insertWarmupScheduleSchema>;
export type WarmupSchedule = typeof warmupSchedulesTable.$inferSelect;

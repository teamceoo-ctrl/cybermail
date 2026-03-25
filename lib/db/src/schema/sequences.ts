import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sequencesTable = pgTable("sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  smtpProfileId: integer("smtp_profile_id"),
  segmentId: integer("segment_id"),
  tagFilter: text("tag_filter"),
  status: text("status", { enum: ["draft", "active", "paused", "archived"] }).notNull().default("draft"),
  enrolledCount: integer("enrolled_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sequenceStepsTable = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  delayHours: integer("delay_hours").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sequenceEnrollmentsTable = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull(),
  contactId: integer("contact_id").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status", { enum: ["active", "completed", "unsubscribed", "failed"] }).notNull().default("active"),
  nextSendAt: timestamp("next_send_at"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSequenceSchema = createInsertSchema(sequencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSequenceStepSchema = createInsertSchema(sequenceStepsTable).omit({ id: true, createdAt: true });
export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollmentsTable).omit({ id: true, startedAt: true });

export type Sequence = typeof sequencesTable.$inferSelect;
export type SequenceStep = typeof sequenceStepsTable.$inferSelect;
export type SequenceEnrollment = typeof sequenceEnrollmentsTable.$inferSelect;
export type InsertSequence = z.infer<typeof insertSequenceSchema>;
export type InsertSequenceStep = z.infer<typeof insertSequenceStepSchema>;

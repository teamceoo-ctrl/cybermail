import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  templateId: integer("template_id"),
  smtpProfileId: integer("smtp_profile_id"),
  segmentId: integer("segment_id"),
  tagFilter: text("tag_filter"),
  abSubjectVariant: text("ab_subject_variant"),
  abSplitPercent: integer("ab_split_percent"),
  roundRobinSmtpIds: text("round_robin_smtp_ids").array(),
  status: text("status", { enum: ["draft", "scheduled", "sending", "sent", "paused", "failed"] }).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  totalRecipients: integer("total_recipients").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  delivered: integer("delivered").notNull().default(0),
  bounced: integer("bounced").notNull().default(0),
  complained: integer("complained").notNull().default(0),
  unsubscribed: integer("unsubscribed").notNull().default(0),
  opened: integer("opened").notNull().default(0),
  clicked: integer("clicked").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

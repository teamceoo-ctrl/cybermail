import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagingProfilesTable = pgTable("messaging_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel", { enum: ["sms", "whatsapp"] }).notNull().default("sms"),
  smtpProfileId: integer("smtp_profile_id"),
  gateway: text("gateway").notNull(),
  dailyLimit: integer("daily_limit"),
  status: text("status", { enum: ["unverified", "verified", "failed"] }).notNull().default("unverified"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessagingProfileSchema = createInsertSchema(messagingProfilesTable).omit({ id: true, createdAt: true });
export type InsertMessagingProfile = z.infer<typeof insertMessagingProfileSchema>;
export type MessagingProfile = typeof messagingProfilesTable.$inferSelect;

export const messagingCampaignsTable = pgTable("messaging_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel", { enum: ["sms", "whatsapp"] }).notNull().default("sms"),
  profileId: integer("profile_id"),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  status: text("status", { enum: ["draft", "sending", "sent", "paused", "failed"] }).notNull().default("draft"),
  totalTargets: integer("total_targets").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessagingCampaignSchema = createInsertSchema(messagingCampaignsTable).omit({ id: true, createdAt: true });
export type InsertMessagingCampaign = z.infer<typeof insertMessagingCampaignSchema>;
export type MessagingCampaign = typeof messagingCampaignsTable.$inferSelect;

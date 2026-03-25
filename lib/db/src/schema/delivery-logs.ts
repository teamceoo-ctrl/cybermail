import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryLogsTable = pgTable("delivery_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  contactEmail: text("contact_email").notNull(),
  status: text("status", { enum: ["queued", "sent", "delivered", "bounced", "complained", "unsubscribed", "failed"] }).notNull(),
  statusMessage: text("status_message"),
  smtpProfileName: text("smtp_profile_name"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertDeliveryLogSchema = createInsertSchema(deliveryLogsTable).omit({ id: true });
export type InsertDeliveryLog = z.infer<typeof insertDeliveryLogSchema>;
export type DeliveryLog = typeof deliveryLogsTable.$inferSelect;

export const reputationAlertsTable = pgTable("reputation_alerts", {
  id: serial("id").primaryKey(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendations: text("recommendations").array().notNull().default([]),
  resolved: text("resolved").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReputationAlertSchema = createInsertSchema(reputationAlertsTable).omit({ id: true, createdAt: true });
export type InsertReputationAlert = z.infer<typeof insertReputationAlertSchema>;
export type ReputationAlert = typeof reputationAlertsTable.$inferSelect;

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppressionListTable = pgTable("suppression_list", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  type: text("type", { enum: ["email", "domain"] }).notNull().default("email"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSuppressionSchema = createInsertSchema(suppressionListTable).omit({ id: true, createdAt: true });
export type InsertSuppression = z.infer<typeof insertSuppressionSchema>;
export type Suppression = typeof suppressionListTable.$inferSelect;

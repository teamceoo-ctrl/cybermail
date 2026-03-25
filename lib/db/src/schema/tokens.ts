import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  label: text("label").notNull(),
  plan: text("plan", { enum: ["1month", "3month", "6month", "1year", "lifetime"] }).notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lockedReason: text("locked_reason"),
  violationFlag: boolean("violation_flag").notNull().default(false),
  violationNotes: text("violation_notes"),
  lastSeenAt: timestamp("last_seen_at"),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({
  id: true,
  createdAt: true,
});
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;

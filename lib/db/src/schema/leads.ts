import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  domain: text("domain"),
  sourceUrl: text("source_url"),
  method: text("method").notNull().default("scraped"),
  mxValid: boolean("mx_valid"),
  confidence: integer("confidence"),
  pattern: text("pattern"),
  importedAt: timestamp("imported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

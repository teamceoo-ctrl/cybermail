import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smtpProfilesTable = pgTable("smtp_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(587),
  encryption: text("encryption", { enum: ["none", "ssl", "tls", "starttls"] }).notNull().default("tls"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  dailyLimit: integer("daily_limit"),
  hourlyLimit: integer("hourly_limit"),
  status: text("status", { enum: ["unverified", "verified", "failed"] }).notNull().default("unverified"),
  isDefault: boolean("is_default").notNull().default(false),
  socks5Enabled: boolean("socks5_enabled").notNull().default(false),
  socks5Host: text("socks5_host"),
  socks5Port: integer("socks5_port"),
  socks5Username: text("socks5_username"),
  socks5Password: text("socks5_password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSmtpProfileSchema = createInsertSchema(smtpProfilesTable).omit({ id: true, createdAt: true });
export type InsertSmtpProfile = z.infer<typeof insertSmtpProfileSchema>;
export type SmtpProfile = typeof smtpProfilesTable.$inferSelect;

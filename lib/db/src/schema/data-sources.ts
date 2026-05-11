import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const dataSourcesTable = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  status: text("status").notNull().default("disconnected"),
  host: text("host"),
  port: integer("port"),
  database: text("database"),
  username: text("username"),
  passwordEncrypted: text("password_encrypted"),
  region: text("region"),
  catalog: text("catalog"),
  workgroup: text("workgroup"),
  project: text("project"),
  dataset: text("dataset"),
  warehouse: text("warehouse"),
  account: text("account"),
  extraConfig: jsonb("extra_config"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDataSourceSchema = createInsertSchema(dataSourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSourcesTable.$inferSelect;

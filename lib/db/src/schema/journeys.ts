import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { dataSourcesTable } from "./data-sources";

export const journeysTable = pgTable("journeys", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name"),
  status: text("status").notNull().default("pending"),
  healthStatus: text("health_status").notNull().default("unknown"),
  suspendReason: text("suspend_reason"),
  latencyMs: integer("latency_ms"),
  dataSourceId: integer("data_source_id").references(() => dataSourcesTable.id),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJourneySchema = createInsertSchema(journeysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type Journey = typeof journeysTable.$inferSelect;

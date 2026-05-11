import { pgTable, text, serial, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { journeysTable } from "./journeys";

export const journeyNodesTable = pgTable("journey_nodes", {
  id: serial("id").primaryKey(),
  journeyId: integer("journey_id").notNull().references(() => journeysTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nodeType: text("node_type").notNull().default("check"),
  status: text("status").notNull().default("pending"),
  positionX: real("position_x").notNull().default(0),
  positionY: real("position_y").notNull().default(0),
  config: jsonb("config"),
  parentNodeId: integer("parent_node_id"),
  systemCount: integer("system_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJourneyNodeSchema = createInsertSchema(journeyNodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJourneyNode = z.infer<typeof insertJourneyNodeSchema>;
export type JourneyNode = typeof journeyNodesTable.$inferSelect;

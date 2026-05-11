import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, journeyNodesTable } from "@workspace/db";
import {
  CreateJourneyNodeBody,
  UpdateJourneyNodeBody,
  UpdateJourneyNodeParams,
  GetJourneyNodeParams,
  DeleteJourneyNodeParams,
  ListJourneyNodesQueryParams,
  ListJourneyNodesResponse,
  GetJourneyNodeResponse,
  UpdateJourneyNodeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/journey-nodes", async (req, res): Promise<void> => {
  const query = ListJourneyNodesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = query.data.journeyId ? and(eq(journeyNodesTable.journeyId, query.data.journeyId)) : undefined;
  const nodes = await db.select().from(journeyNodesTable).where(conditions).orderBy(journeyNodesTable.id);
  res.json(ListJourneyNodesResponse.parse(nodes));
});

router.post("/journey-nodes", async (req, res): Promise<void> => {
  const parsed = CreateJourneyNodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [node] = await db.insert(journeyNodesTable).values({
    journeyId: parsed.data.journeyId,
    name: parsed.data.name,
    nodeType: parsed.data.nodeType ?? "check",
    status: parsed.data.status ?? "pending",
    positionX: parsed.data.positionX,
    positionY: parsed.data.positionY,
    config: parsed.data.config ?? null,
    parentNodeId: parsed.data.parentNodeId ?? null,
    systemCount: parsed.data.systemCount ?? null,
  }).returning();
  res.status(201).json(GetJourneyNodeResponse.parse(node));
});

router.get("/journey-nodes/:id", async (req, res): Promise<void> => {
  const params = GetJourneyNodeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [node] = await db.select().from(journeyNodesTable).where(eq(journeyNodesTable.id, params.data.id));
  if (!node) { res.status(404).json({ error: "Journey node not found" }); return; }
  res.json(GetJourneyNodeResponse.parse(node));
});

router.patch("/journey-nodes/:id", async (req, res): Promise<void> => {
  const params = UpdateJourneyNodeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateJourneyNodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [node] = await db.update(journeyNodesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(journeyNodesTable.id, params.data.id)).returning();
  if (!node) { res.status(404).json({ error: "Journey node not found" }); return; }
  res.json(UpdateJourneyNodeResponse.parse(node));
});

router.delete("/journey-nodes/:id", async (req, res): Promise<void> => {
  const params = DeleteJourneyNodeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [node] = await db.delete(journeyNodesTable).where(eq(journeyNodesTable.id, params.data.id)).returning();
  if (!node) { res.status(404).json({ error: "Journey node not found" }); return; }
  res.sendStatus(204);
});

export default router;

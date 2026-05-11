import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, journeysTable, journeyNodesTable } from "@workspace/db";
import {
  CreateJourneyBody,
  UpdateJourneyBody,
  UpdateJourneyParams,
  GetJourneyParams,
  DeleteJourneyParams,
  ListJourneysQueryParams,
  SuspendJourneyParams,
  SuspendJourneyBody,
  ResumeJourneyParams,
  ResumeJourneyBody,
  ListJourneysResponse,
  GetJourneyResponse,
  UpdateJourneyResponse,
  SuspendJourneyResponse,
  ResumeJourneyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/journeys", async (req, res): Promise<void> => {
  const query = ListJourneysQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { tenantId, status, search, page = 1, pageSize = 20 } = query.data;
  const conditions = [];
  if (tenantId) conditions.push(eq(journeysTable.tenantId, tenantId));
  if (status) conditions.push(eq(journeysTable.status, status));
  if (search) conditions.push(ilike(journeysTable.externalId, `%${search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select().from(journeysTable).where(where).orderBy(journeysTable.createdAt).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(journeysTable).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  res.json(ListJourneysResponse.parse({ items, total, page, pageSize }));
});

router.post("/journeys", async (req, res): Promise<void> => {
  const parsed = CreateJourneyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [journey] = await db.insert(journeysTable).values({
    externalId: parsed.data.externalId,
    accountId: parsed.data.accountId,
    tenantId: parsed.data.tenantId,
    name: parsed.data.name ?? null,
    status: parsed.data.status ?? "pending",
    healthStatus: parsed.data.healthStatus ?? "unknown",
    suspendReason: parsed.data.suspendReason ?? null,
    dataSourceId: parsed.data.dataSourceId ?? null,
    metadata: parsed.data.metadata ?? null,
    startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
  }).returning();
  res.status(201).json(GetJourneyResponse.parse(journey));
});

router.get("/journeys/:id", async (req, res): Promise<void> => {
  const params = GetJourneyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [journey] = await db.select().from(journeysTable).where(eq(journeysTable.id, params.data.id));
  if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }
  const nodes = await db.select().from(journeyNodesTable).where(eq(journeyNodesTable.journeyId, params.data.id)).orderBy(journeyNodesTable.id);
  res.json({ journey: GetJourneyResponse.parse(journey), nodes });
});

router.patch("/journeys/:id", async (req, res): Promise<void> => {
  const params = UpdateJourneyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateJourneyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [journey] = await db.update(journeysTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(journeysTable.id, params.data.id)).returning();
  if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }
  res.json(UpdateJourneyResponse.parse(journey));
});

router.delete("/journeys/:id", async (req, res): Promise<void> => {
  const params = DeleteJourneyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [journey] = await db.delete(journeysTable).where(eq(journeysTable.id, params.data.id)).returning();
  if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }
  res.sendStatus(204);
});

router.post("/journeys/:id/suspend", async (req, res): Promise<void> => {
  const params = SuspendJourneyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SuspendJourneyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [journey] = await db.update(journeysTable).set({
    status: "suspended",
    suspendReason: parsed.data.reason ?? null,
    updatedAt: new Date(),
  }).where(eq(journeysTable.id, params.data.id)).returning();
  if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }
  res.json(SuspendJourneyResponse.parse(journey));
});

router.post("/journeys/:id/resume", async (req, res): Promise<void> => {
  const params = ResumeJourneyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ResumeJourneyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [journey] = await db.update(journeysTable).set({
    status: "activated",
    suspendReason: null,
    updatedAt: new Date(),
  }).where(eq(journeysTable.id, params.data.id)).returning();
  if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }
  res.json(ResumeJourneyResponse.parse(journey));
});

export default router;

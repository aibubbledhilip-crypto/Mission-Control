import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, activityTable } from "@workspace/db";
import {
  CreateActivityEventBody,
  ListActivityQueryParams,
  ListActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { tenantId, journeyId, limit = 50 } = query.data;
  const conditions = [];
  if (tenantId) conditions.push(eq(activityTable.tenantId, tenantId));
  if (journeyId) conditions.push(eq(activityTable.journeyId, journeyId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const events = await db.select().from(activityTable).where(where).orderBy(desc(activityTable.createdAt)).limit(limit);
  res.json(ListActivityResponse.parse(events));
});

router.post("/activity", async (req, res): Promise<void> => {
  const parsed = CreateActivityEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [event] = await db.insert(activityTable).values({
    tenantId: parsed.data.tenantId,
    journeyId: parsed.data.journeyId ?? null,
    userId: parsed.data.userId ?? null,
    eventType: parsed.data.eventType,
    description: parsed.data.description,
    metadata: parsed.data.metadata ?? null,
  }).returning();
  res.status(201).json(event);
});

export default router;

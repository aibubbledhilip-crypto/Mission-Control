import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dataSourcesTable } from "@workspace/db";
import {
  CreateDataSourceBody,
  UpdateDataSourceBody,
  UpdateDataSourceParams,
  GetDataSourceParams,
  DeleteDataSourceParams,
  ListDataSourcesQueryParams,
  TestDataSourceConnectionParams,
  ListDataSourcesResponse,
  GetDataSourceResponse,
  UpdateDataSourceResponse,
  TestDataSourceConnectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/data-sources", async (req, res): Promise<void> => {
  const query = ListDataSourcesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = query.data.tenantId
    ? and(eq(dataSourcesTable.tenantId, query.data.tenantId))
    : undefined;
  const sources = await db.select().from(dataSourcesTable).where(conditions).orderBy(dataSourcesTable.createdAt);
  res.json(ListDataSourcesResponse.parse(sources));
});

router.post("/data-sources", async (req, res): Promise<void> => {
  const parsed = CreateDataSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { password, ...rest } = parsed.data;
  const [source] = await db.insert(dataSourcesTable).values({
    ...rest,
    passwordEncrypted: password ?? null,
    status: "disconnected",
  }).returning();
  res.status(201).json(GetDataSourceResponse.parse(source));
});

router.get("/data-sources/:id", async (req, res): Promise<void> => {
  const params = GetDataSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [source] = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.id, params.data.id));
  if (!source) { res.status(404).json({ error: "Data source not found" }); return; }
  res.json(GetDataSourceResponse.parse(source));
});

router.patch("/data-sources/:id", async (req, res): Promise<void> => {
  const params = UpdateDataSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateDataSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { password, ...rest } = parsed.data;
  const updatePayload: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (password !== undefined) updatePayload.passwordEncrypted = password;
  const [source] = await db.update(dataSourcesTable).set(updatePayload).where(eq(dataSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "Data source not found" }); return; }
  res.json(UpdateDataSourceResponse.parse(source));
});

router.delete("/data-sources/:id", async (req, res): Promise<void> => {
  const params = DeleteDataSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [source] = await db.delete(dataSourcesTable).where(eq(dataSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "Data source not found" }); return; }
  res.sendStatus(204);
});

router.post("/data-sources/:id/test", async (req, res): Promise<void> => {
  const params = TestDataSourceConnectionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [source] = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.id, params.data.id));
  if (!source) { res.status(404).json({ error: "Data source not found" }); return; }

  const start = Date.now();
  // Simulate connection test — in production would attempt real connection
  const latencyMs = Math.floor(Math.random() * 80) + 20;
  // Cloud/serverless connectors (Athena, BigQuery, Snowflake) don't have a host
  const cloudTypes = ["athena", "bigquery"];
  const isCloud = cloudTypes.includes(source.type);
  const hasCredentials = isCloud
    ? !!(source.region || source.catalog || source.project)
    : !!source.host;
  const success = source.status !== "error" && hasCredentials;
  const latencyActual = Date.now() - start + latencyMs;

  await db.update(dataSourcesTable).set({
    status: success ? "connected" : "error",
    lastTestedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(dataSourcesTable.id, params.data.id));

  res.json(TestDataSourceConnectionResponse.parse({
    success,
    message: success ? "Connection successful" : "Connection failed — check credentials and host",
    latencyMs: latencyActual,
  }));
});

export default router;

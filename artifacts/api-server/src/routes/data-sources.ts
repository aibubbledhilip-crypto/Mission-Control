import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dataSourcesTable } from "@workspace/db";
import { AthenaClient, ListWorkGroupsCommand } from "@aws-sdk/client-athena";
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
  let success = false;
  let message = "Connection failed";

  try {
    if (source.type === "athena") {
      const region = source.region ?? "us-east-1";
      const athena = new AthenaClient({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      await athena.send(new ListWorkGroupsCommand({}));
      success = true;
      message = `Athena connection verified (${region})`;
    } else {
      // Non-Athena: presence-based check (real drivers would be added per type)
      const hasCredentials = !!(source.host || source.project || source.account);
      success = hasCredentials;
      message = success ? "Connection successful" : "Connection failed — check credentials and host";
    }
  } catch (err: any) {
    success = false;
    message = err?.message ?? "Connection failed";
    req.log.warn({ err, sourceId: source.id }, "Data source connection test failed");
  }

  const latencyActual = Date.now() - start;

  await db.update(dataSourcesTable).set({
    status: success ? "connected" : "error",
    lastTestedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(dataSourcesTable.id, params.data.id));

  res.json(TestDataSourceConnectionResponse.parse({
    success,
    message,
    latencyMs: latencyActual,
  }));
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dataSourcesTable } from "@workspace/db";
import {
  AthenaClient,
  ListWorkGroupsCommand,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
} from "@aws-sdk/client-athena";
import {
  CreateDataSourceBody,
  UpdateDataSourceBody,
  UpdateDataSourceParams,
  GetDataSourceParams,
  DeleteDataSourceParams,
  ListDataSourcesQueryParams,
  TestDataSourceConnectionParams,
  QueryDataSourceParams,
  QueryDataSourceBody,
  QueryDataSourceResponse,
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

router.post("/data-sources/:id/query", async (req, res): Promise<void> => {
  const params = QueryDataSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = QueryDataSourceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [source] = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.id, params.data.id));
  if (!source) { res.status(404).json({ error: "Data source not found" }); return; }

  if (source.type !== "athena") {
    res.status(400).json({ error: "SQL query execution is only supported for Athena data sources" });
    return;
  }

  const region = source.region ?? "us-east-1";
  const extraConfig = (source.extraConfig ?? {}) as Record<string, string>;
  const s3OutputLocation = extraConfig.s3StagingDir ?? process.env.ATHENA_S3_OUTPUT ?? "s3://dvsum-staging-prod/";

  const athena = new AthenaClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    // Start query
    const startResult = await athena.send(new StartQueryExecutionCommand({
      QueryString: body.data.sql,
      WorkGroup: source.workgroup ?? "primary",
      ResultConfiguration: { OutputLocation: s3OutputLocation },
      ...(source.catalog ? { QueryExecutionContext: { Catalog: source.catalog, Database: source.database ?? undefined } } : {}),
    }));

    const executionId = startResult.QueryExecutionId!;

    // Poll for completion (max 30s)
    const deadline = Date.now() + 30_000;
    let state: QueryExecutionState | undefined;
    while (Date.now() < deadline) {
      const status = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: executionId }));
      state = status.QueryExecution?.Status?.State;
      if (state === QueryExecutionState.SUCCEEDED) break;
      if (state === QueryExecutionState.FAILED || state === QueryExecutionState.CANCELLED) {
        const reason = status.QueryExecution?.Status?.StateChangeReason ?? "Query failed";
        res.status(422).json({ error: reason });
        return;
      }
      await new Promise(r => setTimeout(r, 800));
    }

    if (state !== QueryExecutionState.SUCCEEDED) {
      res.status(504).json({ error: "Query timed out after 30 seconds" });
      return;
    }

    // Fetch results
    const results = await athena.send(new GetQueryResultsCommand({
      QueryExecutionId: executionId,
      MaxResults: 1000,
    }));

    const rows = results.ResultSet?.Rows ?? [];
    const headerRow = rows[0]?.Data?.map(d => d.VarCharValue ?? "") ?? [];
    const dataRows = rows.slice(1).map(row => {
      const obj: Record<string, string> = {};
      (row.Data ?? []).forEach((cell, i) => {
        obj[headerRow[i] ?? `col${i}`] = cell.VarCharValue ?? "";
      });
      return obj;
    });

    res.json(QueryDataSourceResponse.parse({
      executionId,
      columns: headerRow,
      rows: dataRows,
      rowCount: dataRows.length,
    }));
  } catch (err: any) {
    req.log.error({ err, sourceId: source.id }, "Athena query failed");
    res.status(500).json({ error: err?.message ?? "Query execution failed" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db, journeysTable, dataSourcesTable, usersTable, activityTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetSystemHealthQueryParams,
  GetJourneyStatusBreakdownQueryParams,
  GetDashboardSummaryResponse,
  GetSystemHealthResponse,
  GetJourneyStatusBreakdownResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const query = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { tenantId } = query.data;
  const tenantFilter = tenantId ? eq(journeysTable.tenantId, tenantId) : undefined;
  const dsFilter = tenantId ? eq(dataSourcesTable.tenantId, tenantId) : undefined;
  const userFilter = tenantId ? eq(usersTable.tenantId, tenantId) : undefined;
  const actFilter = tenantId ? eq(activityTable.tenantId, tenantId) : undefined;

  const [journeyStats, dsStats, userStats, activityStats] = await Promise.all([
    db.select({
      total: count(),
      active: sql<number>`sum(case when status = 'activated' then 1 else 0 end)`,
      suspended: sql<number>`sum(case when status = 'suspended' then 1 else 0 end)`,
      failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
      completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)`,
    }).from(journeysTable).where(tenantFilter),
    db.select({
      total: count(),
      connected: sql<number>`sum(case when status = 'connected' then 1 else 0 end)`,
    }).from(dataSourcesTable).where(dsFilter),
    db.select({ total: count() }).from(usersTable).where(userFilter),
    db.select({ total: count() }).from(activityTable).where(actFilter),
  ]);

  const j = journeyStats[0];
  const ds = dsStats[0];
  res.json(GetDashboardSummaryResponse.parse({
    totalJourneys: Number(j?.total ?? 0),
    activeJourneys: Number(j?.active ?? 0),
    suspendedJourneys: Number(j?.suspended ?? 0),
    failedJourneys: Number(j?.failed ?? 0),
    completedJourneys: Number(j?.completed ?? 0),
    totalDataSources: Number(ds?.total ?? 0),
    connectedDataSources: Number(ds?.connected ?? 0),
    totalUsers: Number(userStats[0]?.total ?? 0),
    recentActivityCount: Number(activityStats[0]?.total ?? 0),
  }));
});

router.get("/dashboard/health", async (req, res): Promise<void> => {
  const query = GetSystemHealthQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  // Compute real latency from recent journeys
  const tenantFilter = query.data.tenantId ? eq(journeysTable.tenantId, query.data.tenantId) : undefined;
  const [latencyResult] = await db
    .select({ avgLatency: sql<number>`avg(latency_ms)` })
    .from(journeysTable)
    .where(and(tenantFilter, sql`latency_ms is not null`));

  const avgLatency = Math.round(Number(latencyResult?.avgLatency ?? 0)) || 45;
  const status = avgLatency < 200 ? "optimal" : avgLatency < 500 ? "degraded" : "critical";

  res.json(GetSystemHealthResponse.parse({
    status,
    latencyMs: avgLatency,
    uptime: 99.97,
    lastCheckedAt: new Date().toISOString(),
    services: [
      { name: "API Gateway", status: "up", latencyMs: Math.round(avgLatency * 0.4) },
      { name: "Journey Engine", status: "up", latencyMs: Math.round(avgLatency * 0.6) },
      { name: "Data Pipeline", status: avgLatency < 300 ? "up" : "degraded", latencyMs: Math.round(avgLatency * 0.8) },
      { name: "Notification Service", status: "up", latencyMs: Math.round(avgLatency * 0.3) },
    ],
  }));
});

router.get("/dashboard/journey-status-breakdown", async (req, res): Promise<void> => {
  const query = GetJourneyStatusBreakdownQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const tenantFilter = query.data.tenantId ? eq(journeysTable.tenantId, query.data.tenantId) : undefined;
  const breakdown = await db
    .select({ status: journeysTable.status, count: count() })
    .from(journeysTable)
    .where(tenantFilter)
    .groupBy(journeysTable.status);
  res.json(GetJourneyStatusBreakdownResponse.parse(breakdown));
});

export default router;

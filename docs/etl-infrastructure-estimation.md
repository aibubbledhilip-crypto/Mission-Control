# Mission Control — ETL Infrastructure Estimation
**Document Version:** 1.0  
**Date:** May 2026  
**Prepared for:** Mission Control Platform Team  
**Scope:** Transitioning from live Athena queries to a dedicated ETL data ingestion engine backed by a local PostgreSQL application database.

---

## 1. Executive Summary

Mission Control currently executes SQL queries against AWS Athena at runtime — once per node, per user action, per journey execution. This incurs per-query Athena costs, introduces network latency into every UI interaction, and creates a direct dependency on Athena availability for the platform to function.

This document proposes replacing live Athena queries with a scheduled ETL (Extract, Transform, Load) engine that pulls data from Athena on a configurable schedule, transforms and normalises it, and stores it in a local PostgreSQL database. Mission Control then reads from this local database, making the platform faster, cheaper, and more resilient.

---

## 2. Current Architecture

```
User Action (UI)
      │
      ▼
API Server (Express)
      │
      ▼
AWS Athena ──── S3 Data Lake
      │
      ▼
Query Result → Node Pass/Fail Evaluation
```

### Current Pain Points

| Issue | Impact |
|---|---|
| Every node query hits Athena live | High per-query cost at scale |
| Athena query latency (2–30 seconds) | Slow UI; poor user experience |
| Athena availability dependency | Platform down if Athena is unavailable |
| No data caching or persistence | Same data re-fetched repeatedly |
| Cost scales with user count | 10 users × 20 queries/day = significant Athena spend |

---

## 3. Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                           │
│                                                         │
│   AWS Athena ──── S3 Data Lake                         │
│         │                                               │
│         │  [Scheduled ETL Engine — hourly/daily]        │
│         ▼                                               │
│   ETL Worker (Lambda / Cron)                           │
│         │  Extract → Transform → Load                   │
│         ▼                                               │
│   PostgreSQL (Application DB)  ◄── Mission Control     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### How It Works

1. **Extract**: ETL engine runs Athena queries on a schedule (e.g. every hour or daily).
2. **Transform**: Results are cleaned, normalised, and mapped to the Mission Control schema.
3. **Load**: Processed data is upserted into the PostgreSQL application database.
4. **Serve**: Mission Control reads from PostgreSQL — no Athena connection at runtime.

### Benefits

| Benefit | Detail |
|---|---|
| **Speed** | PostgreSQL queries return in milliseconds vs Athena's 2–30 seconds |
| **Cost reduction** | Athena queried once per cycle, not once per user action |
| **Resilience** | Platform works even if Athena is temporarily unavailable |
| **Data control** | Local data can be indexed, cached, and optimised |
| **Audit trail** | Every ETL run logged with timestamps and row counts |

---

## 4. Infrastructure Tiers

Three tiers are defined based on data volume, refresh frequency, and user concurrency. Each tier is a complete, production-ready setup.

---

### Tier 1 — Lightweight (Same Server + Cron Job)

**Best suited for:** Small data volumes (<5 GB), daily refresh, <10 concurrent users, minimal budget.

**How it works:** A Node.js or Python ETL script is added to the existing Lightsail instance and scheduled via cron. Results are stored in the existing Lightsail managed PostgreSQL, which is resized to accommodate ingested data.

#### Infrastructure Components

| Component | Specification | Provider | Monthly Cost |
|---|---|---|---|
| ETL Cron Script | Node.js process, runs on existing Lightsail instance | AWS Lightsail | $0 (shared) |
| Lightsail Instance (existing) | 2 vCPU, 4 GB RAM | AWS Lightsail | $20 (existing) |
| Lightsail PostgreSQL (resize) | Upgrade from 1 GB to 16 GB storage plan | AWS Lightsail | +$10 |
| Athena Queries (scheduled) | ~100 GB/month scanned at $5/TB | AWS Athena | $0.50 |
| S3 Athena Results Staging | Athena writes query results here | AWS S3 | $0.50 |
| **TOTAL ADDITIONAL COST** | | | **~$11/month** |

#### Limitations

- ETL process shares CPU and memory with the live application — heavy data pulls may impact UI responsiveness.
- No retry logic or dead-letter queue — failed ETL runs require manual intervention.
- Not suitable if data volume exceeds 10 GB or refresh frequency is more than 4× per day.

---

### Tier 2 — Dedicated ETL Worker (Recommended)

**Best suited for:** Medium data volumes (5–50 GB), hourly refresh, 10–50 concurrent users, production workload.

**How it works:** The ETL engine runs as an AWS Lambda function triggered by Amazon EventBridge Scheduler on a configurable cron schedule. Results are staged in S3, then loaded into an upgraded Lightsail PostgreSQL instance. The Mission Control API server is unchanged — it simply reads from the local PostgreSQL.

#### Infrastructure Components

| Component | Specification | Provider | Monthly Cost |
|---|---|---|---|
| AWS Lambda (ETL Engine) | 512 MB RAM, up to 15-min timeout, ~720 invocations/month (hourly) | AWS Lambda | $2–5 |
| Amazon EventBridge Scheduler | Triggers Lambda on cron schedule | AWS EventBridge | Free (first 14M invocations/month) |
| S3 Staging Bucket | Stores Athena results before load | AWS S3 | $1–3 |
| Lightsail PostgreSQL (upgrade) | Upgrade to 100 GB storage plan | AWS Lightsail | $60 |
| Athena Queries (batched) | ~500 GB/month scanned at $5/TB | AWS Athena | $2.50 |
| CloudWatch Logs | Lambda execution logs and ETL run history | AWS CloudWatch | $1–2 |
| SNS Alerts | Email/SMS alerts on ETL failure | AWS SNS | $0.50 |
| **TOTAL ADDITIONAL COST** | | | **~$67–73/month** |

#### Architecture Detail

```
EventBridge Scheduler (cron: 0 * * * *)
      │
      ▼
AWS Lambda — ETL Engine
  ├── Runs Athena queries via AWS SDK
  ├── Polls Athena until results ready
  ├── Downloads results from S3
  ├── Transforms rows (type coercion, normalisation)
  ├── Upserts into PostgreSQL via connection pool
  └── Logs run metadata (rows inserted, duration, errors)
      │
      ▼
PostgreSQL (Lightsail Managed DB)
  ├── etl_runs          — audit log of every ETL execution
  ├── journey_snapshots — ingested customer journey data
  ├── node_results      — pre-computed node validation results
  └── [existing tables] — sessions, users, tenants, etc.
      │
      ▼
Mission Control API (Express)
      │
      ▼
Mission Control UI (React)
```

#### Why Lambda for the ETL Engine

| Factor | Detail |
|---|---|
| **Cost** | Pay only when running — no idle compute cost |
| **Timeout** | Up to 15 minutes — sufficient for most ETL jobs |
| **Scalability** | Scales automatically if multiple jobs need to run in parallel |
| **Reliability** | Built-in retry on failure, dead-letter queue support |
| **Monitoring** | Native CloudWatch integration, logs every invocation |
| **Deployment** | Deploy with a single command, no server management |

---

### Tier 3 — Enterprise Pipeline

**Best suited for:** Large data volumes (>50 GB), sub-hourly refresh, 50+ concurrent users, multi-tenant deployments, SLA requirements.

**How it works:** AWS Glue (managed Apache Spark) handles large-scale ETL with automatic parallelism. Data is stored in RDS Aurora PostgreSQL for high availability and read replicas. ElastiCache Redis provides a caching layer for frequently accessed query results. AWS Step Functions orchestrate multi-step ETL workflows with branching and error handling.

#### Infrastructure Components

| Component | Specification | Provider | Monthly Cost |
|---|---|---|---|
| AWS Glue (ETL) | 2 DPU standard workers, ~100 hours/month | AWS Glue | $88 |
| AWS Step Functions | Orchestrate Glue jobs and Lambda steps | AWS Step Functions | $5–15 |
| Amazon EventBridge | Trigger workflows on schedule | AWS EventBridge | Free |
| RDS Aurora PostgreSQL | db.t3.medium, Multi-AZ, 100 GB storage | AWS RDS | $150–200 |
| ElastiCache Redis | cache.t3.micro, 1 node | AWS ElastiCache | $25–40 |
| S3 Data Staging | Glue job temp storage + Athena results | AWS S3 | $5–10 |
| Athena Queries (batched) | ~2 TB/month scanned | AWS Athena | $10 |
| CloudWatch + Dashboards | Metrics, alarms, ETL run dashboard | AWS CloudWatch | $10–20 |
| AWS Secrets Manager | DB credentials, Athena keys | AWS Secrets Manager | $1–2 |
| SNS + PagerDuty | On-call alerts for ETL failures | AWS SNS | $1 |
| **TOTAL ADDITIONAL COST** | | | **~$295–386/month** |

#### When to Choose Tier 3

- Data volume per ETL run exceeds 10 GB
- Multiple Athena databases/workgroups need to be ingested
- Business requires <15-minute data freshness
- Multiple tenants with isolated data requirements
- Compliance/audit requirements for data lineage

---

## 5. Cost Comparison Summary

| | Tier 1 | Tier 2 (Recommended) | Tier 3 |
|---|---|---|---|
| **Setup complexity** | Low | Medium | High |
| **Max data volume** | ~5 GB | ~50 GB | Unlimited |
| **Min refresh interval** | 6 hours | 15 minutes | 5 minutes |
| **Concurrent users** | <10 | 10–50 | 50+ |
| **Additional monthly cost** | ~$11 | ~$70 | ~$340 |
| **Athena cost (before ETL)** | ~$30–150 | ~$30–150 | ~$30–150 |
| **Athena cost (after ETL)** | ~$1–5 | ~$3–10 | ~$10–20 |
| **Net monthly saving** | ~$20–145 | ~$20–145 | ~$10–130 |

> **Note:** Athena savings depend on current query volume. The more Athena queries your users currently trigger, the greater the saving from batching them into a single ETL run.

---

## 6. Athena Cost Savings Analysis

### Current Estimated Athena Spend (Before ETL)

| Metric | Estimate |
|---|---|
| Active users | 10 |
| Node queries per user per day | 20 |
| Average data scanned per query | 500 MB |
| Total data scanned per day | 10 users × 20 queries × 500 MB = 100 GB |
| Total data scanned per month | ~3 TB |
| **Monthly Athena cost** | **3 TB × $5 = $15–75** (depending on compression) |

### After ETL (Tier 2)

| Metric | Estimate |
|---|---|
| ETL runs per day | 24 (hourly) |
| Average data scanned per run | 5 GB |
| Total data scanned per month | 24 × 30 × 5 GB = 3.6 TB |
| **Monthly Athena cost** | **~$18** |

> The ETL approach queries Athena the same amount of data, but it is fetched once and shared by all users — instead of every user triggering their own Athena scan independently.

---

## 7. ETL Engine — Technical Specification

### Core Functions

| Function | Description |
|---|---|
| `extractFromAthena(query, workgroup)` | Submits query to Athena, polls until complete, returns S3 result path |
| `downloadResults(s3Path)` | Downloads CSV result file from S3 |
| `transformRows(rows, schema)` | Type coercion, null handling, column mapping |
| `loadToPostgres(table, rows, conflictKey)` | Upserts rows into target table using `ON CONFLICT DO UPDATE` |
| `logEtlRun(metadata)` | Records run in `etl_runs` audit table |
| `sendAlert(error)` | Publishes failure notification to SNS topic |

### Database Schema Additions

```sql
-- ETL run audit log
CREATE TABLE etl_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running', -- running | success | failed
  rows_upserted INTEGER,
  duration_ms   INTEGER,
  error_message TEXT,
  triggered_by  TEXT DEFAULT 'scheduler'
);

-- Ingested journey snapshot data
CREATE TABLE journey_snapshots (
  id           SERIAL PRIMARY KEY,
  account_id   TEXT NOT NULL,
  tenant_id    INTEGER REFERENCES tenants(id),
  snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data         JSONB NOT NULL,
  etl_run_id   INTEGER REFERENCES etl_runs(id)
);

-- Indexes for fast lookup
CREATE INDEX idx_journey_snapshots_account  ON journey_snapshots(account_id);
CREATE INDEX idx_journey_snapshots_tenant   ON journey_snapshots(tenant_id);
CREATE INDEX idx_journey_snapshots_snapshot ON journey_snapshots(snapshot_at DESC);
```

### ETL Run Schedule Options

| Frequency | Use Case | EventBridge Cron |
|---|---|---|
| Every 15 minutes | Near-real-time | `rate(15 minutes)` |
| Hourly | Standard operational | `rate(1 hour)` |
| Every 6 hours | Batch / reporting | `cron(0 0,6,12,18 * * ? *)` |
| Daily at midnight | Low-frequency / cost-optimised | `cron(0 0 * * ? *)` |

---

## 8. Implementation Roadmap

| Phase | Scope | Effort | Duration |
|---|---|---|---|
| **Phase 1** | Schema additions to PostgreSQL; ETL audit log table | Low | 1 day |
| **Phase 2** | Lambda ETL function: Athena extract → S3 → PostgreSQL load | Medium | 3–5 days |
| **Phase 3** | EventBridge schedule + SNS failure alerting | Low | 1 day |
| **Phase 4** | Update Mission Control API to read from local DB tables | Medium | 2–3 days |
| **Phase 5** | Testing, dry-run ETL, validate data parity with live Athena | Medium | 2 days |
| **Phase 6** | Cutover — disable live Athena queries, enable ETL reads | Low | 0.5 day |

**Total estimated build time:** 9–12 working days

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ETL job fails silently | Medium | High | SNS alert + CloudWatch alarm on Lambda error metric |
| Stale data shown in UI | Medium | Medium | Show "last updated" timestamp on all dashboard pages |
| PostgreSQL storage fills up | Low | High | Set CloudWatch alarm at 80% storage capacity |
| Athena schema change breaks ETL | Medium | High | ETL includes column validation before load; alerts on schema mismatch |
| Lambda timeout on large dataset | Low | Medium | Increase Lambda memory (up to 10 GB); paginate Athena results |
| Concurrent ETL runs overwrite data | Low | Medium | EventBridge does not overlap invocations; add DynamoDB lock if needed |

---

## 10. Recommendation

**Proceed with Tier 2** as the initial production deployment.

- Monthly additional cost of ~$70 is offset by Athena savings within the first month
- Lambda-based ETL is serverless, low-maintenance, and easy to upgrade to Tier 3
- Hourly refresh is sufficient for telecom journey monitoring use cases
- No new servers to manage — EventBridge, Lambda, and S3 are fully managed
- The Mission Control codebase requires minimal changes on the API side — only the data source for node SQL queries changes from Athena to PostgreSQL

Upgrade to Tier 3 (Glue + Aurora) only when data volume exceeds 20 GB per ETL run or when sub-15-minute freshness is required.

---

## 11. Next Steps

1. Confirm data volume: How many GB does a single full Athena pull return?
2. Confirm refresh frequency: How often does the data need to be updated?
3. Confirm alerting contacts: Who should receive ETL failure notifications?
4. Approve Tier 2 infrastructure → begin Phase 1 implementation.

---

*Document prepared by: Mission Control Engineering*  
*Classification: Internal — Infrastructure Planning*

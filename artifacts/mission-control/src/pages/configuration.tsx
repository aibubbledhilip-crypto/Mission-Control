import { useState, useEffect, useCallback } from "react";
import {
  SlidersHorizontal, Plus, X, Database, Code2, Users, Pencil, ChevronDown, ChevronRight,
  Play, Check, AlertCircle, Loader2, GripVertical, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListDataSources, useGetCurrentUser, useQueryDataSource } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JourneyConfigType = "sql" | "manual";

export interface JourneyConfig {
  id: string;
  name: string;
  color: string;
  type: JourneyConfigType;
  sql?: string;
  dataSourceId?: number;
  /** resolved account IDs — populated after running SQL or from manual list */
  accountIds: string[];
  /** column from SQL results that maps to accountId */
  accountColumn?: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunError?: string;
}

const COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

const CONFIG_KEY = "mc-journey-configs-v2";

export function loadJourneyConfigs(): JourneyConfig[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveJourneyConfigs(cfgs: JourneyConfig[]) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfgs));
}

function newConfig(idx: number): JourneyConfig {
  return {
    id: crypto.randomUUID(),
    name: `Group ${idx + 1}`,
    color: COLORS[idx % COLORS.length],
    type: "manual",
    sql: "",
    accountIds: [],
    accountColumn: "bancan",
    enabled: true,
  };
}

// ─── Config Card ──────────────────────────────────────────────────────────────

function ConfigCard({
  config,
  onChange,
  onDelete,
  dataSources,
}: {
  config: JourneyConfig;
  onChange: (updated: JourneyConfig) => void;
  onDelete: () => void;
  dataSources: any[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [newAccountId, setNewAccountId] = useState("");
  const [previewRows, setPreviewRows] = useState<Record<string, string>[] | null>(null);
  const [previewCols, setPreviewCols] = useState<string[]>([]);

  const queryMutation = useQueryDataSource();

  function addAccountId() {
    const val = newAccountId.trim();
    if (!val || config.accountIds.includes(val)) { setNewAccountId(""); return; }
    onChange({ ...config, accountIds: [...config.accountIds, val] });
    setNewAccountId("");
  }

  function removeAccountId(id: string) {
    onChange({ ...config, accountIds: config.accountIds.filter(a => a !== id) });
  }

  function runQuery() {
    if (!config.dataSourceId || !config.sql?.trim()) return;
    queryMutation.mutate(
      { id: config.dataSourceId, data: { sql: config.sql } },
      {
        onSuccess: (result) => {
          setPreviewCols(result.columns);
          setPreviewRows(result.rows.slice(0, 10));
          // Extract accountIds from the designated column
          const col = config.accountColumn ?? result.columns[0] ?? "";
          const ids = result.rows.map(r => r[col] ?? "").filter(Boolean);
          onChange({
            ...config,
            accountIds: ids,
            lastRunAt: new Date().toISOString(),
            lastRunError: undefined,
          });
        },
        onError: (err: any) => {
          onChange({
            ...config,
            lastRunError: err?.message ?? "Query failed",
            lastRunAt: new Date().toISOString(),
          });
        },
      }
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      {/* Card Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: config.color }} />
        <span className="font-medium text-white flex-1 truncate">{config.name}</span>
        <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground shrink-0">
          {config.type === "sql" ? "SQL" : "Manual"} · {config.accountIds.length} accounts
        </Badge>
        <button
          onClick={e => { e.stopPropagation(); onChange({ ...config, enabled: !config.enabled }); }}
          className={cn(
            "shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors",
            config.enabled
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              : "border-border text-muted-foreground hover:text-white"
          )}
        >
          {config.enabled ? "ON" : "OFF"}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t border-border/30">
          <div className="grid grid-cols-2 gap-3 pt-4">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Group Name</Label>
              <Input
                value={config.name}
                onChange={e => onChange({ ...config, name: e.target.value })}
                className="bg-black/50 border-border text-white h-8 text-sm"
              />
            </div>
            {/* Color */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => onChange({ ...config, color: c })}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all",
                      config.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-card scale-110" : "opacity-70 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Type toggle */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Source Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => onChange({ ...config, type: "sql" })}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                  config.type === "sql"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <Code2 className="w-3.5 h-3.5" /> SQL Query
              </button>
              <button
                onClick={() => onChange({ ...config, type: "manual" })}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                  config.type === "manual"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <Users className="w-3.5 h-3.5" /> Manual List
              </button>
            </div>
          </div>

          {/* SQL mode */}
          {config.type === "sql" && (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Data Source</Label>
                <Select
                  value={config.dataSourceId?.toString() ?? ""}
                  onValueChange={v => onChange({ ...config, dataSourceId: parseInt(v) })}
                >
                  <SelectTrigger className="bg-black/50 border-border text-white h-8 text-xs">
                    <SelectValue placeholder="Select a connected data source" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {dataSources.map(ds => (
                      <SelectItem key={ds.id} value={ds.id.toString()} className="text-xs">
                        <span className="flex items-center gap-2">
                          <Database className="w-3 h-3" />
                          {ds.name}
                          <Badge variant="outline" className="text-[9px] ml-1 border-border/50">{ds.type}</Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">SQL Query</Label>
                <Textarea
                  value={config.sql ?? ""}
                  onChange={e => onChange({ ...config, sql: e.target.value })}
                  placeholder={`SELECT bancan, pr_msisdn__c, orderid, status\nFROM "dvsum-s3-glue-prod"."vw_sf_order"\nWHERE DATE(try_cast(created_ts AS timestamp)) >= CURRENT_DATE - INTERVAL '3' DAY`}
                  className="bg-black/60 border-border text-white text-xs font-mono resize-none min-h-[120px]"
                  rows={6}
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Account ID Column</Label>
                <Input
                  value={config.accountColumn ?? "bancan"}
                  onChange={e => onChange({ ...config, accountColumn: e.target.value })}
                  className="bg-black/50 border-border text-white h-8 text-sm font-mono"
                  placeholder="bancan"
                />
                <p className="text-[10px] text-muted-foreground">
                  Column in the result set that maps to the customer account ID.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={runQuery}
                  disabled={!config.dataSourceId || !config.sql?.trim() || queryMutation.isPending}
                  className="h-8"
                >
                  {queryMutation.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 mr-1" />
                  )}
                  {queryMutation.isPending ? "Running…" : "Run & Apply"}
                </Button>
                {config.lastRunAt && !config.lastRunError && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {config.accountIds.length} accounts loaded · {new Date(config.lastRunAt).toLocaleTimeString()}
                  </span>
                )}
                {config.lastRunError && (
                  <span className="text-[10px] text-red-400 flex items-center gap-1 truncate">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {config.lastRunError}
                  </span>
                )}
              </div>

              {/* Preview */}
              {previewRows && previewRows.length > 0 && (
                <div className="rounded-md border border-border/50 overflow-auto max-h-40 text-xs">
                  <table className="w-full min-w-max">
                    <thead className="bg-card/80 border-b border-border/50 sticky top-0">
                      <tr>
                        {previewCols.map(c => (
                          <th key={c} className="px-3 py-1.5 text-left font-medium text-muted-foreground font-mono">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-white/5">
                          {previewCols.map(c => (
                            <td key={c} className="px-3 py-1 font-mono text-white/80 truncate max-w-[160px]">{row[c] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Manual mode */}
          {config.type === "manual" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter account ID, e.g. B0/P0/0001Ye8IAP"
                  value={newAccountId}
                  onChange={e => setNewAccountId(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addAccountId(); }}
                  className="bg-black/50 border-border text-white font-mono text-xs flex-1 h-8"
                />
                <Button size="sm" onClick={addAccountId} disabled={!newAccountId.trim()} className="h-8">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              {config.accountIds.length === 0 ? (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-black/20 rounded-md p-3 border border-border/30">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  No account IDs added yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {config.accountIds.map(id => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="font-mono text-[10px] py-0.5 px-2 flex items-center gap-1 border-border/50"
                      style={{ color: config.color, borderColor: config.color + "40" }}
                    >
                      {id}
                      <button onClick={() => removeAccountId(id)} className="hover:text-red-400 ml-0.5 transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Configuration() {
  const [configs, setConfigs] = useState<JourneyConfig[]>(loadJourneyConfigs);
  const [saved, setSaved] = useState(false);
  const { data: user } = useGetCurrentUser();
  const { data: dsData } = useListDataSources({ tenantId: user?.tenantId });
  const dataSources = dsData ?? [];

  const persist = useCallback((cfgs: JourneyConfig[]) => {
    saveJourneyConfigs(cfgs);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  useEffect(() => { persist(configs); }, [configs, persist]);

  function addConfig() {
    setConfigs(cs => [...cs, newConfig(cs.length)]);
  }

  function updateConfig(id: string, updated: JourneyConfig) {
    setConfigs(cs => cs.map(c => c.id === id ? updated : c));
  }

  function deleteConfig(id: string) {
    setConfigs(cs => cs.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            Configuration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Define customer groups that appear in the Active Journeys panel. Each group can pull accounts from SQL or a manual list.
          </p>
        </div>
        <Button onClick={addConfig} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> New Group
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl">
          <SlidersHorizontal className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm">No groups configured yet.</p>
          <p className="text-xs mt-1">Click "New Group" to create your first customer group.</p>
          <Button onClick={addConfig} variant="outline" className="mt-4 border-border hover:bg-white/5">
            <Plus className="w-4 h-4 mr-2" /> Create First Group
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              onChange={updated => updateConfig(cfg.id, updated)}
              onDelete={() => deleteConfig(cfg.id)}
              dataSources={dataSources}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className={`w-2 h-2 rounded-full transition-colors ${saved ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-transparent"}`} />
        {saved ? "Saved" : `${configs.length} group${configs.length === 1 ? "" : "s"} configured`}
      </div>
    </div>
  );
}

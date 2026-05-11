import { useState, useEffect, useCallback } from "react";
import {
  SlidersHorizontal, Plus, X, Database, Code2, Users, ChevronDown, ChevronRight,
  Play, Check, AlertCircle, Loader2, Info, GitBranch,
  Cloud, Zap, Radio, Globe, Server, Shield, Users2, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListDataSources, useGetCurrentUser, useQueryDataSource } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  type JourneyConfig,
  type FlowNode,
  type NodeIcon,
  COLORS,
  loadJourneyConfigs,
  saveJourneyConfigs,
  newConfig,
  newFlowNode,
} from "@/lib/journey-configs";

export type { JourneyConfig } from "@/lib/journey-configs";

// ─── Icon Registry ────────────────────────────────────────────────────────────

export const ICON_OPTIONS: { id: NodeIcon; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "account",    label: "Account",    Icon: Users2 },
  { id: "salesforce", label: "Salesforce", Icon: Cloud },
  { id: "matrixx",    label: "Matrixx",    Icon: Zap },
  { id: "aria",       label: "Aria",       Icon: Radio },
  { id: "oracle",     label: "Oracle",     Icon: Database },
  { id: "database",   label: "Database",   Icon: Database },
  { id: "api",        label: "API",        Icon: Globe },
  { id: "server",     label: "Server",     Icon: Server },
  { id: "cloud",      label: "Cloud",      Icon: Cloud },
  { id: "shield",     label: "Shield",     Icon: Shield },
  { id: "check",      label: "Check",      Icon: CircleDot },
];

export const ICON_MAP: Record<NodeIcon, React.FC<{ className?: string }>> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.id, o.Icon])
) as Record<NodeIcon, React.FC<{ className?: string }>>;

// ─── Node Editor Row ──────────────────────────────────────────────────────────

function NodeEditorRow({
  node,
  allNodes,
  onChange,
  onDelete,
  dataSources,
  defaultDataSourceId,
}: {
  node: FlowNode;
  allNodes: FlowNode[];
  onChange: (updated: FlowNode) => void;
  onDelete: () => void;
  dataSources: any[];
  defaultDataSourceId?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const NodeIcon = ICON_MAP[node.icon] ?? Database;
  const parent = allNodes.find(n => n.id === node.parentNodeId);
  const otherNodes = allNodes.filter(n => n.id !== node.id);

  const effectiveDsId = node.dataSourceId ?? defaultDataSourceId;

  return (
    <div className="rounded-lg border border-border/40 bg-black/20 overflow-hidden">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-full border border-border/60 bg-black/50 flex items-center justify-center shrink-0">
          <NodeIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">{node.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {parent ? <span>↳ {parent.name}</span> : <span className="text-primary/70">Root node</span>}
            {node.sql?.trim() && <span className="ml-2 text-emerald-500/70">· SQL</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
          {/* Name + Icon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Node Name</Label>
              <Input
                value={node.name}
                onChange={e => onChange({ ...node, name: e.target.value })}
                className="bg-black/50 border-border text-white h-8 text-sm"
                placeholder="e.g. Salesforce Check"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Parent Node</Label>
              <Select
                value={node.parentNodeId ?? "__root__"}
                onValueChange={v => onChange({ ...node, parentNodeId: v === "__root__" ? null : v })}
              >
                <SelectTrigger className="bg-black/50 border-border text-white h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__root__" className="text-xs text-primary">
                    ◉ Root (no parent)
                  </SelectItem>
                  {otherNodes.map(n => {
                    const NIcon = ICON_MAP[n.icon] ?? Database;
                    return (
                      <SelectItem key={n.id} value={n.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <NIcon className="w-3 h-3" /> {n.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Icon picker */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  title={label}
                  onClick={() => onChange({ ...node, icon: id })}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                    node.icon === id
                      ? "border-primary bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "border-border/50 bg-black/30 text-muted-foreground hover:border-border hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Data Source */}
          <div className="grid gap-1.5">
            <Label className="text-xs">
              Data Source
              {!node.dataSourceId && defaultDataSourceId && (
                <span className="ml-2 text-muted-foreground/60">(inheriting from group)</span>
              )}
            </Label>
            <Select
              value={node.dataSourceId?.toString() ?? "__inherit__"}
              onValueChange={v => onChange({ ...node, dataSourceId: v === "__inherit__" ? undefined : parseInt(v) })}
            >
              <SelectTrigger className="bg-black/50 border-border text-white h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__inherit__" className="text-xs text-muted-foreground">
                  ↑ Inherit from group
                </SelectItem>
                {dataSources.map((ds: any) => (
                  <SelectItem key={ds.id} value={ds.id.toString()} className="text-xs">
                    <span className="flex items-center gap-2">
                      <Database className="w-3 h-3" /> {ds.name}
                      <Badge variant="outline" className="text-[9px] border-border/50">{ds.type}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SQL */}
          <div className="grid gap-1.5">
            <Label className="text-xs">
              SQL Query
              <span className="ml-2 text-muted-foreground/60 font-normal">use {"{{bancan}}"} for account ID</span>
            </Label>
            <Textarea
              value={node.sql ?? ""}
              onChange={e => onChange({ ...node, sql: e.target.value })}
              placeholder={`SELECT * FROM "my_db"."orders"\nWHERE bancan = '{{bancan}}'\nLIMIT 1`}
              className="bg-black/60 border-border text-white text-xs font-mono resize-none min-h-[90px]"
              rows={4}
            />
          </div>

          {/* Validation */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Pass Condition</Label>
            <div className="flex gap-2">
              {(["rowCount > 0", "rowCount === 0"] as const).map(val => (
                <button
                  key={val}
                  onClick={() => onChange({ ...node, validation: val })}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md border text-xs font-mono transition-all",
                    node.validation === val
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "border-border text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {node.validation === "rowCount > 0"
                ? "Node is GREEN when the query returns at least one row."
                : "Node is GREEN when the query returns zero rows."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  const flowNodes = config.flowNodes ?? [];

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
          const col = config.accountColumn ?? result.columns[0] ?? "";
          const ids = result.rows.map(r => r[col] ?? "").filter(Boolean);
          onChange({
            ...config,
            accountIds: ids,
            rawRows: result.rows,
            rawColumns: result.columns,
            rowCount: result.rowCount,
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

  function addNode() {
    const updated: FlowNode = newFlowNode({
      name: `Node ${flowNodes.length + 1}`,
      dataSourceId: config.dataSourceId,
    });
    onChange({ ...config, flowNodes: [...flowNodes, updated] });
  }

  function updateNode(id: string, updated: FlowNode) {
    onChange({ ...config, flowNodes: flowNodes.map(n => n.id === id ? updated : n) });
  }

  function deleteNode(id: string) {
    onChange({ ...config, flowNodes: flowNodes.filter(n => n.id !== id) });
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
        {flowNodes.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
            <GitBranch className="w-2.5 h-2.5 mr-1" />{flowNodes.length} nodes
          </Badge>
        )}
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
          {/* ── Group Settings ── */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Group Name</Label>
              <Input
                value={config.name}
                onChange={e => onChange({ ...config, name: e.target.value })}
                className="bg-black/50 border-border text-white h-8 text-sm"
              />
            </div>
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
              {[
                { value: "sql", icon: Code2, label: "SQL Query" },
                { value: "manual", icon: Users, label: "Manual List" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => onChange({ ...config, type: value as JourneyConfig["type"] })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                    config.type === value
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
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
                    {dataSources.map((ds: any) => (
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
                  Column that maps to the customer account ID, used as {"{{bancan}}"} in node SQL.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={runQuery}
                  disabled={!config.dataSourceId || !config.sql?.trim() || queryMutation.isPending}
                  className="h-8"
                >
                  {queryMutation.isPending
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <Play className="w-3 h-3 mr-1" />}
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

          {/* ── Flow Nodes ── */}
          <div className="border-t border-border/30 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold">Flow Nodes</Label>
                {flowNodes.length > 0 && (
                  <Badge variant="outline" className="text-[9px] border-border/50">{flowNodes.length}</Badge>
                )}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-border hover:bg-white/5" onClick={addNode}>
                <Plus className="w-3 h-3 mr-1" /> Add Node
              </Button>
            </div>

            {flowNodes.length === 0 ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-black/20 rounded-md p-3 border border-dashed border-border/30">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Add nodes to display a flow graph in the Journeys view. Each node can run a SQL check per account — shown green (pass) or red (fail).
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {flowNodes.map(node => (
                  <NodeEditorRow
                    key={node.id}
                    node={node}
                    allNodes={flowNodes}
                    onChange={updated => updateNode(node.id, updated)}
                    onDelete={() => deleteNode(node.id)}
                    dataSources={dataSources}
                    defaultDataSourceId={config.dataSourceId}
                  />
                ))}
              </div>
            )}
          </div>
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
            Define customer groups and flow node graphs that appear in the Active Journeys panel.
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

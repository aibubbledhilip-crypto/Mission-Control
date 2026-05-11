import { useState, useEffect } from "react";
import {
  useListJourneys,
  useGetCurrentUser,
  useGetJourney,
  useSuspendJourney,
  useResumeJourney,
  getGetJourneyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Route,
  Activity,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Maximize,
  Minimize,
  X,
  Database,
  Clock,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { loadJourneyConfigs, type JourneyConfig } from "@/lib/journey-configs";
import type { Journey } from "@workspace/api-client-react";

// ─── Flow Canvas ──────────────────────────────────────────────────────────────

function FlowCanvas({ nodes, onNodeClick, selectedNodeId }: {
  nodes: any[];
  onNodeClick: (id: number) => void;
  selectedNodeId: number | null;
}) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0f18] rounded-xl border border-border/50">
        <div className="text-center text-muted-foreground">
          <Route className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No nodes in this journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0f18] rounded-xl border border-border/50">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {nodes.filter((n: any) => n.parentNodeId).map((node: any) => {
          const parent = nodes.find((n: any) => n.id === node.parentNodeId);
          if (!parent) return null;
          const sx = parent.positionX + 160, sy = parent.positionY + 40;
          const ex = node.positionX, ey = node.positionY + 40;
          return (
            <path
              key={`edge-${node.id}`}
              d={`M ${sx} ${sy} C ${sx + 100} ${sy}, ${ex - 100} ${ey}, ${ex} ${ey}`}
              fill="none"
              stroke="rgba(14,165,233,0.35)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      {nodes.map((node: any) => (
        <div
          key={node.id}
          onClick={() => onNodeClick(node.id)}
          className={`absolute cursor-pointer transition-all duration-200 ${
            selectedNodeId === node.id
              ? "ring-2 ring-primary ring-offset-2 ring-offset-[#0a0f18] scale-105 z-10"
              : "hover:scale-105 z-0"
          }`}
          style={{ left: node.positionX, top: node.positionY, width: 160 }}
        >
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{node.nodeType}</div>
            <div className="text-sm font-bold text-white truncate">{node.name}</div>
            <div className="mt-2 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                node.status === "passed" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" :
                node.status === "failed" ? "bg-red-500 shadow-[0_0_8px_#ef4444]" :
                node.status === "running" ? "bg-primary animate-pulse shadow-[0_0_8px_#0ea5e9]" :
                node.status === "skipped" ? "bg-slate-500" : "bg-amber-500"
              }`} />
              <span className="text-[10px] text-muted-foreground capitalize">{node.status}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DB Journey Detail Panel ──────────────────────────────────────────────────

function DbJourneyDetailPanel({ journeyId, onClose }: { journeyId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: detail, isLoading } = useGetJourney(journeyId, {
    query: { enabled: !!journeyId, queryKey: getGetJourneyQueryKey(journeyId) },
  });

  const suspendMutation = useSuspendJourney();
  const resumeMutation = useResumeJourney();

  const handleSuspend = () => {
    suspendMutation.mutate(
      { id: journeyId, data: { reason: "requested", notes: suspendReason } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJourneyQueryKey(journeyId) });
          setSuspendDialogOpen(false);
        },
      }
    );
  };

  const handleResume = () => {
    resumeMutation.mutate(
      { id: journeyId, data: { notes: "Manually resumed" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetJourneyQueryKey(journeyId) }) }
    );
  };

  const nodes = detail?.nodes ?? [];
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-48 bg-card/50 mb-2" />
          <Skeleton className="h-4 w-32 bg-card/50" />
        </div>
        <Skeleton className="flex-1 m-4 bg-card/50 rounded-xl" />
      </div>
    );
  }

  if (!detail) return null;
  const journey = detail.journey;

  const badgeClass =
    journey.status === "activated" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    journey.status === "suspended" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
    journey.status === "failed"    ? "bg-red-500/10 text-red-400 border-red-500/20" :
    "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white truncate">{journey.externalId}</span>
              <Badge variant="outline" className={badgeClass}>{journey.status.toUpperCase()}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Account: {journey.accountId}
              {journey.startedAt && <span className="ml-3">Started {format(new Date(journey.startedAt), "PP HH:mm:ss")}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {journey.status === "suspended" ? (
            <Button size="sm" onClick={handleResume} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8" disabled={resumeMutation.isPending}>
              <Play className="w-3 h-3 mr-1" /> Resume
            </Button>
          ) : journey.status !== "completed" && journey.status !== "failed" ? (
            <Button size="sm" variant="outline" onClick={() => setSuspendDialogOpen(true)} className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 h-8">
              <Pause className="w-3 h-3 mr-1" /> Suspend
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-black overflow-hidden">
          <div className="absolute top-3 right-3 z-20 flex bg-card border border-border rounded-md shadow-lg overflow-hidden">
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(50, z - 10))} className="h-7 w-7 rounded-none border-r border-border">
              <Minimize className="w-3 h-3" />
            </Button>
            <div className="flex items-center justify-center w-10 text-[11px] font-medium text-white">{zoom}%</div>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(200, z + 10))} className="h-7 w-7 rounded-none border-l border-border">
              <Maximize className="w-3 h-3" />
            </Button>
          </div>
          <div className="w-full h-full overflow-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
            <FlowCanvas nodes={nodes} onNodeClick={setSelectedNodeId} selectedNodeId={selectedNodeId} />
          </div>
        </div>

        {selectedNode && (
          <div className="w-64 border-l border-border bg-card/80 backdrop-blur overflow-y-auto flex flex-col shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-bold text-white text-sm truncate pr-2">{selectedNode.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-7 w-7 shrink-0">
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="p-3 space-y-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                <Badge variant="outline" className="bg-white/5 text-xs">{selectedNode.status.toUpperCase()}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Type</div>
                <div className="text-sm font-medium text-white">{selectedNode.nodeType}</div>
              </div>
              {selectedNode.config && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Config</div>
                  <pre className="text-xs bg-black/50 p-2 rounded-md border border-border/50 overflow-x-auto text-primary/80 font-mono">
                    {JSON.stringify(selectedNode.config, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Updated</div>
                <div className="text-xs text-white font-mono">{format(new Date(selectedNode.updatedAt), "HH:mm:ss.SSS")}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Suspend Journey</DialogTitle>
            <DialogDescription>This will pause execution. Nodes currently running will complete.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason / Notes</Label>
              <Textarea id="reason" value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="Why are you suspending this journey?" className="bg-black/50 border-border text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSuspend} disabled={suspendMutation.isPending} className="bg-amber-600 hover:bg-amber-500 text-white">
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SQL Row Detail Panel ─────────────────────────────────────────────────────

function SqlRowDetailPanel({
  row,
  columns,
  configName,
  configColor,
  onClose,
}: {
  row: Record<string, string>;
  columns: string[];
  configName: string;
  configColor: string;
  onClose: () => void;
}) {
  const orderIdCol = columns.find(c => c.toLowerCase().includes("order")) ?? columns[0] ?? "";
  const statusCol = columns.find(c => c.toLowerCase() === "status") ?? "";
  const status = statusCol ? row[statusCol] : null;

  const statusBadgeClass =
    status?.toLowerCase() === "completed" || status?.toLowerCase() === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    status?.toLowerCase() === "failed" || status?.toLowerCase() === "cancelled" ? "bg-red-500/10 text-red-400 border-red-500/20" :
    status?.toLowerCase() === "pending" || status?.toLowerCase() === "in progress" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
    "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white truncate">
                {orderIdCol ? row[orderIdCol] : Object.values(row)[0]}
              </span>
              {status && (
                <Badge variant="outline" className={`text-[10px] ${statusBadgeClass}`}>
                  {status.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: configColor }} />
              <p className="text-xs text-muted-foreground truncate">{configName}</p>
              <span className="text-muted-foreground">·</span>
              <Database className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Athena</p>
            </div>
          </div>
        </div>
      </div>

      {/* Field grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-2">
          {columns.map(col => {
            const val = row[col] ?? "";
            if (!val) return null;
            return (
              <div key={col} className="flex flex-col gap-0.5 p-3 rounded-lg bg-card/40 border border-border/40 hover:bg-card/60 transition-colors">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{col}</div>
                <div className="text-sm text-white font-mono break-all">{val}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Unified Selection ────────────────────────────────────────────────────────

type SelectedItem =
  | { kind: "db"; id: number }
  | { kind: "sql"; configId: string; rowIndex: number };

// ─── Status / Health Helpers ──────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "activated": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "suspended": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "failed":    return "bg-red-500/10 text-red-500 border-red-500/20";
    case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:          return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
}

function healthDot(health: string) {
  switch (health) {
    case "healthy":  return "text-emerald-500";
    case "degraded": return "text-amber-500";
    case "critical": return "text-red-500";
    default:         return "text-slate-500";
  }
}

// ─── DB Journey Row ───────────────────────────────────────────────────────────

function DbJourneyRow({ journey, selected, onClick }: {
  journey: Journey;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 transition-all ${
        selected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-white/5 border-l-2 border-transparent"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor] ${healthDot(journey.healthStatus)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-mono text-xs font-medium text-white truncate max-w-[140px]">{journey.externalId}</span>
            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${statusBadge(journey.status)}`}>
              {journey.status.toUpperCase()}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{journey.accountId}</div>
          {journey.latencyMs && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Activity className="w-2.5 h-2.5" />
              {journey.latencyMs}ms
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── SQL Row Item ─────────────────────────────────────────────────────────────

function SqlRowItem({ row, columns, color, selected, onClick }: {
  row: Record<string, string>;
  columns: string[];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  // Pick meaningful display columns
  const idCol = columns.find(c => c.toLowerCase().includes("order")) ?? columns[0] ?? "";
  const acctCol = columns.find(c => c.toLowerCase() === "bancan" || c.toLowerCase().includes("account")) ?? columns[1] ?? "";
  const statusCol = columns.find(c => c.toLowerCase() === "status") ?? "";
  const dateCol = columns.find(c => c.toLowerCase().includes("ts") || c.toLowerCase().includes("date") || c.toLowerCase().includes("created")) ?? "";

  const status = statusCol ? row[statusCol] : null;
  const statusColor =
    status?.toLowerCase() === "completed" || status?.toLowerCase() === "active" ? "text-emerald-400" :
    status?.toLowerCase() === "failed" || status?.toLowerCase() === "cancelled" ? "text-red-400" :
    status?.toLowerCase() === "pending" ? "text-amber-400" : "text-slate-400";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 transition-all ${
        selected ? "border-l-2 border-l-[var(--item-color)] bg-[var(--item-color-10)]" : "border-l-2 border-transparent hover:bg-white/5"
      }`}
      style={{ "--item-color": color, "--item-color-10": color + "1a" } as React.CSSProperties}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-mono text-xs font-medium text-white truncate max-w-[150px]">
              {idCol ? row[idCol] : Object.values(row)[0]}
            </span>
            {status && (
              <span className={`text-[9px] font-semibold ${statusColor}`}>
                {status.toUpperCase()}
              </span>
            )}
          </div>
          {acctCol && acctCol !== idCol && (
            <div className="text-[10px] text-muted-foreground truncate font-mono">{row[acctCol]}</div>
          )}
          {dateCol && row[dateCol] && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              <span className="truncate font-mono">{row[dateCol]}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Group Section ────────────────────────────────────────────────────────────

function SqlGroupSection({ config, selected, onSelect }: {
  config: JourneyConfig;
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = config.rawRows ?? [];
  const columns = config.rawColumns ?? [];

  if (rows.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left truncate">
          {config.name}
        </span>
        <span className="text-[9px] text-muted-foreground">{rows.length}</span>
        {config.lastRunAt && (
          <span className="text-[9px] text-muted-foreground/60 hidden sm:block">
            {format(new Date(config.lastRunAt), "HH:mm")}
          </span>
        )}
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-90" />}
      </button>
      {!collapsed && rows.map((row, i) => {
        const isSelected = selected?.kind === "sql" && selected.configId === config.id && selected.rowIndex === i;
        return (
          <SqlRowItem
            key={i}
            row={row}
            columns={columns}
            color={config.color}
            selected={isSelected}
            onClick={() => onSelect({ kind: "sql", configId: config.id, rowIndex: i })}
          />
        );
      })}
    </div>
  );
}

function DbGroupSection({ config, journeys, selected, onSelect }: {
  config: JourneyConfig | null;
  journeys: Journey[];
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (journeys.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors"
      >
        {config ? (
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
        )}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left truncate">
          {config ? config.name : "Other"}
        </span>
        <span className="text-[9px] text-muted-foreground">{journeys.length}</span>
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-90" />}
      </button>
      {!collapsed && journeys.map(j => {
        const isSelected = selected?.kind === "db" && selected.id === j.id;
        return (
          <DbJourneyRow
            key={j.id}
            journey={j}
            selected={isSelected}
            onClick={() => onSelect({ kind: "db", id: j.id })}
          />
        );
      })}
    </div>
  );
}

// ─── Main Journeys Page ───────────────────────────────────────────────────────

export default function Journeys() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [configs, setConfigs] = useState<JourneyConfig[]>(() => loadJourneyConfigs());

  // Reload configs from localStorage whenever this page is focused
  useEffect(() => {
    function onFocus() { setConfigs(loadJourneyConfigs()); }
    window.addEventListener("focus", onFocus);
    // Also poll every 2s while visible (handles same-tab navigation)
    const interval = setInterval(() => { setConfigs(loadJourneyConfigs()); }, 2000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
  }, []);

  const { data: user } = useGetCurrentUser();
  const { data: journeysData, isLoading: dbLoading } = useListJourneys({ tenantId: user?.tenantId, search });
  const allDbJourneys = journeysData?.items ?? [];

  // Separate configs into SQL-powered (have rawRows) vs manual (filter from DB)
  const sqlConfigs = configs.filter(c => c.enabled && c.type === "sql" && (c.rawRows?.length ?? 0) > 0);
  const manualConfigs = configs.filter(c => c.enabled && c.type === "manual" && c.accountIds.length > 0);

  // DB groups from manual configs
  const dbGroups: { config: JourneyConfig | null; journeys: Journey[] }[] = [];
  const assignedIds = new Set<number>();
  for (const cfg of manualConfigs) {
    const matched = allDbJourneys.filter(j => cfg.accountIds.includes(j.accountId ?? "") && !assignedIds.has(j.id));
    matched.forEach(j => assignedIds.add(j.id));
    if (matched.length > 0) dbGroups.push({ config: cfg, journeys: matched });
  }

  // If no configs at all, show all DB journeys flat
  if (sqlConfigs.length === 0 && manualConfigs.length === 0) {
    dbGroups.push({ config: null, journeys: allDbJourneys });
  } else {
    // Remaining DB journeys not claimed by any manual config
    const others = allDbJourneys.filter(j => !assignedIds.has(j.id));
    if (others.length > 0) dbGroups.push({ config: null, journeys: others });
  }

  // Total count for header
  const sqlTotal = sqlConfigs.reduce((sum, c) => sum + (c.rawRows?.length ?? 0), 0);
  const dbTotal = dbGroups.reduce((sum, g) => sum + g.journeys.length, 0);
  const total = sqlTotal + dbTotal;

  const hasSqlConfigs = sqlConfigs.length > 0;

  // Auto-select first item
  useEffect(() => {
    if (selected) return;
    if (sqlConfigs.length > 0 && (sqlConfigs[0].rawRows?.length ?? 0) > 0) {
      setSelected({ kind: "sql", configId: sqlConfigs[0].id, rowIndex: 0 });
    } else if (allDbJourneys.length > 0) {
      setSelected({ kind: "db", id: allDbJourneys[0].id });
    }
  }, [sqlConfigs.length, allDbJourneys.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the selected SQL row details
  const selectedSqlConfig = selected?.kind === "sql" ? configs.find(c => c.id === selected.configId) : null;
  const selectedSqlRow = selectedSqlConfig && selected?.kind === "sql" ? selectedSqlConfig.rawRows?.[selected.rowIndex] : null;

  // Filter SQL rows by search
  function rowMatchesSearch(row: Record<string, string>) {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(row).some(v => v?.toLowerCase().includes(q));
  }

  return (
    <div className="-m-6 md:-m-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Journeys List Panel ── */}
      <div className={`flex flex-col border-r border-border bg-[#080c14]/80 transition-all duration-300 ${listCollapsed ? "w-0 overflow-hidden" : "w-80 shrink-0"}`}>
        {/* Panel header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Journeys</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {total} {total === 1 ? "result" : "results"}
              {hasSqlConfigs && ` · ${sqlConfigs.length} SQL group${sqlConfigs.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfigs(loadJourneyConfigs())}
            className="h-7 w-7 text-muted-foreground hover:text-white"
            title="Reload configurations"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by ID or account..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 bg-black/40 border-border text-white text-xs"
            />
          </div>
        </div>

        {/* Legend */}
        {hasSqlConfigs && (
          <div className="px-3 py-1.5 border-b border-border/30 flex gap-3 flex-wrap">
            {sqlConfigs.map(cfg => (
              <div key={cfg.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.name}
                {cfg.lastRunAt && (
                  <span className="text-muted-foreground/50">· {format(new Date(cfg.lastRunAt), "HH:mm")}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Journey list */}
        <div className="flex-1 overflow-y-auto py-1">
          {/* SQL-powered groups */}
          {sqlConfigs.map(cfg => {
            const filtered = {
              ...cfg,
              rawRows: (cfg.rawRows ?? []).filter(rowMatchesSearch),
            };
            return (
              <SqlGroupSection
                key={cfg.id}
                config={filtered}
                selected={selected}
                onSelect={setSelected}
              />
            );
          })}

          {/* DB groups (manual or unconfigured) */}
          {dbLoading && dbGroups.length === 0 ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="px-3 py-1.5">
                <Skeleton className="h-14 w-full bg-card/50 rounded-lg" />
              </div>
            ))
          ) : (
            dbGroups.map((group, i) => (
              <DbGroupSection
                key={group.config?.id ?? "other"}
                config={group.config}
                journeys={group.journeys}
                selected={selected}
                onSelect={setSelected}
              />
            ))
          )}

          {/* Empty state */}
          {total === 0 && !dbLoading && (
            <div className="p-6 text-center text-muted-foreground">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No journeys found</p>
              {hasSqlConfigs && (
                <p className="text-[10px] mt-1 text-muted-foreground/60">
                  Go to Configuration and click "Run & Apply" to load results.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse toggle ── */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => setListCollapsed(c => !c)}
          className="absolute z-10 flex items-center justify-center w-5 h-10 -ml-2.5 bg-[#080c14] border border-border text-muted-foreground hover:text-white hover:border-primary/40 rounded-md transition-colors shadow-md"
        >
          {listCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Detail Panel ── */}
      <div className="flex-1 overflow-hidden bg-black">
        {selected?.kind === "sql" && selectedSqlRow && selectedSqlConfig ? (
          <SqlRowDetailPanel
            key={`${selected.configId}-${selected.rowIndex}`}
            row={selectedSqlRow}
            columns={selectedSqlConfig.rawColumns ?? []}
            configName={selectedSqlConfig.name}
            configColor={selectedSqlConfig.color}
            onClose={() => setSelected(null)}
          />
        ) : selected?.kind === "db" ? (
          <DbJourneyDetailPanel
            key={selected.id}
            journeyId={selected.id}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Route className="w-14 h-14 mb-4 opacity-20" />
            <p className="text-sm">Select a journey to view its details</p>
            {hasSqlConfigs && (
              <p className="text-xs mt-2 text-muted-foreground/60">
                SQL groups loaded · click any row to inspect
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

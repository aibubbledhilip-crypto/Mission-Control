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
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { loadCustomerConfig } from "./configuration";

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
              className={node.status === "running" ? "animate-pulse" : ""}
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
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {node.nodeType}
            </div>
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

// ─── Journey Detail Panel ─────────────────────────────────────────────────────

function JourneyDetailPanel({ journeyId, onClose }: { journeyId: number; onClose: () => void }) {
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

  const statusClass =
    journey.status === "activated" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    journey.status === "suspended" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
    journey.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
    "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white truncate">{journey.externalId}</span>
              <Badge variant="outline" className={statusClass}>
                {journey.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Account: {journey.accountId}
              {journey.startedAt && (
                <span className="ml-3">
                  Started {format(new Date(journey.startedAt), "PP HH:mm:ss")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {journey.status === "suspended" ? (
            <Button
              size="sm"
              onClick={handleResume}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
              disabled={resumeMutation.isPending}
            >
              <Play className="w-3 h-3 mr-1" /> Resume
            </Button>
          ) : journey.status !== "completed" && journey.status !== "failed" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSuspendDialogOpen(true)}
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 h-8"
            >
              <Pause className="w-3 h-3 mr-1" /> Suspend
            </Button>
          ) : null}
        </div>
      </div>

      {/* Canvas + Node Inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-black overflow-hidden">
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex bg-card border border-border rounded-md shadow-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="h-7 w-7 rounded-none border-r border-border"
            >
              <Minimize className="w-3 h-3" />
            </Button>
            <div className="flex items-center justify-center w-10 text-[11px] font-medium text-white">{zoom}%</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="h-7 w-7 rounded-none border-l border-border"
            >
              <Maximize className="w-3 h-3" />
            </Button>
          </div>
          <div
            className="w-full h-full overflow-auto"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
          >
            <FlowCanvas
              nodes={nodes}
              onNodeClick={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
            />
          </div>
        </div>

        {/* Node Inspector */}
        {selectedNode && (
          <div className="w-64 border-l border-border bg-card/80 backdrop-blur overflow-y-auto flex flex-col shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-bold text-white text-sm truncate pr-2">{selectedNode.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNodeId(null)}
                className="h-7 w-7 shrink-0"
              >
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
                <div className="text-xs text-white font-mono">
                  {format(new Date(selectedNode.updatedAt), "HH:mm:ss.SSS")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Suspend Journey</DialogTitle>
            <DialogDescription>
              This will pause execution of the flow. Nodes currently running will complete.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason / Notes</Label>
              <Textarea
                id="reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Why are you suspending this journey?"
                className="bg-black/50 border-border text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSuspend}
              disabled={suspendMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Status / Health Helpers ──────────────────────────────────────────────────

function statusClass(status: string) {
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

// ─── Main Journeys Page ───────────────────────────────────────────────────────

export default function Journeys() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [customerConfig] = useState(loadCustomerConfig);

  const { data: user } = useGetCurrentUser();
  const { data: journeysData, isLoading } = useListJourneys({
    tenantId: user?.tenantId,
    search,
  });

  // Apply customer config filter
  const journeys = (() => {
    const items = journeysData?.items ?? [];
    if (customerConfig.showAll || customerConfig.accountIds.length === 0) return items;
    return items.filter(j => customerConfig.accountIds.includes(j.accountId ?? ""));
  })();

  // Select first journey automatically when list loads
  useEffect(() => {
    if (!selectedId && journeys.length > 0) setSelectedId(journeys[0].id);
  }, [journeys.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-m-6 md:-m-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Journeys List Panel ── */}
      <div className={`flex flex-col border-r border-border bg-[#080c14]/80 transition-all duration-300 ${listCollapsed ? "w-0 overflow-hidden" : "w-80 shrink-0"}`}>
        {/* Panel header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Journeys</div>
            {journeysData && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {journeys.length} {journeys.length === 1 ? "result" : "results"}
                {!customerConfig.showAll && customerConfig.accountIds.length > 0 && " (filtered)"}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by ID or account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-black/40 border-border text-white text-xs"
            />
          </div>
        </div>

        {/* Journey list */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="px-3 py-1.5">
                <Skeleton className="h-16 w-full bg-card/50 rounded-lg" />
              </div>
            ))
          ) : journeys.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No journeys found</p>
            </div>
          ) : (
            journeys.map((journey) => (
              <button
                key={journey.id}
                onClick={() => setSelectedId(journey.id)}
                className={`w-full text-left px-3 py-2 transition-all group ${
                  selectedId === journey.id
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-white/5 border-l-2 border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor] ${healthDot(journey.healthStatus)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-xs font-medium text-white truncate max-w-[140px]">
                        {journey.externalId}
                      </span>
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${statusClass(journey.status)}`}>
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
            ))
          )}
        </div>
      </div>

      {/* ── Collapse toggle ── */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => setListCollapsed(c => !c)}
          className="absolute z-10 flex items-center justify-center w-5 h-10 -ml-2.5 bg-[#080c14] border border-border text-muted-foreground hover:text-white hover:border-primary/40 rounded-md transition-colors shadow-md"
          aria-label={listCollapsed ? "Expand list" : "Collapse list"}
        >
          {listCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Journey Detail Panel ── */}
      <div className="flex-1 overflow-hidden bg-black">
        {selectedId ? (
          <JourneyDetailPanel
            key={selectedId}
            journeyId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Route className="w-14 h-14 mb-4 opacity-20" />
            <p className="text-sm">Select a journey to view its flow</p>
          </div>
        )}
      </div>
    </div>
  );
}

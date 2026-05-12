import { useState, useEffect, useRef } from "react";
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
  Search, Route, Activity, ChevronLeft, ChevronRight, Pause, Play,
  X, Database, Clock, RefreshCw, ZoomIn, ZoomOut, Loader2,
  CheckCircle2, XCircle, GitBranch, SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  loadJourneyConfigs,
  layoutFlowNodes,
  resolveActiveNodes,
  isColumnValidation,
  normalizeColumnValidation,
  type JourneyConfig,
  type FlowNode,
  type NodeValidation,
  NODE_SIZE,
  NODE_RADIUS,
} from "@/lib/journey-configs";
import { ICON_MAP } from "./configuration";
import type { Journey } from "@workspace/api-client-react";

// ─── Node Result Types ────────────────────────────────────────────────────────

type NodeStatus = "idle" | "loading" | "pass" | "fail" | "error";

interface NodeResult {
  status: NodeStatus;
  rowCount?: number;
  rows?: Record<string, string>[];
  error?: string;
  /** For columnValue validation: which column was inspected */
  checkedColumn?: string;
  /** For columnValue validation: actual value from the first result row */
  checkedValue?: string;
}

// ─── Validation Evaluation ────────────────────────────────────────────────────

function evaluateValidation(
  validation: NodeValidation,
  rowCount: number,
  rows: Record<string, string>[]
): { passed: boolean; checkedColumn?: string; checkedValue?: string } {
  if (typeof validation === "string") {
    const passed = validation === "rowCount > 0" ? rowCount > 0 : rowCount === 0;
    return { passed };
  }
  if (isColumnValidation(validation)) {
    const norm = normalizeColumnValidation(validation);
    if (norm.checks.length === 0) return { passed: false };
    if (rows.length === 0) return { passed: false };
    // ALL checks must pass (AND logic)
    for (const chk of norm.checks) {
      const actualVal = rows[0][chk.column] ?? "";
      const actualNorm = actualVal.toLowerCase().trim();
      const matches = chk.values.some(v => v.toLowerCase().trim() === actualNorm);
      const checkPassed = chk.operator === "!=" ? !matches : matches;
      if (!checkPassed) return { passed: false };
    }
    return { passed: true };
  }
  return { passed: false };
}

// ─── SQL Substitution ─────────────────────────────────────────────────────────

function substituteVars(sql: string, row: Record<string, string>, accountCol: string): string {
  let result = sql;
  Object.entries(row).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val.replace(/'/g, "''"));
  });
  const bancan = row[accountCol] ?? "";
  result = result.replace(/\{\{bancan\}\}/g, bancan.replace(/'/g, "''"));
  result = result.replace(/\{\{accountId\}\}/g, bancan.replace(/'/g, "''"));
  return result;
}

// ─── Canvas Node ─────────────────────────────────────────────────────────────

function CanvasNode({
  node,
  result,
  selected,
}: {
  node: FlowNode;
  result?: NodeResult;
  selected: boolean;
}) {
  const Icon = ICON_MAP[node.icon] ?? Database;
  const status = result?.status ?? "idle";

  const ringColor =
    status === "pass"    ? "#10b981" :
    status === "fail"    ? "#ef4444" :
    status === "loading" ? "#0ea5e9" :
    status === "error"   ? "#f59e0b" :
                           "#475569";

  const glowSize =
    status === "pass" || status === "fail" ? "0 0 28px 4px" :
    status === "loading"                   ? "0 0 16px 2px" : "0 0 0 0";

  const iconColor =
    status === "pass"    ? "#10b981" :
    status === "fail"    ? "#ef4444" :
    status === "loading" ? "#0ea5e9" :
    status === "error"   ? "#f59e0b" :
                           "#64748b";

  return (
    <div style={{ width: NODE_SIZE + 40, marginLeft: -20, userSelect: "none" }}>
      <div
        className="mx-auto flex items-center justify-center"
        style={{
          width: NODE_SIZE,
          height: NODE_SIZE,
          borderRadius: "50%",
          border: `3px solid ${ringColor}`,
          boxShadow: `${glowSize} ${ringColor}${selected ? ", 0 0 0 5px rgba(255,255,255,0.18)" : ""}`,
          background: "radial-gradient(circle at 35% 35%, #1a2744, #0a0f18)",
          transition: "box-shadow 0.3s, border-color 0.3s",
          animation: status === "loading" ? "pulse 1.5s infinite" : undefined,
        }}
      >
        <span style={{ color: iconColor }} className="inline-flex pointer-events-none">
          <Icon className="w-9 h-9" />
        </span>
      </div>
      <div className="text-center mt-2 px-1">
        <div
          className="text-[11px] font-bold tracking-wider uppercase truncate"
          style={{ color: status === "pass" ? "#10b981" : status === "fail" ? "#ef4444" : "#94a3b8" }}
        >
          {node.name}
        </div>
        {status !== "idle" && (
          <div className="text-[10px] font-semibold mt-0.5" style={{ color: ringColor }}>
            {status === "loading" ? "···" : status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "ERR"}
          </div>
        )}
        {(status === "pass" || status === "fail") && result?.rowCount !== undefined && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flow Graph Canvas ────────────────────────────────────────────────────────

function JourneyFlowCanvas({
  config,
  selectedRow,
  onClose,
}: {
  config: JourneyConfig;
  selectedRow: Record<string, string>;
  onClose: () => void;
}) {
  // ── Transform state (also mirrored in refs for zero-stale-closure window handlers) ──
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 80, y: 60 });
  function applyZoom(z: number) { zoomRef.current = z; setZoom(z); }
  function applyPan(p: { x: number; y: number }) { panRef.current = p; setPan(p); }

  // ── Node positions: start from auto-layout, then user can drag ──
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const nodePosRef = useRef<Record<string, { x: number; y: number }>>({});

  // ── Interaction refs (no state — avoid renders during drag/pan) ──
  const containerRef = useRef<HTMLDivElement>(null);
  const dragNodeIdRef   = useRef<string | null>(null);
  const dragOffsetRef   = useRef({ x: 0, y: 0 });
  const dragStartRef    = useRef({ x: 0, y: 0 });
  const isDraggingRef   = useRef(false);
  const isPanningRef    = useRef(false);
  const panStartRef     = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // ── Feature state ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeResults, setNodeResults] = useState<Record<string, NodeResult>>({});
  const runRef = useRef(0);

  const accountCol = config.accountColumn ?? "bancan";
  const bancan     = selectedRow[accountCol] ?? Object.values(selectedRow)[0] ?? "";
  const selectedRowRef = useRef(selectedRow);
  selectedRowRef.current = selectedRow;

  // ── Resolve active flow nodes from the matched condition ──
  const { nodes: flowNodes, conditionName } = resolveActiveNodes(config, selectedRow);
  // Stable string key so effects only re-fire when condition actually changes
  const conditionKey = conditionName ?? "__default__";

  const idCol     = (config.rawColumns ?? []).find(c => c.toLowerCase().includes("order")) ?? (config.rawColumns ?? [])[0] ?? "";
  const displayId = idCol ? selectedRow[idCol] : bancan;
  const statusCol = (config.rawColumns ?? []).find(c => c.toLowerCase() === "status") ?? "";
  const statusVal = statusCol ? selectedRow[statusCol] : null;

  // ── Init node positions from auto-layout when config or matched condition changes ──
  useEffect(() => {
    const layout = layoutFlowNodes(flowNodes);
    const init: Record<string, { x: number; y: number }> = {};
    Object.entries(layout).forEach(([id, p]) => { init[id] = { x: p.x, y: p.y }; });
    nodePosRef.current = init;
    setNodePositions(init);
    setSelectedNodeId(null);
    applyZoom(1.0);
    applyPan({ x: 80, y: 60 });
  }, [config.id, conditionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run node SQL queries when account or matched condition changes ──
  useEffect(() => {
    if (flowNodes.length === 0) return;
    const runId = ++runRef.current;
    const row = selectedRowRef.current;
    const initial: Record<string, NodeResult> = {};
    flowNodes.forEach(n => { initial[n.id] = { status: n.sql?.trim() ? "loading" : "idle" }; });
    setNodeResults(initial);
    setSelectedNodeId(null);

    flowNodes.forEach(async (node) => {
      if (!node.sql?.trim()) return;
      const dsId = node.dataSourceId ?? config.dataSourceId;
      if (!dsId) {
        if (runRef.current === runId) setNodeResults(r => ({ ...r, [node.id]: { status: "error", error: "No data source" } }));
        return;
      }
      const sql = substituteVars(node.sql, row, accountCol);
      try {
        const resp = await fetch(`/api/data-sources/${dsId}/query`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ sql }),
        });
        if (runRef.current !== runId) return;
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          setNodeResults(r => ({ ...r, [node.id]: { status: "error", error: err.error ?? "Query failed" } }));
          return;
        }
        const result = await resp.json();
        const rowCount: number = result.rowCount ?? 0;
        const rows: Record<string, string>[] = result.rows?.slice(0, 5) ?? [];
        const { passed, checkedColumn, checkedValue } = evaluateValidation(node.validation, rowCount, rows);
        setNodeResults(r => ({ ...r, [node.id]: { status: passed ? "pass" : "fail", rowCount, rows, checkedColumn, checkedValue } }));
      } catch (err: any) {
        if (runRef.current !== runId) return;
        setNodeResults(r => ({ ...r, [node.id]: { status: "error", error: err?.message ?? "Network error" } }));
      }
    });
  }, [bancan, config.id, conditionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Window-level mouse handlers (attached once, use refs everywhere) ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.mx;
        const dy = e.clientY - panStartRef.current.my;
        const p = { x: panStartRef.current.px + dx / zoomRef.current, y: panStartRef.current.py + dy / zoomRef.current };
        panRef.current = p;
        setPan(p);
        if (containerRef.current) containerRef.current.style.cursor = "grabbing";
      }
      if (dragNodeIdRef.current) {
        const dist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
        if (dist > 4) isDraggingRef.current = true;
        if (isDraggingRef.current) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const nx = (e.clientX - rect.left) / zoomRef.current - panRef.current.x - dragOffsetRef.current.x;
          const ny = (e.clientY - rect.top)  / zoomRef.current - panRef.current.y - dragOffsetRef.current.y;
          const next = { ...nodePosRef.current, [dragNodeIdRef.current]: { x: nx, y: ny } };
          nodePosRef.current = next;
          setNodePositions(next);
          if (containerRef.current) containerRef.current.style.cursor = "grabbing";
        }
      }
    };
    const onUp = () => {
      if (dragNodeIdRef.current && !isDraggingRef.current) {
        // It was a tap/click — toggle selection
        const id = dragNodeIdRef.current;
        setSelectedNodeId(prev => prev === id ? null : id);
      }
      isPanningRef.current  = false;
      dragNodeIdRef.current = null;
      isDraggingRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = "grab";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []); // zero deps — all mutable state accessed via refs

  // ── Wheel zoom toward cursor ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor   = e.deltaY > 0 ? 0.92 : 1.09;
      const newZoom  = Math.max(0.15, Math.min(4, zoomRef.current * factor));
      const rect     = el.getBoundingClientRect();
      const mx       = e.clientX - rect.left;
      const my       = e.clientY - rect.top;
      const newPan   = {
        x: mx / newZoom - mx / zoomRef.current + panRef.current.x,
        y: my / newZoom - my / zoomRef.current + panRef.current.y,
      };
      zoomRef.current = newZoom; panRef.current = newPan;
      setZoom(newZoom); setPan(newPan);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // zero deps

  // ── Canvas pointer-down: start pan or node drag ──
  const onCanvasDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };
  const onNodeDown = (e: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation(); // don't start canvas pan
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const np = nodePosRef.current[nodeId] ?? { x: 0, y: 0 };
    dragNodeIdRef.current = nodeId;
    dragOffsetRef.current = {
      x: (e.clientX - rect.left) / zoomRef.current - panRef.current.x - np.x,
      y: (e.clientY - rect.top)  / zoomRef.current - panRef.current.y - np.y,
    };
    dragStartRef.current  = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const zoomIn    = () => { const z = Math.min(4, zoomRef.current * 1.25); applyZoom(z); };
  const zoomOut   = () => { const z = Math.max(0.15, zoomRef.current / 1.25); applyZoom(z); };
  const resetView = () => {
    const layout = layoutFlowNodes(flowNodes);
    const init: Record<string, { x: number; y: number }> = {};
    Object.entries(layout).forEach(([id, p]) => { init[id] = { x: p.x, y: p.y }; });
    nodePosRef.current = init; setNodePositions(init);
    applyZoom(1.0); applyPan({ x: 80, y: 60 });
  };

  const selectedNode   = selectedNodeId ? flowNodes.find(n => n.id === selectedNodeId) : null;
  const selectedResult = selectedNodeId ? nodeResults[selectedNodeId] : null;
  const passCount    = Object.values(nodeResults).filter(r => r.status === "pass").length;
  const failCount    = Object.values(nodeResults).filter(r => r.status === "fail").length;
  const loadingCount = Object.values(nodeResults).filter(r => r.status === "loading").length;
  const hasNodes = flowNodes.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{config.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-sm font-bold text-white truncate max-w-[300px]">{displayId || bancan}</span>
              {conditionName && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium">
                  {conditionName}
                </Badge>
              )}
              {statusVal && (
                <Badge variant="outline" className={`text-[10px] ${
                  statusVal.toLowerCase() === "completed" || statusVal.toLowerCase() === "active"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {statusVal.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{bancan}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasNodes && (
            <div className="flex items-center gap-2 text-xs">
              {loadingCount > 0 ? (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" /> Running {loadingCount}…
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> {passCount}</span>
                  <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" /> {failCount}</span>
                </>
              )}
            </div>
          )}
          {/* Zoom controls */}
          <div className="flex items-center bg-card border border-border rounded-md overflow-hidden">
            <button onClick={zoomOut} className="px-2 py-1 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors" title="Zoom out (or scroll)">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} className="px-2 text-[11px] font-medium text-white min-w-[44px] text-center hover:bg-white/10 transition-colors" title="Reset view">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={zoomIn} className="px-2 py-1 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors" title="Zoom in (or scroll)">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-black relative select-none"
          style={{
            cursor: "grab",
            backgroundImage: "radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.055) 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          onMouseDown={onCanvasDown}
        >
          {!hasNodes ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground pointer-events-none">
              <GitBranch className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No condition matched</p>
                <p className="text-xs mt-1 text-muted-foreground/60">
                  This account's <code className="text-primary">order_type</code> did not match any configured condition.
                </p>
                <p className="text-xs mt-0.5 text-muted-foreground/60">
                  Go to <span className="text-primary">Configuration → Flow Conditions</span> to add or adjust conditions.
                </p>
              </div>
            </div>
          ) : (
            /* ── World div: everything inside transforms together ── */
            (() => {
              // Compute SVG bounds so paths always have a real viewport to render into
              const positions = Object.values(nodePositions);
              const svgW = positions.reduce((m, p) => Math.max(m, p.x + NODE_SIZE + 400), 1200);
              const svgH = positions.reduce((m, p) => Math.max(m, p.y + NODE_SIZE + 300), 800);

              return (
                <div
                  style={{
                    position: "absolute", top: 0, left: 0,
                    transformOrigin: "0 0",
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                    width: svgW,
                    height: svgH,
                  }}
                >
                  {/* SVG edges — sized to cover all node positions */}
                  <svg
                    style={{ position: "absolute", top: 0, left: 0, width: svgW, height: svgH, pointerEvents: "none" }}
                  >
                    <defs>
                      <filter id="fc-glow-g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      <filter id="fc-glow-r"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    </defs>
                    {flowNodes.filter(n => n.parentNodeId).map(node => {
                      const parent = flowNodes.find(p => p.id === node.parentNodeId);
                      if (!parent) return null;
                      const pp = nodePositions[parent.id];
                      const cp = nodePositions[node.id];
                      if (!pp || !cp) return null;
                      // Edge from right-center of parent circle to left-center of child circle
                      const sx = pp.x + NODE_RADIUS, sy = pp.y + NODE_RADIUS;
                      const ex = cp.x + NODE_RADIUS, ey = cp.y + NODE_RADIUS;
                      const mx = (sx + ex) / 2;
                      const childResult = nodeResults[node.id];
                      const color = childResult?.status === "pass" ? "#10b981" : childResult?.status === "fail" ? "#ef4444" : childResult?.status === "error" ? "#f59e0b" : "#334155";
                      const animated = childResult?.status === "pass" || childResult?.status === "fail";
                      const d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
                      return (
                        <g key={`e-${node.id}`}>
                          <path d={d} fill="none" stroke={color} strokeWidth="6" strokeOpacity="0.12" />
                          <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeOpacity={animated ? 0.9 : 0.35}
                            filter={animated ? (childResult?.status === "pass" ? "url(#fc-glow-g)" : "url(#fc-glow-r)") : undefined} />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Draggable nodes */}
                  {flowNodes.map(node => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    return (
                      <div
                        key={node.id}
                        style={{ position: "absolute", left: pos.x, top: pos.y, cursor: "grab" }}
                        onMouseDown={e => onNodeDown(e, node.id)}
                      >
                        <CanvasNode node={node} result={nodeResults[node.id]} selected={selectedNodeId === node.id} />
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        {/* Node detail sidebar */}
        {selectedNode && (
          <div className="w-72 border-l border-border bg-card/80 backdrop-blur overflow-y-auto flex flex-col shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const Icon = ICON_MAP[selectedNode.icon] ?? Database;
                  return <Icon className="w-4 h-4 text-muted-foreground shrink-0" />;
                })()}
                <h3 className="font-bold text-white text-sm truncate">{selectedNode.name}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-7 w-7 shrink-0">
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status badge */}
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Status</div>
                {selectedResult ? (
                  <div className="flex items-center gap-2">
                    {selectedResult.status === "loading" ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running…
                      </Badge>
                    ) : selectedResult.status === "pass" ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PASS
                      </Badge>
                    ) : selectedResult.status === "fail" ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1">
                        <XCircle className="w-3 h-3" /> FAIL
                      </Badge>
                    ) : selectedResult.status === "error" ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1">
                        ERROR
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-border/50">
                        No SQL configured
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-border/50">Idle</Badge>
                )}
              </div>

              {/* Row count */}
              {selectedResult?.rowCount !== undefined && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Rows Returned</div>
                  <div className="text-xl font-bold font-mono text-white">{selectedResult.rowCount}</div>
                </div>
              )}

              {/* Error */}
              {selectedResult?.error && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Error</div>
                  <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20 font-mono">
                    {selectedResult.error}
                  </div>
                </div>
              )}

              {/* Parent */}
              {selectedNode.parentNodeId && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Parent Node</div>
                  <div className="text-sm text-white">
                    {flowNodes.find(n => n.id === selectedNode.parentNodeId)?.name ?? "—"}
                  </div>
                </div>
              )}

              {/* Pass Condition */}
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Pass Condition</div>
                {isColumnValidation(selectedNode.validation) ? (() => {
                  const norm = normalizeColumnValidation(selectedNode.validation);
                  return (
                    <div className="space-y-1.5">
                      {norm.checks.map((chk, i) => {
                        const actualVal = selectedResult?.rows?.[0]?.[chk.column] ?? "";
                        const actualNorm = actualVal.toLowerCase().trim();
                        const matches = chk.values.some(v => v.toLowerCase().trim() === actualNorm);
                        const checkPassed = chk.operator === "!=" ? !matches : matches;
                        return (
                          <div key={i} className="space-y-1">
                            {i > 0 && <div className="text-[9px] text-amber-400/70 font-semibold uppercase tracking-wider">AND</div>}
                            <div className="text-xs font-mono text-primary bg-primary/10 rounded px-2 py-1 border border-primary/20 inline-block">
                              {chk.column} {chk.operator === "==" ? "=" : chk.operator === "!=" ? "≠" : "IN"} [{chk.values.join(", ")}]
                            </div>
                            {actualVal && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Actual:</span>
                                <span className={cn(
                                  "text-xs font-mono px-2 py-0.5 rounded border",
                                  checkPassed
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-red-400 bg-red-500/10 border-red-500/20"
                                )}>
                                  {actualVal}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <div className="text-xs font-mono text-primary bg-primary/10 rounded px-2 py-1 border border-primary/20 inline-block">
                    {selectedNode.validation}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SQL Row Detail Panel (fallback when no flow nodes) ───────────────────────

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

  return (
    <div className="flex flex-col h-full">
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
                <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/20">
                  {status.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: configColor }} />
              <p className="text-xs text-muted-foreground truncate">{configName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
          <SlidersHorizontal className="w-3 h-3" />
          <span>Add flow nodes in Configuration</span>
        </div>
      </div>
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
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetJourneyQueryKey(journeyId) }); setSuspendDialogOpen(false); } }
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
        <div className="p-4 border-b border-border"><Skeleton className="h-6 w-48 bg-card/50 mb-2" /><Skeleton className="h-4 w-32 bg-card/50" /></div>
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
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
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
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(50, z - 10))} className="h-7 w-7 rounded-none border-r border-border"><ZoomOut className="w-3 h-3" /></Button>
            <div className="flex items-center justify-center w-10 text-[11px] font-medium text-white">{zoom}%</div>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(200, z + 10))} className="h-7 w-7 rounded-none border-l border-border"><ZoomIn className="w-3 h-3" /></Button>
          </div>
          <div className="w-full h-full overflow-auto bg-[#0a0f18]"
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          >
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
              {nodes.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center"><Route className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No nodes</p></div>
                </div>
              ) : (
                <div className="relative" style={{ width: 800, height: 500 }}>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {nodes.filter((n: any) => n.parentNodeId).map((node: any) => {
                      const parent = nodes.find((n: any) => n.id === node.parentNodeId);
                      if (!parent) return null;
                      return (
                        <path key={`e-${node.id}`}
                          d={`M ${parent.positionX + 80} ${parent.positionY + 40} C ${parent.positionX + 180} ${parent.positionY + 40}, ${node.positionX - 100} ${node.positionY + 40}, ${node.positionX} ${node.positionY + 40}`}
                          fill="none" stroke="rgba(14,165,233,0.35)" strokeWidth="2" />
                      );
                    })}
                  </svg>
                  {nodes.map((node: any) => (
                    <div key={node.id} onClick={() => setSelectedNodeId(node.id)}
                      className={`absolute cursor-pointer transition-all ${selectedNodeId === node.id ? "scale-105 z-10" : "z-0 hover:scale-105"}`}
                      style={{ left: node.positionX, top: node.positionY, width: 160 }}
                    >
                      <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{node.nodeType}</div>
                        <div className="text-sm font-bold text-white truncate">{node.name}</div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${node.status === "passed" ? "bg-emerald-500" : node.status === "failed" ? "bg-red-500" : "bg-primary animate-pulse"}`} />
                          <span className="text-[10px] text-muted-foreground capitalize">{node.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedNode && (
          <div className="w-60 border-l border-border bg-card/80 overflow-y-auto shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-bold text-white text-sm truncate pr-2">{selectedNode.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-7 w-7 shrink-0"><X className="w-3 h-3" /></Button>
            </div>
            <div className="p-3 space-y-3 text-sm">
              <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</div><Badge variant="outline" className="text-xs">{selectedNode.status?.toUpperCase()}</Badge></div>
              <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</div><div className="text-sm font-medium text-white">{selectedNode.nodeType}</div></div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Suspend Journey</DialogTitle><DialogDescription>This will pause execution.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} className="bg-black/50 border-border text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSuspend} disabled={suspendMutation.isPending} className="bg-amber-600 hover:bg-amber-500 text-white">Confirm Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Journey List Items ───────────────────────────────────────────────────────

type SelectedItem =
  | { kind: "db"; id: number }
  | { kind: "sql"; configId: string; rowIndex: number };

function DbJourneyRow({ journey, selected, onClick }: { journey: Journey; selected: boolean; onClick: () => void }) {
  const dot = journey.healthStatus === "healthy" ? "#10b981" : journey.healthStatus === "degraded" ? "#f59e0b" : "#ef4444";
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2 transition-all border-l-2 ${selected ? "bg-primary/10 border-primary" : "border-transparent hover:bg-white/5"}`}>
      <div className="flex items-start gap-2">
        <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot, boxShadow: `0 0 6px ${dot}` }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-mono text-xs font-medium text-white truncate max-w-[140px]">{journey.externalId}</span>
            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${
              journey.status === "activated" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
              journey.status === "suspended" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
              "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }`}>{journey.status.toUpperCase()}</Badge>
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{journey.accountId}</div>
          {journey.latencyMs && <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"><Activity className="w-2.5 h-2.5" />{journey.latencyMs}ms</div>}
        </div>
      </div>
    </button>
  );
}

function SqlRowItem({ row, columns, color, selected, onClick }: { row: Record<string, string>; columns: string[]; color: string; selected: boolean; onClick: () => void }) {
  const idCol = columns.find(c => c.toLowerCase().includes("order")) ?? columns[0] ?? "";
  const acctCol = columns.find(c => c.toLowerCase() === "bancan" || c.toLowerCase().includes("account")) ?? columns[1] ?? "";
  const statusCol = columns.find(c => c.toLowerCase() === "status") ?? "";
  const dateCol = columns.find(c => c.toLowerCase().includes("ts") || c.toLowerCase().includes("date") || c.toLowerCase().includes("created")) ?? "";
  const status = statusCol ? row[statusCol] : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 transition-all border-l-2 ${selected ? "bg-white/5" : "border-transparent hover:bg-white/5"}`}
      style={selected ? { borderLeftColor: color, backgroundColor: color + "15" } : {}}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-mono text-xs font-medium text-white truncate max-w-[150px]">{idCol ? row[idCol] : Object.values(row)[0]}</span>
            {status && <span className={`text-[9px] font-semibold ${status.toLowerCase() === "completed" || status.toLowerCase() === "active" ? "text-emerald-400" : status.toLowerCase() === "failed" ? "text-red-400" : "text-amber-400"}`}>{status.toUpperCase()}</span>}
          </div>
          {acctCol && acctCol !== idCol && <div className="text-[10px] text-muted-foreground truncate font-mono">{row[acctCol]}</div>}
          {dateCol && row[dateCol] && <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"><Clock className="w-2.5 h-2.5" /><span className="truncate font-mono">{row[dateCol]}</span></div>}
        </div>
      </div>
    </button>
  );
}

function SqlGroupSection({ config, selected, onSelect, searchFilter }: { config: JourneyConfig; selected: SelectedItem | null; onSelect: (item: SelectedItem) => void; searchFilter: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = (config.rawRows ?? []).filter(row => !searchFilter || Object.values(row).some(v => v?.toLowerCase().includes(searchFilter.toLowerCase())));
  const columns = config.rawColumns ?? [];
  if (rows.length === 0 && !config.rawRows?.length) return null;

  return (
    <div>
      <button onClick={() => setCollapsed(c => !c)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left truncate">{config.name}</span>
        <span className="text-[9px] text-muted-foreground">{rows.length}</span>
        {config.lastRunAt && <span className="text-[9px] text-muted-foreground/50">{format(new Date(config.lastRunAt), "HH:mm")}</span>}
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-90" />}
      </button>
      {!collapsed && rows.map((row, i) => {
        const originalIndex = (config.rawRows ?? []).indexOf(row);
        return (
          <SqlRowItem key={i} row={row} columns={columns} color={config.color}
            selected={selected?.kind === "sql" && selected.configId === config.id && selected.rowIndex === originalIndex}
            onClick={() => onSelect({ kind: "sql", configId: config.id, rowIndex: originalIndex })}
          />
        );
      })}
    </div>
  );
}

function DbGroupSection({ config, journeys, selected, onSelect }: { config: JourneyConfig | null; journeys: Journey[]; selected: SelectedItem | null; onSelect: (item: SelectedItem) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  if (journeys.length === 0) return null;

  return (
    <div>
      <button onClick={() => setCollapsed(c => !c)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
        {config ? <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} /> : <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left truncate">{config ? config.name : "Other"}</span>
        <span className="text-[9px] text-muted-foreground">{journeys.length}</span>
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-90" />}
      </button>
      {!collapsed && journeys.map(j => (
        <DbJourneyRow key={j.id} journey={j}
          selected={selected?.kind === "db" && selected.id === j.id}
          onClick={() => onSelect({ kind: "db", id: j.id })}
        />
      ))}
    </div>
  );
}

// ─── Main Journeys Page ───────────────────────────────────────────────────────

export default function Journeys() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [configs, setConfigs] = useState<JourneyConfig[]>(() => loadJourneyConfigs());

  useEffect(() => {
    const onFocus = () => setConfigs(loadJourneyConfigs());
    window.addEventListener("focus", onFocus);
    const iv = setInterval(() => setConfigs(loadJourneyConfigs()), 2000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(iv); };
  }, []);

  const { data: user } = useGetCurrentUser();
  const { data: journeysData, isLoading: dbLoading } = useListJourneys({ tenantId: user?.tenantId, search });
  const allDbJourneys = journeysData?.items ?? [];

  const sqlConfigs = configs.filter(c => c.enabled && c.type === "sql" && (c.rawRows?.length ?? 0) > 0);
  const manualConfigs = configs.filter(c => c.enabled && c.type === "manual" && c.accountIds.length > 0);

  const dbGroups: { config: JourneyConfig | null; journeys: Journey[] }[] = [];
  const assignedIds = new Set<number>();
  for (const cfg of manualConfigs) {
    const matched = allDbJourneys.filter(j => cfg.accountIds.includes(j.accountId ?? "") && !assignedIds.has(j.id));
    matched.forEach(j => assignedIds.add(j.id));
    if (matched.length > 0) dbGroups.push({ config: cfg, journeys: matched });
  }
  if (sqlConfigs.length === 0 && manualConfigs.length === 0) {
    dbGroups.push({ config: null, journeys: allDbJourneys });
  } else {
    const others = allDbJourneys.filter(j => !assignedIds.has(j.id));
    if (others.length > 0) dbGroups.push({ config: null, journeys: others });
  }

  const sqlTotal = sqlConfigs.reduce((s, c) => s + (c.rawRows?.length ?? 0), 0);
  const dbTotal = dbGroups.reduce((s, g) => s + g.journeys.length, 0);
  const total = sqlTotal + dbTotal;

  useEffect(() => {
    if (selected) return;
    if (sqlConfigs.length > 0 && (sqlConfigs[0].rawRows?.length ?? 0) > 0) {
      setSelected({ kind: "sql", configId: sqlConfigs[0].id, rowIndex: 0 });
    } else if (allDbJourneys.length > 0) {
      setSelected({ kind: "db", id: allDbJourneys[0].id });
    }
  }, [sqlConfigs.length, allDbJourneys.length]); // eslint-disable-line

  const selectedSqlConfig = selected?.kind === "sql" ? configs.find(c => c.id === selected.configId) : null;
  const selectedSqlRow = selectedSqlConfig && selected?.kind === "sql" ? selectedSqlConfig.rawRows?.[selected.rowIndex] : null;
  const hasFlowNodes = (selectedSqlConfig?.flowConditions?.length ?? 0) > 0 || (selectedSqlConfig?.flowNodes?.length ?? 0) > 0;

  return (
    <div className="-m-6 md:-m-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* List panel */}
      <div className={`flex flex-col border-r border-border bg-[#080c14]/80 transition-all duration-300 ${listCollapsed ? "w-0 overflow-hidden" : "w-80 shrink-0"}`}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Journeys</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{total} result{total !== 1 ? "s" : ""}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setConfigs(loadJourneyConfigs())} className="h-7 w-7 text-muted-foreground hover:text-white" title="Reload">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 bg-black/40 border-border text-white text-xs" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {sqlConfigs.map(cfg => (
            <SqlGroupSection key={cfg.id} config={cfg} selected={selected} onSelect={setSelected} searchFilter={search} />
          ))}
          {dbLoading && dbGroups.length === 0
            ? Array(4).fill(0).map((_, i) => <div key={i} className="px-3 py-1.5"><Skeleton className="h-14 w-full bg-card/50 rounded-lg" /></div>)
            : dbGroups.map(g => <DbGroupSection key={g.config?.id ?? "other"} config={g.config} journeys={g.journeys} selected={selected} onSelect={setSelected} />)
          }
          {total === 0 && !dbLoading && (
            <div className="p-6 text-center text-muted-foreground">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No journeys found</p>
              {sqlConfigs.length > 0 && <p className="text-[10px] mt-1 opacity-60">Go to Configuration and click "Run & Apply"</p>}
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => setListCollapsed(c => !c)}
          className="absolute z-10 flex items-center justify-center w-5 h-10 -ml-2.5 bg-[#080c14] border border-border text-muted-foreground hover:text-white hover:border-primary/40 rounded-md transition-colors shadow-md"
        >
          {listCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden bg-black">
        {selected?.kind === "sql" && selectedSqlRow && selectedSqlConfig ? (
          hasFlowNodes ? (
            <JourneyFlowCanvas
              key={`${selected.configId}-${selected.rowIndex}`}
              config={selectedSqlConfig}
              selectedRow={selectedSqlRow}
              onClose={() => setSelected(null)}
            />
          ) : (
            <SqlRowDetailPanel
              key={`${selected.configId}-${selected.rowIndex}`}
              row={selectedSqlRow}
              columns={selectedSqlConfig.rawColumns ?? []}
              configName={selectedSqlConfig.name}
              configColor={selectedSqlConfig.color}
              onClose={() => setSelected(null)}
            />
          )
        ) : selected?.kind === "db" ? (
          <DbJourneyDetailPanel key={selected.id} journeyId={selected.id} onClose={() => setSelected(null)} />
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

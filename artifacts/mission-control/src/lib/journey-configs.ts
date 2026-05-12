export type JourneyConfigType = "sql" | "manual";
export type NodeIcon =
  | "account" | "salesforce" | "matrixx" | "aria" | "oracle"
  | "database" | "api" | "server" | "cloud" | "shield" | "check";

/** A single column check within a NodeColumnValidation */
export interface NodeColumnCheck {
  /** Column in the SQL result to inspect */
  column: string;
  /** == exact match; != not equal; in → value is one of the list */
  operator: "==" | "!=" | "in";
  /** Expected value(s) — case-insensitive OR match */
  values: string[];
}

/**
 * Structured column-value validation: ALL checks must pass (AND logic).
 * Each check inspects the first result row's column value against its list.
 */
export interface NodeColumnValidation {
  type: "columnValue";
  checks: NodeColumnCheck[];
}

export type NodeValidation = "rowCount > 0" | "rowCount === 0" | NodeColumnValidation;

/** Type guard */
export function isColumnValidation(v: NodeValidation): v is NodeColumnValidation {
  return typeof v === "object" && v !== null && (v as NodeColumnValidation).type === "columnValue";
}

/**
 * Normalizes legacy single-column format `{ type, column, operator, values }`
 * to the new `{ type, checks: [...] }` format. Safe to call on already-new format.
 */
export function normalizeColumnValidation(v: NodeColumnValidation): NodeColumnValidation {
  // Legacy format had top-level column/operator/values
  const legacy = v as unknown as { column?: string; operator?: string; values?: string[] };
  if (legacy.column !== undefined && !Array.isArray((v as any).checks)) {
    return {
      type: "columnValue",
      checks: [{ column: legacy.column, operator: (legacy.operator ?? "==") as NodeColumnCheck["operator"], values: legacy.values ?? [] }],
    };
  }
  return v;
}

export interface FlowNode {
  id: string;
  name: string;
  icon: NodeIcon;
  /** null = root node */
  parentNodeId: string | null;
  /** SQL to run for this node — use {{bancan}} as account ID placeholder */
  sql?: string;
  /** If set, overrides the config-level dataSourceId for this node */
  dataSourceId?: number;
  /** How to determine pass/fail from query result */
  validation: NodeValidation;
}

/**
 * A conditional flow variant. When a selected account's SQL row has
 * `matchColumn === matchValue` (and optionally `matchColumn2 === matchValue2`),
 * this set of flow nodes is shown on the canvas instead of any other variant.
 * Matching is case-insensitive exact. The first matching condition wins.
 */
export interface FlowCondition {
  id: string;
  /** Label shown in the canvas header, e.g. "New Activation" */
  name: string;
  /** Column from the group SQL result to match against, e.g. "order_type" */
  matchColumn: string;
  /**
   * One or more values that trigger this condition (case-insensitive OR match).
   * Supports both `string` (legacy single value) and `string[]` (multi-value).
   */
  matchValue: string | string[];
  /** Optional second column for AND logic, e.g. "vlocity_cmt__Reason__c" */
  matchColumn2?: string;
  matchValue2?: string | string[];
  /** Flow nodes shown when this condition matches */
  flowNodes: FlowNode[];
}

export interface JourneyConfig {
  id: string;
  name: string;
  color: string;
  type: JourneyConfigType;
  sql?: string;
  dataSourceId?: number;
  accountIds: string[];
  accountColumn?: string;
  rawRows?: Record<string, string>[];
  rawColumns?: string[];
  enabled: boolean;
  lastRunAt?: string;
  lastRunError?: string;
  rowCount?: number;
  /**
   * Conditional flow variants — evaluated top-to-bottom, first match wins.
   * Replaces the flat `flowNodes` field for new configs.
   */
  flowConditions?: FlowCondition[];
  /** Legacy: flat list of flow nodes (used when no flowConditions defined) */
  flowNodes?: FlowNode[];
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const CONFIG_KEY = "mc-journey-configs-v2";

export function loadJourneyConfigs(): JourneyConfig[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveJourneyConfigs(cfgs: JourneyConfig[]) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfgs));
}

export const COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

export function newFlowNode(partial?: Partial<FlowNode>): FlowNode {
  return {
    id: uuid(),
    name: "New Node",
    icon: "database",
    parentNodeId: null,
    sql: "",
    validation: "rowCount > 0",
    ...partial,
  };
}

export function newFlowCondition(partial?: Partial<FlowCondition>): FlowCondition {
  return {
    id: uuid(),
    name: "New Condition",
    matchColumn: "order_type",
    matchValue: [],
    flowNodes: [],
    ...partial,
  };
}

/** Normalise a matchValue (legacy string or new string[]) to an array. */
export function toMatchArray(v: string | string[]): string[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

/** Returns true when the row value matches the condition value (OR logic, case-insensitive). */
function matchesValue(rowVal: string, condVal: string | string[]): boolean {
  const nv = rowVal.trim().toLowerCase();
  const arr = toMatchArray(condVal);
  return arr.length > 0 && arr.some(v => v.trim().toLowerCase() === nv);
}

/**
 * Given a config and the currently selected SQL row, return which flow nodes
 * to display and the name of the matched condition (if any).
 * Conditions are evaluated top-to-bottom; first match wins.
 * Falls back to config.flowNodes if no condition matches.
 */
export function resolveActiveNodes(
  config: JourneyConfig,
  row: Record<string, string>,
): { nodes: FlowNode[]; conditionName: string | null } {
  if (config.flowConditions && config.flowConditions.length > 0) {
    for (const cond of config.flowConditions) {
      const v1 = (row[cond.matchColumn] ?? "").trim();
      if (!matchesValue(v1, cond.matchValue)) continue;
      if (cond.matchColumn2 && cond.matchValue2) {
        const v2 = (row[cond.matchColumn2] ?? "").trim();
        if (!matchesValue(v2, cond.matchValue2)) continue;
      }
      return { nodes: cond.flowNodes, conditionName: cond.name };
    }
  }
  return { nodes: config.flowNodes ?? [], conditionName: null };
}

export function newConfig(idx: number): JourneyConfig {
  return {
    id: uuid(),
    name: `Group ${idx + 1}`,
    color: COLORS[idx % COLORS.length],
    type: "manual",
    sql: "",
    accountIds: [],
    accountColumn: "bancan",
    enabled: true,
    flowNodes: [],
  };
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export const NODE_SIZE = 96;
export const NODE_RADIUS = NODE_SIZE / 2;
export const LAYER_X = 280;
export const NODE_Y_SPACING = 150;
export const CANVAS_PAD = 60;

export interface NodePosition {
  x: number;
  y: number;
  depth: number;
}

export function layoutFlowNodes(flowNodes: FlowNode[]): Record<string, NodePosition> {
  if (flowNodes.length === 0) return {};

  const childrenOf: Record<string, string[]> = {};
  const roots: string[] = [];

  flowNodes.forEach(n => {
    if (!n.parentNodeId) {
      roots.push(n.id);
    } else {
      childrenOf[n.parentNodeId] = [...(childrenOf[n.parentNodeId] ?? []), n.id];
    }
  });

  // BFS to assign depth levels
  const depth: Record<string, number> = {};
  const queue = [...roots];
  roots.forEach(r => { depth[r] = 0; });

  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = childrenOf[id] ?? [];
    children.forEach(c => {
      if (depth[c] === undefined) {
        depth[c] = depth[id] + 1;
        queue.push(c);
      }
    });
  }

  // Group by depth
  const byDepth: Record<number, string[]> = {};
  Object.entries(depth).forEach(([id, d]) => {
    byDepth[d] = [...(byDepth[d] ?? []), id];
  });

  const maxNodesPerLayer = Math.max(...Object.values(byDepth).map(ids => ids.length));
  const canvasHeight = maxNodesPerLayer * NODE_Y_SPACING + NODE_SIZE + CANVAS_PAD * 2;

  const positions: Record<string, NodePosition> = {};

  Object.entries(byDepth).forEach(([depthStr, nodeIds]) => {
    const d = parseInt(depthStr);
    const x = CANVAS_PAD + d * LAYER_X;
    const totalH = nodeIds.length * NODE_Y_SPACING;
    const startY = (canvasHeight - totalH) / 2 + NODE_Y_SPACING / 2 - NODE_SIZE / 2;

    nodeIds.forEach((id, i) => {
      positions[id] = { x, y: startY + i * NODE_Y_SPACING, depth: d };
    });
  });

  return positions;
}

export function canvasDimensions(positions: Record<string, NodePosition>): { width: number; height: number } {
  if (Object.keys(positions).length === 0) return { width: 600, height: 400 };
  const xs = Object.values(positions).map(p => p.x + NODE_SIZE);
  const ys = Object.values(positions).map(p => p.y + NODE_SIZE + 36);
  return {
    width: Math.max(...xs) + CANVAS_PAD,
    height: Math.max(...ys) + CANVAS_PAD,
  };
}

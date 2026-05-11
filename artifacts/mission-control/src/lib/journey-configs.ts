export type JourneyConfigType = "sql" | "manual";

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

export function newConfig(idx: number): JourneyConfig {
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

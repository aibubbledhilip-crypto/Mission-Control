import { useState, useEffect } from "react";
import { SlidersHorizontal, Plus, X, Users, ToggleLeft, ToggleRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const CONFIG_KEY = "mc-customer-config";

export type CustomerConfig = {
  accountIds: string[];
  showAll: boolean;
};

const DEFAULT_CONFIG: CustomerConfig = { accountIds: [], showAll: true };

export function loadCustomerConfig(): CustomerConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return JSON.parse(raw) as CustomerConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveCustomerConfig(cfg: CustomerConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export default function Configuration() {
  const [config, setConfig] = useState<CustomerConfig>(loadCustomerConfig);
  const [inputValue, setInputValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveCustomerConfig(config);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [config]);

  function addAccountId() {
    const val = inputValue.trim();
    if (!val || config.accountIds.includes(val)) { setInputValue(""); return; }
    setConfig(c => ({ ...c, accountIds: [...c.accountIds, val] }));
    setInputValue("");
  }

  function removeAccountId(id: string) {
    setConfig(c => ({ ...c, accountIds: c.accountIds.filter(a => a !== id) }));
  }

  function toggleShowAll() {
    setConfig(c => ({ ...c, showAll: !c.showAll }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Control which customers appear in the Active Journeys panel.
        </p>
      </div>

      {/* Show All Toggle */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Display Mode
          </CardTitle>
          <CardDescription>
            Choose whether to show all journeys or only the customers you've pinned below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={toggleShowAll}
            className="flex items-center gap-3 group"
          >
            {config.showAll ? (
              <ToggleRight className="w-9 h-9 text-primary" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-muted-foreground group-hover:text-white transition-colors" />
            )}
            <div className="text-left">
              <div className="text-sm font-medium text-white">
                {config.showAll ? "Show all customers" : "Show pinned customers only"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {config.showAll
                  ? "Every journey appears in the Active Journeys list."
                  : "Only account IDs listed below will appear."}
              </div>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Pinned account IDs */}
      <Card className={`bg-card/50 border-border/50 transition-opacity ${config.showAll ? "opacity-50" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Pinned Customer Account IDs
          </CardTitle>
          <CardDescription>
            Account IDs entered here will always appear at the top of the Active Journeys list.
            {config.showAll && (
              <span className="ml-1 text-amber-400">(Enable "pinned only" mode above to filter by this list.)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter account ID, e.g. B0/P0/0001Ye8IAP"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addAccountId(); }}
              className="bg-black/50 border-border text-white font-mono text-sm flex-1"
              disabled={config.showAll}
            />
            <Button
              onClick={addAccountId}
              disabled={config.showAll || !inputValue.trim()}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {config.accountIds.length === 0 ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-black/20 rounded-md p-3 border border-border/30">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>No accounts pinned yet. Add account IDs above to build your watchlist.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {config.accountIds.map(id => (
                <Badge
                  key={id}
                  variant="outline"
                  className="bg-primary/5 border-primary/20 text-primary font-mono text-xs py-1 px-2 flex items-center gap-1.5"
                >
                  {id}
                  <button
                    onClick={() => removeAccountId(id)}
                    className="text-primary/50 hover:text-red-400 transition-colors ml-0.5"
                    disabled={config.showAll}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className={`w-2 h-2 rounded-full transition-colors ${saved ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-transparent"}`} />
        {saved ? "Saved" : "Changes auto-saved to your browser"}
      </div>
    </div>
  );
}

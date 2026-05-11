import { useState } from "react";
import { useListJourneys, useGetCurrentUser, getListJourneysQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Route, ArrowRight, Play, Pause, AlertCircle, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Journeys() {
  const [search, setSearch] = useState("");
  const { data: user } = useGetCurrentUser();
  const { data: journeysData, isLoading } = useListJourneys({ 
    tenantId: user?.tenantId,
    search,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "activated": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "suspended": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "failed": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy": return "text-emerald-500";
      case "degraded": return "text-amber-500";
      case "critical": return "text-red-500";
      default: return "text-slate-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Active Journeys</h1>
          <p className="text-muted-foreground">Monitor and manage customer lifecycle flows.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID or account..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border text-white"
            />
          </div>
          <Button variant="outline" className="border-border hover:bg-white/5">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-card/50" />
          ))
        ) : journeysData?.items?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card/30 rounded-lg border border-border/50">
            <Route className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No journeys found matching your search.</p>
          </div>
        ) : (
          journeysData?.items?.map((journey) => (
            <Link key={journey.id} href={`/journeys/${journey.id}`}>
              <Card className="bg-card/50 border-border/50 hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${getHealthColor(journey.healthStatus)} shadow-[0_0_8px_currentColor]`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-medium text-white truncate">
                          {journey.externalId}
                        </span>
                        <Badge variant="outline" className={getStatusColor(journey.status)}>
                          {journey.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Account: {journey.accountId}</span>
                        {journey.latencyMs && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {journey.latencyMs}ms
                          </span>
                        )}
                        <span>Started: {new Date(journey.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {journey.status === 'suspended' ? (
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                        <Play className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10">
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="w-px h-4 bg-border mx-1" />
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
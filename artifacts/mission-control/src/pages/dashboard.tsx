import { useGetDashboardSummary, useListActivity, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Route, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: user } = useGetCurrentUser();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({ tenantId: user?.tenantId });
  const { data: activities, isLoading: isActivitiesLoading } = useListActivity({ limit: 5, tenantId: user?.tenantId });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Operations Overview</h1>
          <p className="text-muted-foreground">System-wide metrics and recent events.</p>
        </div>
      </div>

      {isSummaryLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full bg-card" />
          <Skeleton className="h-32 w-full bg-card" />
          <Skeleton className="h-32 w-full bg-card" />
          <Skeleton className="h-32 w-full bg-card" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Journeys"
            value={summary?.totalJourneys || 0}
            icon={Route}
            trend="+12% from last hour"
          />
          <StatsCard
            title="Active Flows"
            value={summary?.activeJourneys || 0}
            icon={Activity}
            trend="Live"
            trendColor="text-emerald-400"
          />
          <StatsCard
            title="Suspended / Failed"
            value={(summary?.suspendedJourneys || 0) + (summary?.failedJourneys || 0)}
            icon={AlertTriangle}
            trend="Needs attention"
            trendColor="text-amber-400"
          />
          <StatsCard
            title="Connected Sources"
            value={summary?.connectedDataSources || 0}
            icon={Database}
            trend="All systems nominal"
            trendColor="text-emerald-400"
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Journey Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t border-border/50">
            {/* Chart placeholder - in a real app use Recharts */}
            <div className="text-center text-muted-foreground">
              <div className="inline-block w-48 h-48 rounded-full border-[16px] border-primary/20 border-t-primary border-r-emerald-500 border-l-amber-500 relative">
                <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-xl">
                  {summary?.totalJourneys || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0 border-t border-border/50">
            {isActivitiesLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full bg-card" />
                <Skeleton className="h-12 w-full bg-card" />
                <Skeleton className="h-12 w-full bg-card" />
              </div>
            ) : activities?.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No recent activity.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {activities?.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-border">
                          {activity.eventType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, trendColor = "text-muted-foreground" }: any) {
  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        <p className={`text-xs mt-1 ${trendColor}`}>
          {trend}
        </p>
      </CardContent>
    </Card>
  );
}
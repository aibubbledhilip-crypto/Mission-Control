import { useState } from "react";
import { useListActivity, useGetCurrentUser } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Terminal } from "lucide-react";
import { format } from "date-fns";

export default function Activity() {
  const { data: user } = useGetCurrentUser();
  const { data: activities, isLoading } = useListActivity({ tenantId: user?.tenantId, limit: 100 });
  const [search, setSearch] = useState("");

  const filtered = activities?.filter(a => 
    a.description.toLowerCase().includes(search.toLowerCase()) || 
    a.eventType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Audit Log</h1>
          <p className="text-muted-foreground">System events and operator actions.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search logs..." 
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

      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-border/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-6 py-3 font-medium">Event Type</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array(10).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-white/5" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-white/5" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-64 bg-white/5" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-white/5" /></td>
                    </tr>
                  ))
                ) : filtered?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      <Terminal className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      No events found.
                    </td>
                  </tr>
                ) : (
                  filtered?.map((event) => (
                    <tr key={event.id} className="hover:bg-white/5 transition-colors font-mono">
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="px-6 py-3 text-primary/80">
                        {event.eventType}
                      </td>
                      <td className="px-6 py-3 text-white">
                        {event.description}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {event.userId ? `User ${event.userId}` : "System"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
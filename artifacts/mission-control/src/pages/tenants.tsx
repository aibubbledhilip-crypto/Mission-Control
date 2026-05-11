import { useListTenants, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Tenants() {
  const { data: currentUser } = useGetCurrentUser();
  const { data: tenants, isLoading } = useListTenants();

  if (currentUser?.role !== "superadmin") {
    return <div className="p-8 text-center text-red-400">Unauthorized. Superadmin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tenants</h1>
          <p className="text-muted-foreground">Manage organization workspaces.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> New Tenant
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card/50" />)
        ) : (
          tenants?.map((tenant) => (
            <Card key={tenant.id} className="bg-card/50 border-border/50 hover:border-border transition-colors">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    {tenant.name}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{tenant.slug}</div>
                </div>
                <Badge variant="outline" className={tenant.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}>
                  {tenant.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm mb-4">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="outline" className="bg-white/5 capitalize">{tenant.plan}</Badge>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/50 pt-4">
                  <span>Created {format(new Date(tenant.createdAt), "MMM d, yyyy")}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 hover:text-white">Manage</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
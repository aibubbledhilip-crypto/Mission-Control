import { useState } from "react";
import { 
  useListDataSources, 
  useCreateDataSource, 
  useUpdateDataSource, 
  useDeleteDataSource,
  useTestDataSourceConnection,
  getListDataSourcesQueryKey,
  useGetCurrentUser
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Trash2, Edit, CheckCircle2, XCircle, RefreshCw, Server } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function DataSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: sources, isLoading } = useListDataSources({ tenantId: user?.tenantId });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<any>({
    name: "",
    type: "postgresql",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
  });

  const createMutation = useCreateDataSource();
  const deleteMutation = useDeleteDataSource();
  const testMutation = useTestDataSourceConnection();

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ name: "", type: "postgresql", host: "", port: 5432, database: "", username: "", password: "" });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!user?.tenantId) return;
    
    const payload = { ...formData, tenantId: user.tenantId };
    
    if (editingId) {
      // update mutation would go here if implemented in UI
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDataSourcesQueryKey({ tenantId: user.tenantId }) });
          setIsDialogOpen(false);
          toast({ title: "Data source created" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDataSourcesQueryKey({ tenantId: user?.tenantId }) });
        toast({ title: "Data source deleted" });
      }
    });
  };

  const handleTest = (id: number) => {
    testMutation.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListDataSourcesQueryKey({ tenantId: user?.tenantId }) });
        if (res.success) {
          toast({ title: "Connection successful", description: `${res.message} (${res.latencyMs}ms)` });
        } else {
          toast({ title: "Connection failed", description: res.message, variant: "destructive" });
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Data Sources</h1>
          <p className="text-muted-foreground">Manage connections to external databases and APIs.</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Add Connector
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card/50" />)
        ) : sources?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-border border-dashed rounded-lg bg-card/20">
            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data sources configured.</p>
            <Button onClick={handleOpenCreate} variant="outline" className="mt-4 border-border">Add your first source</Button>
          </div>
        ) : (
          sources?.map((source) => (
            <Card key={source.id} className="bg-card/50 border-border/50 hover:border-border transition-colors">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    {source.name}
                  </CardTitle>
                  <CardDescription className="uppercase tracking-wider text-[10px] mt-1 font-semibold">
                    {source.type}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={`
                  ${source.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                  ${source.status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                  ${source.status === 'testing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                  ${source.status === 'disconnected' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : ''}
                `}>
                  {source.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-6">
                  {source.host && <div className="flex justify-between"><span className="text-muted-foreground">Host</span><span className="text-white font-mono">{source.host}:{source.port}</span></div>}
                  {source.database && <div className="flex justify-between"><span className="text-muted-foreground">Database</span><span className="text-white">{source.database}</span></div>}
                  {source.project && <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="text-white">{source.project}</span></div>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTest(source.id)} disabled={testMutation.isPending && testMutation.variables?.id === source.id} className="flex-1 bg-white/5 border-border hover:bg-white/10 hover:text-white">
                    {testMutation.isPending && testMutation.variables?.id === source.id ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-2" />}
                    Test
                  </Button>
                  <Button variant="outline" size="icon" className="bg-white/5 border-border hover:bg-white/10 hover:text-white">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDelete(source.id)} className="bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="bg-black/50 border-border" placeholder="e.g. Production DB" />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                <SelectTrigger className="bg-black/50 border-border">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="oracle">Oracle</SelectItem>
                  <SelectItem value="snowflake">Snowflake</SelectItem>
                  <SelectItem value="bigquery">BigQuery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(formData.type === 'postgresql' || formData.type === 'mysql' || formData.type === 'oracle') && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 grid gap-2">
                    <Label htmlFor="host">Host</Label>
                    <Input id="host" value={formData.host} onChange={(e) => setFormData({...formData, host: e.target.value})} className="bg-black/50 border-border" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="port">Port</Label>
                    <Input type="number" id="port" value={formData.port} onChange={(e) => setFormData({...formData, port: Number(e.target.value)})} className="bg-black/50 border-border" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="database">Database</Label>
                  <Input id="database" value={formData.database} onChange={(e) => setFormData({...formData, database: e.target.value})} className="bg-black/50 border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="bg-black/50 border-border" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input type="password" id="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="bg-black/50 border-border" />
                  </div>
                </div>
              </>
            )}
            
            {formData.type === 'snowflake' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="account">Account</Label>
                  <Input id="account" value={formData.account || ""} onChange={(e) => setFormData({...formData, account: e.target.value})} className="bg-black/50 border-border" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="warehouse">Warehouse</Label>
                  <Input id="warehouse" value={formData.warehouse || ""} onChange={(e) => setFormData({...formData, warehouse: e.target.value})} className="bg-black/50 border-border" />
                </div>
                {/* username/password similar to above */}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || !formData.name} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Save Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
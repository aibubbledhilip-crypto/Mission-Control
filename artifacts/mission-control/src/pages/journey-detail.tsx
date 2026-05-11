import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetJourney, 
  useListJourneyNodes, 
  useSuspendJourney, 
  useResumeJourney,
  getGetJourneyQueryKey,
  getListJourneyNodesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Maximize, Minimize, Pause, Play, RefreshCw, Settings, ShieldAlert, X } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function FlowCanvas({ nodes, onNodeClick, selectedNodeId }: any) {
  // A simplified SVG canvas rendering the nodes and edges
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0f18] rounded-xl border border-border/50">
      {/* Grid Background */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }} />

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Draw edges */}
        {nodes.filter((n: any) => n.parentNodeId).map((node: any) => {
          const parent = nodes.find((n: any) => n.id === node.parentNodeId);
          if (!parent) return null;
          
          // Simplified bezier curve from parent to child
          const startX = parent.positionX + 160;
          const startY = parent.positionY + 40;
          const endX = node.positionX;
          const endY = node.positionY + 40;
          
          const path = `M ${startX} ${startY} C ${startX + 100} ${startY}, ${endX - 100} ${endY}, ${endX} ${endY}`;
          
          return (
            <path 
              key={`edge-${node.id}`}
              d={path}
              fill="none"
              stroke="rgba(14,165,233,0.3)"
              strokeWidth="2"
              className={node.status === 'running' ? 'animate-pulse' : ''}
            />
          );
        })}
      </svg>

      {/* Draw nodes */}
      {nodes.map((node: any) => (
        <div
          key={node.id}
          onClick={() => onNodeClick(node.id)}
          className={`absolute cursor-pointer transition-all duration-200 ${selectedNodeId === node.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0a0f18] scale-105 z-10' : 'hover:scale-105 z-0'}`}
          style={{
            left: node.positionX,
            top: node.positionY,
            width: 160,
          }}
        >
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {node.nodeType}
            </div>
            <div className="text-sm font-bold text-white truncate">
              {node.name}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                node.status === 'passed' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                node.status === 'failed' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                node.status === 'running' ? 'bg-primary animate-pulse shadow-[0_0_8px_#0ea5e9]' :
                node.status === 'skipped' ? 'bg-slate-500' :
                'bg-amber-500'
              }`} />
              <span className="text-[10px] text-muted-foreground capitalize">{node.status}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JourneyDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: detail, isLoading } = useGetJourney(id, {
    query: { enabled: !!id, queryKey: getGetJourneyQueryKey(id) }
  });

  const suspendMutation = useSuspendJourney();
  const resumeMutation = useResumeJourney();

  const handleSuspend = () => {
    suspendMutation.mutate(
      { id, data: { reason: "requested", notes: suspendReason } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJourneyQueryKey(id) });
          setSuspendDialogOpen(false);
        }
      }
    );
  };

  const handleResume = () => {
    resumeMutation.mutate(
      { id, data: { notes: "Manually resumed" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJourneyQueryKey(id) });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-[600px] w-full bg-card/50 rounded-xl" /></div>;
  }

  if (!detail) {
    return <div className="p-8 text-center">Journey not found</div>;
  }

  const journey = detail.journey;
  const nodes = detail.nodes ?? [];
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="h-[calc(100vh-4rem-48px)] flex flex-col -m-6 md:-m-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/journeys')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold font-mono text-white">{journey.externalId}</h2>
              <Badge variant="outline" className={`
                ${journey.status === 'activated' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                ${journey.status === 'suspended' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                ${journey.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
              `}>
                {journey.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Account: {journey.accountId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right mr-4 hidden sm:block">
            <div className="text-xs text-muted-foreground">Started</div>
            <div className="text-sm font-medium text-white">{journey.startedAt ? format(new Date(journey.startedAt), 'PP HH:mm:ss') : 'N/A'}</div>
          </div>
          
          {journey.status === 'suspended' ? (
            <Button onClick={handleResume} className="bg-emerald-600 hover:bg-emerald-500 text-white" disabled={resumeMutation.isPending}>
              <Play className="w-4 h-4 mr-2" /> Resume Flow
            </Button>
          ) : journey.status !== 'completed' && journey.status !== 'failed' ? (
            <Button onClick={() => setSuspendDialogOpen(true)} variant="outline" className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10">
              <Pause className="w-4 h-4 mr-2" /> Suspend
            </Button>
          ) : null}
          
          <Button variant="destructive" size="icon" className="w-10 h-10">
            <ShieldAlert className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 relative bg-black">
          <div className="absolute top-4 right-4 z-20 flex bg-card border border-border rounded-md shadow-lg overflow-hidden">
            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(50, zoom - 10))} className="h-8 w-8 rounded-none border-r border-border">
              <Minimize className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-center w-12 text-xs font-medium text-white">
              {zoom}%
            </div>
            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(200, zoom + 10))} className="h-8 w-8 rounded-none border-l border-border">
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="w-full h-full overflow-auto" style={{ transform: `scale(${zoom/100})`, transformOrigin: 'top left' }}>
             <FlowCanvas nodes={nodes} onNodeClick={setSelectedNodeId} selectedNodeId={selectedNodeId} />
          </div>
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="w-80 border-l border-border bg-card/80 backdrop-blur overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-bold text-white truncate pr-2">{selectedNode.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-8 w-8 shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-6">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Status</div>
                <Badge variant="outline" className="bg-white/5">{selectedNode.status.toUpperCase()}</Badge>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Type</div>
                <div className="text-sm font-medium text-white">{selectedNode.nodeType}</div>
              </div>

              {selectedNode.config && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Configuration</div>
                  <pre className="text-xs bg-black/50 p-3 rounded-md border border-border/50 overflow-x-auto text-primary/80 font-mono">
                    {JSON.stringify(selectedNode.config, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Timestamps</div>
                <div className="space-y-2 text-sm text-white">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{format(new Date(selectedNode.updatedAt), 'HH:mm:ss.SSS')}</span>
                  </div>
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
            <Button onClick={handleSuspend} disabled={suspendMutation.isPending} className="bg-amber-600 hover:bg-amber-500 text-white">
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
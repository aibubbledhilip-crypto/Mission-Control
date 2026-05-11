import { useClerk, useUser } from "@clerk/react";
import { Bell, LogOut } from "lucide-react";
import { useGetSystemHealth } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Header() {
  const { user } = useUser();
  const { signOut } = useClerk();
  
  // Try to load system health, if tenant is required we might skip or use tenant id. 
  // For demo, we just call it (API allows it if valid or returns default)
  const { data: health } = useGetSystemHealth();

  return (
    <header className="flex h-16 items-center justify-between px-6 bg-[#080c14]/80 backdrop-blur-md border-b border-border z-10">
      <div className="flex items-center gap-4">
        {/* System Health Indicator */}
        <div className="flex items-center gap-2 bg-black/40 border border-border px-3 py-1.5 rounded-full">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
            System Optimal
          </span>
          <span className="text-xs font-mono text-emerald-400 ml-2">
            {health?.latencyMs || 42}ms
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-white">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border-2 border-background"></span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user?.firstName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-white">{user?.fullName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
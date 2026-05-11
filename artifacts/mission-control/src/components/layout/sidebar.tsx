import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Database, 
  LayoutDashboard, 
  Settings, 
  Users, 
  Building2,
  Route as RouteIcon,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Journeys", href: "/journeys", icon: RouteIcon },
    { name: "Data Sources", href: "/data-sources", icon: Database },
    { name: "Activity", href: "/activity", icon: Activity },
    { name: "Configuration", href: "/configuration", icon: SlidersHorizontal },
  ];

  const adminNavigation = [
    { name: "Tenants", href: "/tenants", icon: Building2 },
    { name: "Users", href: "/users", icon: Users },
  ];

  const bottomNavigation = [
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  function NavItem({ item }: { item: { name: string; href: string; icon: React.ComponentType<any> } }) {
    const isActive = location.startsWith(item.href);
    const link = (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
          collapsed ? "justify-center" : "",
          isActive
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
        )}
      >
        <item.icon
          className={cn(
            "flex-shrink-0 h-5 w-5 transition-colors",
            collapsed ? "" : "mr-3",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
          )}
          aria-hidden="true"
        />
        {!collapsed && item.name}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.name}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  return (
    <div className={cn(
      "flex h-full flex-col bg-[#080c14] border-r border-border transition-all duration-300 relative",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-border/50 overflow-hidden",
        collapsed ? "justify-center px-2" : "gap-3 px-6"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 border border-primary/20 shrink-0">
          <img src="/logo.svg" alt="MC Logo" className="w-5 h-5" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-widest text-primary whitespace-nowrap">MISSION CONTROL</span>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-50 flex items-center justify-center w-6 h-6 rounded-full bg-[#080c14] border border-border text-muted-foreground hover:text-white hover:border-primary/40 transition-colors shadow-md"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Operations
          </div>
        )}
        {navigation.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="mt-8 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administration
              </div>
            )}
            {collapsed && <div className="mt-4 mb-1 border-t border-border/30" />}
            {adminNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className="p-2 border-t border-border/50">
        {bottomNavigation.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

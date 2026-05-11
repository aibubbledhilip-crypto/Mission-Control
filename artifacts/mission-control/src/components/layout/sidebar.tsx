import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Database, 
  LayoutDashboard, 
  Settings, 
  Users, 
  Building2,
  Route as RouteIcon
} from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Journeys", href: "/journeys", icon: RouteIcon },
    { name: "Data Sources", href: "/data-sources", icon: Database },
    { name: "Activity", href: "/activity", icon: Activity },
  ];

  const adminNavigation = [
    { name: "Tenants", href: "/tenants", icon: Building2 },
    { name: "Users", href: "/users", icon: Users },
  ];

  const bottomNavigation = [
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-[#080c14] border-r border-border">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border/50">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 border border-primary/20">
          <img src="/logo.svg" alt="MC Logo" className="w-5 h-5" />
        </div>
        <span className="text-sm font-bold tracking-widest text-primary">MISSION CONTROL</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Operations
        </div>
        {navigation.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 flex-shrink-0 h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="mt-8 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Administration
            </div>
            {adminNavigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border/50">
        {bottomNavigation.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 flex-shrink-0 h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
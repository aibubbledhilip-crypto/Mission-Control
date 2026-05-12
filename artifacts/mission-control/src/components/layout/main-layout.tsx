import { useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      {/* Radial gradient for top accent */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15),transparent_50%)] pointer-events-none"></div>

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 relative z-0 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

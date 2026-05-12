import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";

import MainLayout from "@/components/layout/main-layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Journeys from "@/pages/journeys";
import JourneyDetail from "@/pages/journey-detail";
import DataSources from "@/pages/data-sources";
import Tenants from "@/pages/tenants";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import Activity from "@/pages/activity";
import Configuration from "@/pages/configuration";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ component: Component, params }: { component: React.ComponentType<any>; params?: Record<string, string> }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <MainLayout>
      <Component params={params} />
    </MainLayout>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/dashboard" />;
  return <Redirect to="/login" />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/journeys"><ProtectedRoute component={Journeys} /></Route>
      <Route path="/journeys/:id">{(params) => <ProtectedRoute component={JourneyDetail} params={params as Record<string, string>} />}</Route>
      <Route path="/data-sources"><ProtectedRoute component={DataSources} /></Route>
      <Route path="/tenants"><ProtectedRoute component={Tenants} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route path="/activity"><ProtectedRoute component={Activity} /></Route>
      <Route path="/configuration"><ProtectedRoute component={Configuration} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="mc-theme">
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={basePath}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </WouterRouter>
        </QueryClientProvider>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;

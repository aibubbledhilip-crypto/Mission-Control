import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/components/theme-provider";

import MainLayout from "@/components/layout/main-layout";
import Landing from "@/pages/landing";
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

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(199 89% 48%)", // cyan/teal
    colorForeground: "hsl(210 40% 98%)",
    colorMutedForeground: "hsl(215 20.2% 65.1%)",
    colorBackground: "hsl(222 47% 9%)",
    colorInput: "hsl(217 32% 17%)",
    colorInputForeground: "hsl(210 40% 98%)",
    colorNeutral: "hsl(217 32% 17%)",
    colorDanger: "hsl(0 62.8% 30.6%)",
    fontFamily: "'Inter', sans-serif",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0c121e] border border-border shadow-2xl rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-white",
    headerSubtitle: "text-muted-foreground",
    formFieldLabel: "text-sm font-medium text-white",
    formFieldInput: "bg-input border-border text-white placeholder:text-muted-foreground",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold",
    socialButtonsBlockButton: "border-border hover:bg-white/5 text-white",
    socialButtonsBlockButtonText: "text-white font-medium",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component, params }: { component: React.ComponentType<any>; params?: Record<string, string> }) {
  return (
    <>
      <Show when="signed-in">
        <MainLayout>
          <Component params={params} />
        </MainLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
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
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="mc-theme">
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, ShieldAlert, Zap, Globe2, ActivitySquare } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      <header className="relative z-10 px-6 lg:px-12 py-6 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Mission Control" className="w-8 h-8" />
          <span className="text-xl font-bold tracking-widest text-primary">MISSION CONTROL</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-none px-6">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 text-center pt-20 pb-32">
        <Badge className="mb-8 border-primary/30 bg-primary/10 text-primary text-sm px-4 py-1">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          System Online
        </Badge>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl text-white mb-8">
          The War Room for <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-300">
            Customer Journeys
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mb-12">
          Monitor, manage, and debug enterprise customer lifecycle flows in real-time. High-density operations console built for telecom and SaaS.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 rounded-none border border-primary/50 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
              Initialize Dashboard
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-none border-border hover:bg-white/5">
              Access Console
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-24">
          {[
            {
              icon: ActivitySquare,
              title: "Real-Time Telemetry",
              description: "Watch customer states flow through your systems with sub-second latency."
            },
            {
              icon: Globe2,
              title: "Multi-Source Integrations",
              description: "Connect to Postgres, Snowflake, Athena, Kafka, and view the truth."
            },
            {
              icon: ShieldAlert,
              title: "Incident Control",
              description: "Suspend, resume, and intervene in failing journeys before the customer notices."
            }
          ].map((feature, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-6 text-left hover:bg-white/10 transition-colors">
              <feature.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Badge({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
}
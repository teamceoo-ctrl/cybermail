import { useGetDashboardMetrics, useGetRecentActivity } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Activity, Mail, Users, ShieldAlert, CheckCircle, XCircle, AlertTriangle, TrendingUp, Send, Target, Upload, Plus, Zap } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

function StatBar({ value, max = 100, color = "primary" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1 bg-border rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${color === "warning" ? "bg-warning shadow-[0_0_6px_rgba(255,204,0,0.7)]" : color === "destructive" ? "bg-destructive shadow-[0_0_6px_rgba(255,0,64,0.7)]" : "bg-primary shadow-[0_0_6px_rgba(0,255,65,0.7)]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function QuickAction({ label, desc, icon: Icon, path, color = "primary" }: { label: string; desc: string; icon: any; path: string; color?: string }) {
  const [, navigate] = useLocation();
  return (
    <button onClick={() => navigate(path)}
      className={`p-3 text-left border rounded transition-all hover:scale-[1.02] active:scale-[0.98] group ${
        color === "primary"
          ? "border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(0,255,65,0.2)]"
          : color === "warning"
          ? "border-warning/30 bg-warning/5 hover:bg-warning/10 hover:border-warning/60"
          : "border-border/40 bg-background/30 hover:bg-primary/5 hover:border-primary/30"
      }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color === "primary" ? "text-primary" : color === "warning" ? "text-warning" : "text-muted-foreground group-hover:text-primary"}`} />
        <span className={`font-mono text-[10px] font-bold tracking-wider ${color === "primary" ? "text-primary" : color === "warning" ? "text-warning" : "text-muted-foreground group-hover:text-primary"}`}>{label}</span>
      </div>
      <p className="font-mono text-[9px] text-muted-foreground/70 leading-tight">{desc}</p>
    </button>
  );
}

export default function Dashboard() {
  const { data: metrics, isLoading: loadingMetrics, isError: errorMetrics } = useGetDashboardMetrics();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();

  if (loadingMetrics || loadingActivity) {
    return (
      <div className="flex items-center justify-center h-full">
        <TerminalText text="> INITIATING SECURE HANDSHAKE... FETCHING TELEMETRY..." className="text-primary text-lg" speed={30} />
      </div>
    );
  }

  if (errorMetrics || !metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <TerminalText text="> ERROR: CONNECTION LOST TO MAINFRAME." className="text-destructive neon-text-destructive text-lg" speed={20} />
      </div>
    );
  }

  const reputationColor = metrics.reputationScore >= 90 ? "primary" : metrics.reputationScore >= 70 ? "warning" : "destructive";

  return (
    <PageTransition className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">COMMAND_CENTER</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {format(new Date(), "yyyy-MM-dd")} · SYSTEM_STATUS: <span className="text-primary">OPERATIONAL</span>
          </p>
        </div>
        <div className="px-3 py-1.5 bg-primary/10 border border-primary/50 rounded-sm font-mono text-xs text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          LIVE_FEED
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-2">QUICK_ACTIONS</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickAction label="NEW_CAMPAIGN" desc="Compose & arm a broadcast" icon={Send} path="/campaigns" color="primary" />
          <QuickAction label="IMPORT_CONTACTS" desc="Bulk upload contact list" icon={Upload} path="/contacts" color="default" />
          <QuickAction label="SCRAPE_LEADS" desc="Launch Advanced Finder" icon={Target} path="/lead-scraper" color="warning" />
          <QuickAction label="CHECK_SMTP" desc="Verify relay connections" icon={Zap} path="/smtp-profiles" color="default" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="terminal-panel group hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] transition-shadow">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 tracking-widest">
              <Users className="w-3.5 h-3.5 text-primary" /> TOTAL_CONTACTS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-foreground neon-text">{metrics.totalContacts.toLocaleString()}</div>
            <StatBar value={metrics.totalContacts} max={Math.max(metrics.totalContacts, 10000)} />
          </CardContent>
        </Card>

        <Card className="terminal-panel group hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] transition-shadow">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 tracking-widest">
              <Send className="w-3.5 h-3.5 text-primary" /> CAMPAIGNS_SENT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-foreground neon-text">{metrics.campaignsSent.toLocaleString()}</div>
            <StatBar value={metrics.campaignsSent} max={Math.max(metrics.campaignsSent, 20)} />
          </CardContent>
        </Card>

        <Card className="terminal-panel group hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] transition-shadow">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 tracking-widest">
              <TrendingUp className="w-3.5 h-3.5 text-primary" /> DELIVERY_RATE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-foreground neon-text">{metrics.deliveryRate.toFixed(1)}%</div>
            <StatBar value={metrics.deliveryRate} max={100} color={metrics.deliveryRate >= 95 ? "primary" : metrics.deliveryRate >= 80 ? "warning" : "destructive"} />
          </CardContent>
        </Card>

        <Card className="terminal-panel group hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] transition-shadow">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 tracking-widest">
              <ShieldAlert className="w-3.5 h-3.5 text-warning" /> REPUTATION
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-mono ${reputationColor === "primary" ? "text-primary neon-text" : reputationColor === "warning" ? "text-warning neon-text-warning" : "text-destructive"}`}>
              {metrics.reputationScore}<span className="text-base text-muted-foreground">/100</span>
            </div>
            <StatBar value={metrics.reputationScore} max={100} color={reputationColor} />
          </CardContent>
        </Card>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "OPEN_RATE", value: metrics.openRate ?? 0, warn: false },
          { label: "CLICK_RATE", value: metrics.clickRate ?? 0, warn: false },
          { label: "BOUNCE_RATE", value: metrics.bounceRate ?? 0, warn: true },
        ].map(({ label, value, warn }) => (
          <Card key={label} className="terminal-panel">
            <CardContent className="pt-4">
              <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">{label}</div>
              <div className={`text-2xl font-bold font-mono ${warn && value > 5 ? "text-destructive" : "text-primary neon-text"}`}>
                {value.toFixed(warn ? 2 : 1)}%
              </div>
              <StatBar value={value} max={warn ? 10 : 100} color={warn && value > 5 ? "destructive" : "primary"} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="terminal-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-primary flex items-center gap-2 border-b border-border pb-2">
              <Activity className="w-4 h-4" /> {'>'} CAMPAIGN_PERFORMANCE_MATRIX
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.recentCampaigns}>
                <defs>
                  <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} fontFamily="monospace" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} fontFamily="monospace" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--primary))", borderRadius: "4px", fontFamily: "monospace" }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                  labelStyle={{ color: "hsl(var(--foreground))", marginBottom: "4px" }}
                  formatter={(val: number) => [`${val.toFixed(1)}%`, "DELIVERY_RATE"]}
                />
                <Area type="monotone" dataKey="deliveryRate" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#deliveryGrad)"
                  dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="terminal-panel flex flex-col" style={{ maxHeight: "360px" }}>
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-sm font-mono text-primary flex items-center gap-2 border-b border-border pb-2">
              <Mail className="w-4 h-4" /> {'>'} LIVE_SYSTEM_LOG
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-0 pt-0">
            <div className="space-y-0">
              {activity?.map((log, i) => (
                <div key={i} className="px-4 py-2.5 border-b border-border/40 flex flex-col gap-0.5 hover:bg-primary/5 transition-colors group cursor-default">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/60">{format(new Date(log.timestamp), "HH:mm:ss")}</span>
                    {["delivered", "opened", "clicked", "sent"].includes(log.type) ? (
                      <span className="text-primary flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> {log.type.toUpperCase()}</span>
                    ) : ["bounced", "complained"].includes(log.type) ? (
                      <span className="text-destructive flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> {log.type.toUpperCase()}</span>
                    ) : (
                      <span className="text-warning flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> {log.type.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-xs font-mono truncate text-foreground group-hover:text-primary transition-colors">{log.email}</div>
                  <div className="text-[10px] text-muted-foreground/50 font-mono truncate">{log.campaignName}</div>
                </div>
              ))}
              {!activity?.length && (
                <div className="p-6 text-center text-sm font-mono text-muted-foreground">NO_EVENTS_RECORDED</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

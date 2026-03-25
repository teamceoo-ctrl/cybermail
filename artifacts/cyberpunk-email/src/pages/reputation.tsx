import { useGetReputationStatus } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ShieldAlert, XCircle, Info, ShieldCheck, Send, TrendingUp } from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? "hsl(130 100% 45%)" : score >= 70 ? "hsl(40 100% 50%)" : "hsl(350 100% 55%)";
  const textColor = score >= 90 ? "text-primary neon-text" : score >= 70 ? "text-warning neon-text-warning" : "text-destructive";
  const label = score >= 90 ? "EXCELLENT" : score >= 70 ? "FAIR" : "CRITICAL";

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
              transition: "stroke-dashoffset 1.2s ease-in-out"
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold font-mono ${textColor}`}>{score}</span>
          <span className="text-[10px] font-mono text-muted-foreground">/100</span>
        </div>
      </div>
      <span className={`font-mono text-xs tracking-widest mt-2 ${textColor}`}>{label}</span>
    </div>
  );
}

function MetricBar({ label, value, max, unit = "" }: { label: string; value: number; max: number; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{value.toLocaleString()}{unit}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_6px_rgba(0,255,65,0.6)] transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Reputation() {
  const { data, isLoading, isError } = useGetReputationStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <TerminalText text="> SCANNING DNS RECORDS & BLACKLISTS..." className="text-primary text-lg" speed={25} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <TerminalText text="> ERROR: FAILED TO RETRIEVE REPUTATION DATA." className="text-destructive neon-text-destructive text-lg" speed={20} />
      </div>
    );
  }

  const getAuthBadge = (status: string) => {
    if (status === 'pass') return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50 font-mono text-[10px]"><CheckCircle className="w-3 h-3 mr-1"/> PASS</Badge>;
    if (status === 'fail') return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/50 font-mono text-[10px]"><XCircle className="w-3 h-3 mr-1"/> FAIL</Badge>;
    return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50 font-mono text-[10px]"><Info className="w-3 h-3 mr-1"/> MISSING</Badge>;
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">REPUTATION_MONITOR</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            DOMAIN: <span className="text-foreground">{data.domainAuth.domain}</span>
            {" · "}
            IP: <span className="text-foreground">{data.ipReputation.ip}</span>
          </p>
        </div>
        {data.alerts.length > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/50 font-mono">
            <ShieldAlert className="w-3 h-3 mr-1 animate-pulse" /> {data.alerts.length} ALERT{data.alerts.length !== 1 ? "S" : ""}
          </Badge>
        )}
      </div>

      {data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map(alert => (
            <div key={alert.id} className={`p-4 border rounded bg-card/80 backdrop-blur flex items-start gap-4 ${
              alert.severity === 'critical' ? 'border-destructive shadow-[0_0_15px_rgba(255,0,64,0.25)]' :
              alert.severity === 'warning' ? 'border-warning shadow-[0_0_15px_rgba(255,204,0,0.15)]' : 'border-primary shadow-[0_0_15px_rgba(0,255,65,0.15)]'
            }`}>
              {alert.severity === 'critical' ? <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5 animate-pulse" /> :
               alert.severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" /> :
               <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <h3 className={`font-mono font-bold ${
                  alert.severity === 'critical' ? 'text-destructive' :
                  alert.severity === 'warning' ? 'text-warning' : 'text-primary'
                }`}>{'> '}{alert.title}</h3>
                <p className="font-mono text-sm text-muted-foreground mt-1">{alert.description}</p>
                {alert.recommendations.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {alert.recommendations.map((rec, i) => (
                      <li key={i} className="font-mono text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0">{'>'}</span> {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="terminal-panel">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-mono text-primary flex items-center justify-center gap-2 border-b border-border pb-2">
              <ShieldCheck className="w-4 h-4" /> OVERALL_SCORE
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <ScoreRing score={data.overallScore} />
          </CardContent>
        </Card>

        <Card className="terminal-panel">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-primary border-b border-border pb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> {'>'} DNS_AUTH_STATUS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">DOMAIN</span>
              <span className="font-mono text-xs text-foreground">{data.domainAuth.domain}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">SPF</span>
              {getAuthBadge(data.domainAuth.spfStatus)}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">DKIM</span>
              {getAuthBadge(data.domainAuth.dkimStatus)}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">DMARC</span>
              {getAuthBadge(data.domainAuth.dmarcStatus)}
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="font-mono text-[10px] text-muted-foreground/60">
                AUTH_SCORE: {[data.domainAuth.spfStatus, data.domainAuth.dkimStatus, data.domainAuth.dmarcStatus].filter(s => s === 'pass').length}/3 RECORDS PASSING
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="terminal-panel">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-primary border-b border-border pb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> {'>'} IP_HEALTH
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">IP_ADDRESS</span>
              <span className="font-mono text-xs text-foreground">{data.ipReputation.ip}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">BLACKLIST</span>
              {data.ipReputation.blacklisted ? (
                <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/50 font-mono text-[10px]">
                  <XCircle className="w-3 h-3 mr-1" /> LISTED
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50 font-mono text-[10px]">
                  <CheckCircle className="w-3 h-3 mr-1" /> CLEAN
                </Badge>
              )}
            </div>
            {data.ipReputation.blacklisted && data.ipReputation.blacklists.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <span className="font-mono text-[10px] text-destructive tracking-wider">LISTED_IN:</span>
                <ul className="mt-1.5 space-y-1">
                  {data.ipReputation.blacklists.map((bl, i) => (
                    <li key={i} className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                      <XCircle className="w-3 h-3 text-destructive shrink-0" /> {bl}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.sendingMetrics && (
        <Card className="terminal-panel">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-primary border-b border-border pb-2 flex items-center gap-2">
              <Send className="w-4 h-4" /> {'>'} SENDING_METRICS_OVERVIEW
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricBar label="EMAILS_SENT_30D" value={data.sendingMetrics.emailsSent30d ?? 0} max={Math.max(data.sendingMetrics.emailsSent30d ?? 0, 100000)} />
              <MetricBar label="DELIVERY_RATE" value={Math.round((data.sendingMetrics.deliveryRate ?? 0))} max={100} unit="%" />
              <MetricBar label="OPEN_RATE" value={Math.round((data.sendingMetrics.openRate ?? 0))} max={100} unit="%" />
              <MetricBar label="BOUNCE_RATE" value={Number((data.sendingMetrics.bounceRate ?? 0).toFixed(2))} max={10} unit="%" />
            </div>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}

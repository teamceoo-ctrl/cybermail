import { useState, useCallback, useEffect, useRef } from "react";
import { useListDeliveryLogs } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { format, subHours } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Activity, Download, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListDeliveryLogsStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

function buildHourlyData(logs: any[]) {
  const buckets: Record<string, { hour: string; delivered: number; bounced: number; complained: number; failed: number; sent: number }> = {};

  for (let i = 11; i >= 0; i--) {
    const d = subHours(new Date(), i);
    const key = format(d, "HH:00");
    buckets[key] = { hour: key, delivered: 0, bounced: 0, complained: 0, failed: 0, sent: 0 };
  }

  for (const log of logs) {
    const key = format(new Date(log.timestamp), "HH:00");
    if (!buckets[key]) continue;
    const status = log.status as string;
    if (status === "delivered") buckets[key].delivered++;
    else if (status === "bounced") buckets[key].bounced++;
    else if (status === "complained") buckets[key].complained++;
    else if (status === "failed") buckets[key].failed++;
    else if (status === "sent") buckets[key].sent++;
  }

  return Object.values(buckets);
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "hsl(140 15% 4%)", border: "1px solid hsl(130 100% 45% / 0.4)", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" },
  itemStyle: { color: "hsl(130 100% 45%)" },
  labelStyle: { color: "hsl(0 0% 80%)", marginBottom: "4px" },
};

export default function DeliveryLogs() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<ListDeliveryLogsStatus | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { data, isLoading, refetch, isFetching } = useListDeliveryLogs({ status: statusFilter, limit: 200 });
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => refetch(), 15000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, refetch]);

  const exportCSV = useCallback(() => {
    if (!data?.logs.length) return;
    const header = ["TIMESTAMP", "TARGET_EMAIL", "CAMPAIGN", "STATUS", "DIAGNOSTIC"];
    const rows = data.logs.map(l => [
      format(new Date(l.timestamp), "yyyy-MM-dd HH:mm:ss"),
      l.contactEmail, l.campaignName, l.status, l.statusMessage ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `cybermail_logs_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "EXPORT_COMPLETE", description: `${data.logs.length} records written`, className: "border-primary bg-background text-primary font-mono" });
  }, [data, toast]);

  const statusCounts = data?.logs.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = buildHourlyData(data?.logs ?? []);
  const hasChartData = chartData.some(b => b.delivered + b.bounced + b.complained + b.failed + b.sent > 0);

  return (
    <PageTransition className="space-y-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">DATASTREAM_LOGS</h1>
          {data && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {data.logs.length} RECORDS
              {statusCounts && Object.entries(statusCounts).map(([s, n]) => (
                <span key={s} className="ml-2">· {s.toUpperCase()}: {n}</span>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2 py-1 border border-border/40 rounded">
            <span className="font-mono text-[10px] text-muted-foreground">AUTO_REFRESH</span>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="data-[state=checked]:bg-primary" />
            {autoRefresh && <span className="font-mono text-[9px] text-primary animate-pulse">15s</span>}
          </div>
          <Select value={statusFilter ?? "all"} onValueChange={v => setStatusFilter(v === "all" ? undefined : v as ListDeliveryLogsStatus)}>
            <SelectTrigger className="font-mono bg-card border-border text-primary w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border font-mono text-foreground">
              <SelectItem value="all">ALL_RECORDS</SelectItem>
              <SelectItem value="sent">SENT</SelectItem>
              <SelectItem value="delivered">DELIVERED</SelectItem>
              <SelectItem value="bounced">BOUNCED</SelectItem>
              <SelectItem value="complained">COMPLAINED</SelectItem>
              <SelectItem value="failed">FAILED</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="font-mono border-border text-muted-foreground hover:text-primary hover:border-primary/50" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" className="font-mono border-primary/50 text-primary hover:bg-primary hover:text-black" onClick={exportCSV} disabled={!data?.logs.length}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> EXPORT_CSV
          </Button>
        </div>
      </div>

      {/* Hourly chart */}
      {hasChartData && (
        <Card className="terminal-panel border-primary/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="font-mono text-xs text-primary flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> DELIVERY_VOLUME — LAST 12H (HOURLY)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={14} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} fontFamily="monospace" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} fontFamily="monospace" allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))" }} />
                  <Bar dataKey="delivered" name="DELIVERED" fill="hsl(130 100% 45%)" radius={[2, 2, 0, 0]} opacity={0.85} />
                  <Bar dataKey="sent" name="SENT" fill="hsl(130 100% 45% / 0.4)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="bounced" name="BOUNCED" fill="hsl(350 100% 55%)" radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Bar dataKey="complained" name="COMPLAINED" fill="hsl(40 100% 50%)" radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Bar dataKey="failed" name="FAILED" fill="hsl(350 100% 55% / 0.5)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="terminal-panel flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center text-primary"><TerminalText text="> TAIL -F /VAR/LOG/MAIL.LOG..." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-background/50 sticky top-0 backdrop-blur z-10">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-primary text-xs w-[150px]">TIMESTAMP</TableHead>
                  <TableHead className="font-mono text-primary text-xs">TARGET</TableHead>
                  <TableHead className="font-mono text-primary text-xs">SOURCE_CAMPAIGN</TableHead>
                  <TableHead className="font-mono text-primary text-xs w-[120px]">STATUS</TableHead>
                  <TableHead className="font-mono text-primary text-xs hidden md:table-cell">DIAGNOSTIC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.logs.map(log => (
                  <TableRow key={log.id} className="border-border/50 hover:bg-primary/10 transition-colors cursor-default group">
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.timestamp), "yy-MM-dd HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">{log.contactEmail}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{log.campaignName}</TableCell>
                    <TableCell>
                      {["delivered", "sent"].includes(log.status) ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono uppercase text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" /> {log.status}
                        </Badge>
                      ) : ["failed", "bounced", "complained"].includes(log.status) ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-mono uppercase text-[10px]">
                          <XCircle className="w-3 h-3 mr-1" /> {log.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 font-mono uppercase text-[10px]">
                          <AlertTriangle className="w-3 h-3 mr-1" /> {log.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground/60 hidden md:table-cell truncate max-w-[250px]">
                      {log.statusMessage || <span className="text-muted-foreground/30">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.logs.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center font-mono">
                      <TerminalText text="> EOF — NO_RECORDS_MATCH_FILTER" className="text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        {data && data.logs.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-card/50 text-[10px] font-mono text-muted-foreground flex justify-between">
            <span>DISPLAYING {data.logs.length} RECORDS</span>
            <span>{autoRefresh ? "AUTO_REFRESH: ON · 15s" : "CLICK [EXPORT_CSV] TO DUMP LOG"}</span>
          </div>
        )}
      </Card>
    </PageTransition>
  );
}

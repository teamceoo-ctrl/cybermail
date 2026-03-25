import { useState } from "react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Ban, Upload, Search } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Suppression = {
  id: number;
  value: string;
  type: "email" | "domain";
  reason: string | null;
  createdAt: string;
};

async function fetchSuppressions(): Promise<Suppression[]> {
  const res = await fetch(`${BASE}/api/suppressions`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function Suppressions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: suppressions = [], isLoading } = useQuery({ queryKey: ["suppressions"], queryFn: fetchSuppressions });

  const [value, setValue] = useState("");
  const [type, setType] = useState<"email" | "domain">("email");
  const [reason, setReason] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const addMutation = useMutation({
    mutationFn: async (entries: { value: string; type: string; reason?: string }[]) => {
      const res = await fetch(`${BASE}/api/suppressions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(entries),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: (data: Suppression[]) => {
      qc.invalidateQueries({ queryKey: ["suppressions"] });
      toast({ title: `Added ${data.length} suppression(s)` });
      setValue(""); setReason(""); setBulkText(""); setShowBulk(false);
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/suppressions/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppressions"] }); toast({ title: "Removed from suppression list" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  function handleAdd() {
    if (!value.trim()) return;
    addMutation.mutate([{ value: value.trim(), type, reason: reason || undefined }]);
  }

  function handleBulkImport() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    const entries = lines.map(line => {
      const isDomain = !line.includes("@") && line.includes(".");
      return { value: line, type: isDomain ? "domain" : "email", reason: "Bulk import" };
    });
    if (entries.length === 0) return;
    addMutation.mutate(entries);
  }

  const filtered = suppressions.filter(s =>
    s.value.toLowerCase().includes(search.toLowerCase()) ||
    (s.reason ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <TerminalText text="SUPPRESSION_LIST" className="text-2xl font-bold text-primary" />
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Emails and domains that will never receive campaigns — protects sender reputation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{suppressions.length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">TOTAL SUPPRESSED</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{suppressions.filter(s => s.type === "email").length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">EMAIL ADDRESSES</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{suppressions.filter(s => s.type === "domain").length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">DOMAINS</div>
          </Card>
        </div>

        <Card className="p-4 border-primary/20 bg-card/60">
          <div className="flex flex-col gap-3">
            <div className="font-mono text-xs text-primary/70 tracking-widest">ADD SUPPRESSION</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={type} onValueChange={(v) => setType(v as "email" | "domain")}>
                <SelectTrigger className="w-32 font-mono text-xs border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={type === "email" ? "user@example.com" : "example.com"}
                className="font-mono text-xs border-primary/30 flex-1"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="font-mono text-xs border-primary/30 flex-1"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={!value.trim() || addMutation.isPending} size="sm" className="font-mono">
                <Plus className="h-3.5 w-3.5 mr-1" /> ADD
              </Button>
              <Button onClick={() => setShowBulk(!showBulk)} variant="outline" size="sm" className="font-mono border-primary/30">
                <Upload className="h-3.5 w-3.5 mr-1" /> BULK
              </Button>
            </div>
            {showBulk && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">One email or domain per line. Domains without @ are auto-detected.</div>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={5}
                  className="w-full font-mono text-xs bg-background border border-primary/30 rounded p-2 resize-none text-foreground focus:outline-none focus:border-primary"
                  placeholder={"bad@spammer.com\nspammer.com\ndisposable.io"}
                />
                <Button onClick={handleBulkImport} disabled={!bulkText.trim() || addMutation.isPending} size="sm" className="font-mono">
                  <Upload className="h-3.5 w-3.5 mr-1" /> IMPORT {bulkText.split("\n").filter(l => l.trim()).length} ENTRIES
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-primary/20 bg-card/60">
          <div className="p-4 border-b border-border/50 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search suppressions..."
              className="font-mono text-xs border-0 bg-transparent focus-visible:ring-0 p-0 h-auto"
            />
            <span className="text-xs font-mono text-muted-foreground">{filtered.length} entries</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20">
                <TableHead className="font-mono text-primary/70 text-xs">TYPE</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">VALUE</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">REASON</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">ADDED</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center font-mono text-muted-foreground text-xs py-8">LOADING...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center font-mono text-muted-foreground text-xs py-8">NO SUPPRESSIONS. ALL CONTACTS ARE ELIGIBLE.</TableCell></TableRow>
              ) : (
                filtered.map(s => (
                  <TableRow key={s.id} className="border-primary/10 hover:bg-primary/5">
                    <TableCell>
                      <Badge className={`font-mono text-[10px] ${s.type === "domain" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-primary/20 text-primary border-primary/30"}`}>
                        {s.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground/90">{s.value}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.reason ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{format(new Date(s.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteMutation.mutate(s.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageTransition>
  );
}

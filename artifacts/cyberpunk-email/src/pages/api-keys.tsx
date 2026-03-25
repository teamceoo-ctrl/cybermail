import { useState } from "react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, KeyRound, Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ApiKey = {
  id: number;
  label: string;
  keyPreview: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

async function fetchKeys(): Promise<ApiKey[]> {
  const res = await fetch(`${BASE}/api/api-keys`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const PERMISSIONS = ["campaigns:read", "campaigns:write", "contacts:read", "contacts:write", "suppressions:read", "suppressions:write"];

export default function ApiKeys() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: keys = [], isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: fetchKeys });

  const [label, setLabel] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["campaigns:read", "contacts:read"]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, permissions: selectedPerms }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ApiKey & { rawKey: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKey(data.rawKey);
      setLabel("");
      toast({ title: "API key created — copy it now!" });
    },
    onError: () => toast({ title: "Failed to create key", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/api-keys/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast({ title: "Key revoked" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`${BASE}/api/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function togglePerm(perm: string) {
    setSelectedPerms(p => p.includes(perm) ? p.filter(x => x !== perm) : [...p, perm]);
  }

  function copyKey(k: string) {
    navigator.clipboard.writeText(k);
    toast({ title: "Key copied to clipboard" });
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <TerminalText text="API_KEYS" className="text-2xl font-bold text-primary" />
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Manage external API access — integrate CyberMail with your tools and automations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-primary">{keys.length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">TOTAL KEYS</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-green-400">{keys.filter(k => k.isActive).length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">ACTIVE</div>
          </Card>
          <Card className="p-4 border-primary/20 bg-card/60">
            <div className="text-2xl font-mono font-bold text-muted-foreground">{keys.filter(k => !k.isActive).length}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">REVOKED</div>
          </Card>
        </div>

        {newKey && (
          <Card className="p-4 border-green-500/40 bg-green-500/5">
            <div className="font-mono text-xs text-green-400 tracking-widest mb-2">KEY GENERATED — COPY NOW. IT WILL NOT BE SHOWN AGAIN.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-foreground bg-background/50 border border-primary/20 rounded px-3 py-2">
                {showKey ? newKey : "•".repeat(newKey.length)}
              </code>
              <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} className="h-9 w-9">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => copyKey(newKey)} className="h-9 w-9 text-primary">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 font-mono text-xs text-muted-foreground" onClick={() => setNewKey(null)}>
              Dismiss
            </Button>
          </Card>
        )}

        <Card className="p-4 border-primary/20 bg-card/60">
          <div className="font-mono text-xs text-primary/70 tracking-widest mb-3">CREATE NEW KEY</div>
          <div className="space-y-3">
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Key label (e.g. Zapier Integration)"
              className="font-mono text-xs border-primary/30"
            />
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-2">PERMISSIONS</div>
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map(perm => (
                  <button
                    key={perm}
                    onClick={() => togglePerm(perm)}
                    className={`font-mono text-[10px] px-2 py-1 rounded border transition-all ${
                      selectedPerms.includes(perm)
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "bg-muted/20 text-muted-foreground border-border"
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!label.trim() || createMutation.isPending}
              size="sm"
              className="font-mono"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> GENERATE KEY
            </Button>
          </div>
        </Card>

        <Card className="p-4 border-primary/20 bg-card/60">
          <div className="font-mono text-xs text-primary/70 tracking-widest mb-3">USAGE EXAMPLE</div>
          <pre className="font-mono text-xs text-muted-foreground bg-background/50 border border-primary/10 rounded p-3 overflow-x-auto">{`# Add contacts via API
curl -X POST https://your-domain.com/api/contacts \\
  -H "Authorization: Bearer cmk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","firstName":"John"}'

# List campaigns
curl https://your-domain.com/api/campaigns \\
  -H "Authorization: Bearer cmk_your_key_here"`}</pre>
        </Card>

        <Card className="border-primary/20 bg-card/60">
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20">
                <TableHead className="font-mono text-primary/70 text-xs">LABEL</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">KEY PREVIEW</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">PERMISSIONS</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">LAST USED</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs">STATUS</TableHead>
                <TableHead className="font-mono text-primary/70 text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center font-mono text-muted-foreground text-xs py-8">LOADING...</TableCell></TableRow>
              ) : keys.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center font-mono text-muted-foreground text-xs py-8">NO API KEYS. CREATE ONE ABOVE.</TableCell></TableRow>
              ) : (
                keys.map(k => (
                  <TableRow key={k.id} className={`border-primary/10 hover:bg-primary/5 ${!k.isActive ? "opacity-50" : ""}`}>
                    <TableCell className="font-mono text-sm font-medium">{k.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPreview}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.permissions.map(p => (
                          <Badge key={p} className="font-mono text-[9px] bg-primary/10 text-primary border-primary/20">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {k.lastUsedAt ? format(new Date(k.lastUsedAt), "MMM d, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`font-mono text-[10px] ${k.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted/50 text-muted-foreground border-border"}`}>
                        {k.isActive ? "ACTIVE" : "REVOKED"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => toggleMutation.mutate({ id: k.id, isActive: !k.isActive })}
                          title={k.isActive ? "Revoke" : "Activate"}
                        >
                          {k.isActive ? <ToggleRight className="h-3.5 w-3.5 text-green-400" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                          onClick={() => deleteMutation.mutate(k.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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

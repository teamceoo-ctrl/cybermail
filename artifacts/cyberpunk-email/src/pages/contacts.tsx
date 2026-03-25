import { useState, useCallback } from "react";
import { useListContacts, useCreateContact, useImportContacts, useListSegments } from "@workspace/api-client-react";
import { TerminalText, PageTransition } from "@/components/terminal-text";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Upload, Search, ShieldAlert, CheckCircle, Trash2, Download, ChevronLeft, ChevronRight, XCircle, Users, Layers, RefreshCw, FlaskConical, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { PhoneInput } from "@/components/phone-input";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const contactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const importSchema = z.object({
  csvData: z.string().min(10),
});

const segmentSchema = z.object({
  name: z.string().min(1, "Audience name required"),
  description: z.string().optional(),
});

type StatusFilter = "all" | "active" | "unsubscribed" | "bounced";
type ActiveTab = "contacts" | "audiences";

export default function Contacts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("contacts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [deletingSegmentId, setDeletingSegmentId] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{total:number;valid:number;invalid:number;disposable:number;noMx:number} | null>(null);

  const { data, isLoading, refetch } = useListContacts({ search: search || undefined, limit: PAGE_SIZE, page });
  const { data: segmentsData, refetch: refetchSegments } = useListSegments();

  const createMutation = useCreateContact();
  const importMutation = useImportContacts();

  const contacts = data?.contacts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const segments = segmentsData ?? [];
  const realSegments = segments.filter((s: any) => s.id !== 0);

  const createForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { email: "", firstName: "", lastName: "", phone: "", company: "" },
  });

  const importForm = useForm<z.infer<typeof importSchema>>({
    resolver: zodResolver(importSchema),
    defaultValues: { csvData: "email,firstName,lastName,company\nneo@matrix.net,Thomas,Anderson,Metacortex" },
  });

  const segmentForm = useForm<z.infer<typeof segmentSchema>>({
    resolver: zodResolver(segmentSchema),
    defaultValues: { name: "", description: "" },
  });

  const filteredContacts = contacts.filter(c => {
    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filteredContacts.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filteredContacts.forEach(c => n.add(c.id)); return n; });
    }
  };

  const toggleOne = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const onCreateSubmit = (values: z.infer<typeof contactSchema>) => {
    createMutation.mutate({ data: { ...values, tags: [], customFields: {} } }, {
      onSuccess: () => {
        toast({ title: "CONTACT_ADDED", className: "border-primary bg-background text-primary font-mono" });
        setCreateOpen(false); createForm.reset(); refetch();
      },
      onError: () => toast({ title: "ERROR", variant: "destructive", className: "font-mono" }),
    });
  };

  const onImportSubmit = (values: z.infer<typeof importSchema>) => {
    importMutation.mutate({ data: { csvData: values.csvData, tags: [] } }, {
      onSuccess: (res) => {
        toast({ title: "IMPORT_COMPLETE", description: `${res.imported} imported · ${res.skipped} skipped`, className: "border-primary bg-background text-primary font-mono" });
        setImportOpen(false); importForm.reset(); refetch(); refetchSegments();
      },
      onError: () => toast({ title: "IMPORT_FAILED", variant: "destructive", className: "font-mono" }),
    });
  };

  const onSegmentSubmit = async (values: z.infer<typeof segmentSchema>) => {
    setCreatingSegment(true);
    try {
      const res = await fetch(`${BASE}/api/contacts/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, description: values.description || null, criteria: {} }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "AUDIENCE_CREATED", description: `"${values.name}" is ready to use in campaigns`, className: "border-primary bg-background text-primary font-mono" });
      setAudienceOpen(false); segmentForm.reset(); refetchSegments();
    } catch {
      toast({ title: "CREATE_FAILED", variant: "destructive", className: "font-mono" });
    } finally { setCreatingSegment(false); }
  };

  const deleteSegment = async (id: number) => {
    if (!confirm("Delete this audience? Campaigns using it will not be affected.")) return;
    setDeletingSegmentId(id);
    try {
      await fetch(`${BASE}/api/contacts/segments/${id}`, { method: "DELETE" });
      toast({ title: "AUDIENCE_DELETED", className: "border-primary bg-background text-primary font-mono" });
      refetchSegments();
    } catch {
      toast({ title: "DELETE_FAILED", variant: "destructive", className: "font-mono" });
    } finally { setDeletingSegmentId(null); }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await fetch(`${BASE}/api/contacts/bulk-delete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      toast({ title: "PURGED", description: `${selected.size} contacts deleted`, className: "border-primary bg-background text-primary font-mono" });
      setSelected(new Set()); refetch(); refetchSegments();
    } catch {
      toast({ title: "DELETE_FAILED", variant: "destructive", className: "font-mono" });
    } finally { setBulkDeleting(false); }
  };

  const validateContacts = async () => {
    setValidating(true);
    setValidationSummary(null);
    try {
      const res = await fetch(`${BASE}/api/contacts/validate-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setValidationSummary(data.summary);
      toast({ title: "VALIDATION_COMPLETE", description: `${data.summary.valid} valid · ${data.summary.invalid} invalid · ${data.summary.disposable} disposable`, className: "border-primary bg-background text-primary font-mono" });
    } catch (err: any) {
      toast({ title: "VALIDATION_FAILED", description: err.message, variant: "destructive", className: "font-mono" });
    } finally { setValidating(false); }
  };

  const exportSelected = useCallback(() => {
    const rows = filteredContacts.filter(c => selected.has(c.id));
    if (!rows.length) return;
    const header = "email,first_name,last_name,company,status,created_at";
    const body = rows.map(c => [c.email, c.firstName ?? "", c.lastName ?? "", c.company ?? "", c.status, format(new Date(c.createdAt), "yyyy-MM-dd")]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `contacts-${Date.now()}.csv`; a.click();
    toast({ title: "EXPORT_COMPLETE", description: `${rows.length} records exported`, className: "border-primary bg-background text-primary font-mono" });
  }, [filteredContacts, selected, toast]);

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]"><CheckCircle className="w-2.5 h-2.5 mr-1" /> ACTIVE</Badge>;
    if (status === "unsubscribed") return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 font-mono text-[10px]"><XCircle className="w-2.5 h-2.5 mr-1" /> UNSUB</Badge>;
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-mono text-[10px]"><ShieldAlert className="w-2.5 h-2.5 mr-1" /> {status.toUpperCase()}</Badge>;
  };

  return (
    <PageTransition className="space-y-4 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-mono neon-text tracking-widest text-primary">CONTACT_VAULT</h1>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">{total.toLocaleString()} RECORDS · {realSegments.length} AUDIENCE{realSegments.length !== 1 ? "S" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "contacts" && (
            <>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary hover:text-black font-mono">
                    <Upload className="w-4 h-4 mr-2" /> IMPORT_CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-panel max-w-xl max-h-[85vh] flex flex-col p-0">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
                    <DialogTitle className="font-mono text-primary">{'> '}BATCH_IMPORT</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto flex-1 px-6 pb-6">
                    <Form {...importForm}>
                      <form onSubmit={importForm.handleSubmit(onImportSubmit)} className="space-y-4 mt-4">
                        <p className="font-mono text-[10px] text-muted-foreground">Required column: <span className="text-primary">email</span>. Optional: firstName, lastName, phone, company</p>
                        <FormField control={importForm.control} name="csvData" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground text-xs">CSV_PAYLOAD</FormLabel>
                            <FormControl><Textarea {...field} className="font-mono bg-background/50 border-border h-48 focus-visible:ring-primary text-xs" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <Button type="submit" disabled={importMutation.isPending} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                          {importMutation.isPending ? "UPLOADING..." : "EXECUTE_IMPORT"}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono">
                    <Plus className="w-4 h-4 mr-2" /> NEW_CONTACT
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-panel max-w-md max-h-[85vh] flex flex-col p-0">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
                    <DialogTitle className="font-mono text-primary">{'> '}ADD_RECORD</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto flex-1 px-6 pb-6">
                    <Form {...createForm}>
                      <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-4">
                        <FormField control={createForm.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground">EMAIL_ADDRESS</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="user@domain.com" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={createForm.control} name="firstName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground">FIRST_NAME</FormLabel>
                              <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={createForm.control} name="lastName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground">LAST_NAME</FormLabel>
                              <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={createForm.control} name="phone" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground">PHONE <span className="text-muted-foreground/40 text-[10px]">(for SMS)</span></FormLabel>
                              <FormControl>
                                <PhoneInput
                                  value={field.value ?? ""}
                                  onChange={(val) => field.onChange(val)}
                                  placeholder="4155551234"
                                  showGateway={false}
                                />
                              </FormControl>
                            </FormItem>
                          )} />
                          <FormField control={createForm.control} name="company" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-muted-foreground">COMPANY</FormLabel>
                              <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold mt-4">
                          {createMutation.isPending ? "INJECTING..." : "SAVE_RECORD"}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeTab === "audiences" && (
            <>
              <Button variant="outline" onClick={() => refetchSegments()} className="border-border font-mono text-xs h-9">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> REFRESH
              </Button>
              <Dialog open={audienceOpen} onOpenChange={setAudienceOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-black hover:bg-primary/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono">
                    <Plus className="w-4 h-4 mr-2" /> NEW_AUDIENCE
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-panel max-w-md max-h-[85vh] flex flex-col p-0">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
                    <DialogTitle className="font-mono text-primary">{'> '}CREATE_AUDIENCE_SEGMENT</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto flex-1 px-6 pb-6">
                    <Form {...segmentForm}>
                      <form onSubmit={segmentForm.handleSubmit(onSegmentSubmit)} className="space-y-4 mt-4">
                        <FormField control={segmentForm.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground">AUDIENCE_NAME</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="e.g. Newsletter Subscribers" /></FormControl>
                            <FormMessage className="text-destructive font-mono text-xs" />
                          </FormItem>
                        )} />
                        <FormField control={segmentForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-muted-foreground">DESCRIPTION (OPTIONAL)</FormLabel>
                            <FormControl><Input {...field} className="font-mono bg-background focus-visible:ring-primary border-border" placeholder="Describe this audience..." /></FormControl>
                          </FormItem>
                        )} />
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded font-mono text-[10px] text-muted-foreground">
                          <span className="text-primary">Note:</span> New audiences include all active contacts. Use tags on contacts to filter by specific groups in future.
                        </div>
                        <Button type="submit" disabled={creatingSegment} className="w-full bg-primary text-black hover:bg-primary/80 font-mono font-bold">
                          {creatingSegment ? "CREATING..." : "CREATE_AUDIENCE"}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs tracking-widest border-b-2 transition-all ${activeTab === "contacts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Users className="w-3.5 h-3.5" /> CONTACTS
          <span className={`px-1.5 py-0.5 text-[9px] border ${activeTab === "contacts" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{total}</span>
        </button>
        <button
          onClick={() => setActiveTab("audiences")}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs tracking-widest border-b-2 transition-all ${activeTab === "audiences" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Layers className="w-3.5 h-3.5" /> AUDIENCES
          <span className={`px-1.5 py-0.5 text-[9px] border ${activeTab === "audiences" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{realSegments.length}</span>
        </button>
      </div>

      {activeTab === "contacts" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="SEARCH CONTACTS..." className="pl-9 border-border bg-card focus-visible:ring-primary font-mono text-sm h-9" />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as StatusFilter); setPage(1); }}>
              <SelectTrigger className="font-mono bg-card border-border text-primary w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-foreground">
                <SelectItem value="all" className="text-xs">ALL_STATUS</SelectItem>
                <SelectItem value="active" className="text-xs">ACTIVE</SelectItem>
                <SelectItem value="unsubscribed" className="text-xs">UNSUBSCRIBED</SelectItem>
                <SelectItem value="bounced" className="text-xs">BOUNCED</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={validateContacts} disabled={validating} className="border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs h-9">
              <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> {validating ? "VALIDATING..." : "VALIDATE_LIST"}
            </Button>

            {someSelected && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded font-mono text-xs text-primary animate-in fade-in">
                <span>{selected.size} SELECTED</span>
                <button onClick={exportSelected} className="flex items-center gap-1 hover:text-white transition-colors"><Download className="w-3 h-3" /> EXPORT</button>
                <button onClick={bulkDelete} disabled={bulkDeleting} className="flex items-center gap-1 text-destructive hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /> {bulkDeleting ? "PURGING..." : "DELETE"}</button>
                <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}

            {validationSummary && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded font-mono text-[10px] text-muted-foreground animate-in fade-in">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-primary">{validationSummary.valid} valid</span>
                <span className="text-destructive">{validationSummary.invalid} invalid</span>
                <span className="text-yellow-400">{validationSummary.disposable} disposable</span>
                <button onClick={() => setValidationSummary(null)} className="text-muted-foreground hover:text-foreground ml-1">✕</button>
              </div>
            )}
          </div>

          <Card className="terminal-panel flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-8 flex justify-center text-primary"><TerminalText text="> QUERYING_RECORDS..." /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-background/50 sticky top-0 z-10 backdrop-blur">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-10 pl-4">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      </TableHead>
                      <TableHead className="font-mono text-primary text-xs">EMAIL</TableHead>
                      <TableHead className="font-mono text-primary text-xs">NAME</TableHead>
                      <TableHead className="font-mono text-primary text-xs hidden lg:table-cell">PHONE</TableHead>
                      <TableHead className="font-mono text-primary text-xs hidden md:table-cell">COMPANY</TableHead>
                      <TableHead className="font-mono text-primary text-xs hidden md:table-cell">TAGS</TableHead>
                      <TableHead className="font-mono text-primary text-xs hidden lg:table-cell">ADDED</TableHead>
                      <TableHead className="font-mono text-primary text-xs hidden xl:table-cell">SCORE</TableHead>
                      <TableHead className="font-mono text-primary text-xs">STATUS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => {
                      const score = (contact as any).engagementScore ?? 0;
                      const scoreColor = score >= 70 ? "text-green-400" : score >= 30 ? "text-yellow-400" : "text-muted-foreground";
                      return (
                      <TableRow key={contact.id} onClick={() => toggleOne(contact.id)}
                        className={`border-border/50 transition-colors cursor-pointer ${selected.has(contact.id) ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-primary/5"}`}>
                        <TableCell className="pl-4">
                          <Checkbox checked={selected.has(contact.id)} onCheckedChange={() => toggleOne(contact.id)} onClick={e => e.stopPropagation()}
                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                        </TableCell>
                        <TableCell className="font-mono text-sm text-foreground">{contact.email}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground hidden lg:table-cell">{(contact as any).phone || "—"}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground hidden md:table-cell">{contact.company || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {(contact.tags as string[] ?? []).slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="font-mono text-[9px] border-primary/20 text-primary/60 py-0">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground hidden lg:table-cell">{format(new Date(contact.createdAt), "yy-MM-dd")}</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(score, 100)}%` }} />
                            </div>
                            <span className={`font-mono text-[10px] ${scoreColor}`}>{score}</span>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(contact.status)}</TableCell>
                      </TableRow>
                    );
                    })}
                    {!filteredContacts.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground font-mono">NO_RECORDS_FOUND</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>TOTAL: {total.toLocaleString()} · SHOWING {filteredContacts.length}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>PAGE {page} / {Math.max(1, totalPages)}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === "audiences" && (
        <div className="flex-1 space-y-4">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded font-mono text-[10px] text-muted-foreground">
            <span className="text-primary">ℹ</span> Audiences are contact groups used to target broadcasts. <span className="text-primary">All Active Contacts</span> is always available automatically. Create named audiences to target specific groups.
          </div>

          <div className="space-y-2">
            {segments.map((seg: any) => (
              <div key={seg.id} className="flex items-center justify-between p-4 bg-card border border-border/60 rounded hover:border-primary/40 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${seg.id === 0 ? "bg-primary animate-pulse" : "bg-primary/60"}`} />
                  <div>
                    <div className="font-mono text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {seg.name}
                      {seg.id === 0 && <span className="ml-2 font-mono text-[9px] text-primary/60 border border-primary/20 px-1">AUTO</span>}
                    </div>
                    {seg.description && (
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{seg.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-primary">{(seg.contactCount ?? 0).toLocaleString()}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">CONTACTS</div>
                  </div>
                  {seg.id !== 0 && (
                    <button
                      onClick={() => deleteSegment(seg.id)}
                      disabled={deletingSegmentId === seg.id}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors"
                      title="Delete audience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {segments.length === 0 && (
              <div className="p-8 text-center font-mono text-muted-foreground border border-dashed border-border rounded">
                <Layers className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <div>NO_AUDIENCES_YET</div>
                <div className="text-[10px] mt-1 text-muted-foreground/50">Import contacts first, then create named audiences</div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
}

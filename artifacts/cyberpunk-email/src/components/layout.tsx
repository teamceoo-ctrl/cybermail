import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Terminal, Users, FileCode, Server, Send, ActivitySquare, ShieldAlert, Crosshair, ScanSearch, Zap, LogOut, MessageSquare, MessageCircle, Smartphone, GitBranch, Ban, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Terminal,
    anim: "nav-icon-blink",
    animFast: "nav-icon-blink-fast",
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Users,
    anim: "nav-icon-float",
    animFast: "nav-icon-float-fast",
  },
  {
    title: "Lead Scraper",
    url: "/lead-scraper",
    icon: Crosshair,
    anim: "nav-icon-spin",
    animFast: "nav-icon-spin-fast",
  },
  {
    title: "Templates",
    url: "/templates",
    icon: FileCode,
    anim: "nav-icon-flicker",
    animFast: "nav-icon-flicker-fast",
  },
  {
    title: "SMTP Profiles",
    url: "/smtp-profiles",
    icon: Server,
    anim: "nav-icon-heartbeat",
    animFast: "nav-icon-heartbeat-fast",
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Send,
    anim: "nav-icon-fly",
    animFast: "nav-icon-fly-fast",
  },
  {
    title: "Delivery Logs",
    url: "/delivery-logs",
    icon: ActivitySquare,
    anim: "nav-icon-wave",
    animFast: "nav-icon-wave-fast",
  },
  {
    title: "Inbox Tester",
    url: "/inbox-tester",
    icon: ScanSearch,
    anim: "nav-icon-flicker",
    animFast: "nav-icon-flicker-fast",
  },
  {
    title: "Reputation",
    url: "/reputation",
    icon: ShieldAlert,
    anim: "nav-icon-shake",
    animFast: "nav-icon-shake-fast",
  },
  {
    title: "SMS",
    url: "/sms",
    icon: MessageSquare,
    anim: "nav-icon-wave",
    animFast: "nav-icon-wave-fast",
  },
  {
    title: "WhatsApp",
    url: "/whatsapp",
    icon: MessageCircle,
    anim: "nav-icon-float",
    animFast: "nav-icon-float-fast",
  },
  {
    title: "Msg Profiles",
    url: "/messaging-profiles",
    icon: Smartphone,
    anim: "nav-icon-blink",
    animFast: "nav-icon-blink-fast",
  },
  {
    title: "Sequences",
    url: "/sequences",
    icon: GitBranch,
    anim: "nav-icon-float",
    animFast: "nav-icon-float-fast",
  },
  {
    title: "Suppressions",
    url: "/suppressions",
    icon: Ban,
    anim: "nav-icon-shake",
    animFast: "nav-icon-shake-fast",
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: KeyRound,
    anim: "nav-icon-blink",
    animFast: "nav-icon-blink-fast",
  },
];

const PLAN_BADGE: Record<string, string> = {
  "3month": "3M",
  "6month": "6M",
  "1year": "1Y",
  "lifetime": "∞",
};

export function AppSidebar() {
  const [location] = useLocation();
  const [hovered, setHovered] = useState<string | null>(null);
  const { session, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <Sidebar className="border-r border-border bg-sidebar/90 backdrop-blur z-40">
      <SidebarHeader className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary animate-pulse" />
          <span className="font-mono font-bold tracking-wider logo-gold-sunny">CYBER_MAIL</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="mt-4">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                const isHovered = hovered === item.title;

                const iconClass = isActive
                  ? `text-primary ${item.anim}`
                  : isHovered
                  ? `text-primary ${item.animFast}`
                  : "text-muted-foreground";

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`font-mono transition-all duration-200 ${
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary shadow-[inset_4px_0_10px_rgba(0,255,65,0.1)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                      onMouseEnter={() => setHovered(item.title)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <Link href={item.url}>
                        <item.icon className={`transition-colors duration-200 ${iconClass}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/20 p-3 space-y-2">
        {session && (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-primary/5 border border-primary/10 rounded">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono text-muted-foreground/50 tracking-widest uppercase">LOGGED_IN</p>
              <p className="text-[10px] font-mono text-primary/80 truncate mt-0.5">{session.label}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-mono text-primary/60 border border-primary/20 px-1 py-0.5 rounded">
                {PLAN_BADGE[session.plan] ?? session.plan}
              </span>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                title="Log out"
                className="text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="xcrawl-wrap rounded px-3 py-2 bg-primary/5 border border-primary/10 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 w-full justify-center">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-primary/30" />
            <Zap className="h-2.5 w-2.5 text-primary/50" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-primary/30" />
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/40 tracking-[0.3em] uppercase">Powered by</p>
          <span className="xcrawl-brand text-sm font-bold">XCRAWL</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full bg-background text-foreground scanlines overflow-hidden relative">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none z-0" />

        <AppSidebar />

        <div className="flex flex-col flex-1 relative z-10 min-w-0">
          <header className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-30 h-16">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary hover:bg-primary/20 hover:text-primary transition-colors" />
              <div className="hidden md:flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                <span className="text-xs font-mono text-primary/80">SYSTEM.ONLINE</span>
              </div>
            </div>
            <div className="font-mono text-xs text-muted-foreground hidden sm:block">
              {new Date().toISOString()}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth pb-24">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

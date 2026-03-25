import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminPage from "@/pages/admin";
import { useAuth } from "@/hooks/use-auth";

import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Templates from "@/pages/templates";
import SmtpProfiles from "@/pages/smtp-profiles";
import Campaigns from "@/pages/campaigns";
import DeliveryLogs from "@/pages/delivery-logs";
import Reputation from "@/pages/reputation";
import LeadScraper from "@/pages/lead-scraper";
import InboxTester from "@/pages/inbox-tester";
import MessagingProfiles from "@/pages/messaging-profiles";
import SmsCampaigns from "@/pages/sms";
import WhatsAppCampaigns from "@/pages/whatsapp";
import Sequences from "@/pages/sequences";
import Suppressions from "@/pages/suppressions";
import ApiKeys from "@/pages/api-keys";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    }
  }
});

function LoadingScreen({ text = "INITIALIZING..." }: { text?: string }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "hsl(140 15% 4%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Fira Code', monospace",
      color: "#00ff41",
      fontSize: 12,
      letterSpacing: 3,
    }}>
      {text}
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/templates" component={Templates} />
        <Route path="/smtp-profiles" component={SmtpProfiles} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/delivery-logs" component={DeliveryLogs} />
        <Route path="/reputation" component={Reputation} />
        <Route path="/lead-scraper" component={LeadScraper} />
        <Route path="/inbox-tester" component={InboxTester} />
        <Route path="/messaging-profiles" component={MessagingProfiles} />
        <Route path="/sms" component={SmsCampaigns} />
        <Route path="/whatsapp" component={WhatsAppCampaigns} />
        <Route path="/sequences" component={Sequences} />
        <Route path="/suppressions" component={Suppressions} />
        <Route path="/api-keys" component={ApiKeys} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminPage} />
      <Route component={AppShell} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

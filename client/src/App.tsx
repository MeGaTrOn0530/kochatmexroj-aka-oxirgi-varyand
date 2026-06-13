import AppProtection from "@/components/AppProtection";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Seedlings from "./pages/Seedlings";
import Locations from "./pages/Locations";
import Transfers from "./pages/Transfers";
import Orders from "./pages/Orders";
import Reports from "./pages/Reports";
import AdminDashboard from "./pages/AdminDashboard";
import BoshAgranomDashboard from "./pages/BoshAgranomDashboard";
import AgranomDashboard from "./pages/AgranomDashboard";
import BugalterDashboard from "./pages/BugalterDashboard";
import Catalog from "./pages/Catalog";
import CustomerProducts from "./pages/CustomerProducts";
import Profile from "./pages/Profile";
import AllModules from "./pages/AllModules";
import Finance from "./pages/Finance";
import Customers from "./pages/Customers";
import Deliveries from "./pages/Deliveries";
import AgroJournal from "./pages/AgroJournal";
import GreenhouseStages from "./pages/GreenhouseStages";
import Temperature from "./pages/Temperature";
import Hr from "./pages/Hr";
import TelegramSettings from "./pages/TelegramSettings";
import Certificates from "./pages/Certificates";
import BoshOfesDashboard from "./pages/BoshOfesDashboard";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import { Button } from "./components/ui/button";
import { ShieldOff } from "lucide-react";

// ─── Rol bo'yicha dashboard yo'llari ───────────────────────────────────────
const roleDashboard: Record<string, string> = {
  admin: "/admin/dashboard",
  bosh_agranom: "/bosh-agranom/dashboard",
  agranom: "/agranom/dashboard",
  bugalter: "/bugalter/dashboard",
  bosh_ofes: "/bosh-ofes/dashboard",
};

// ─── Ruxsat berilmagan sahifa ───────────────────────────────────────────────
function AccessDenied({ requiredRoles }: { requiredRoles?: string[] }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const home = roleDashboard[user?.role || ""] || "/";

  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-full bg-red-100 p-5 dark:bg-red-900/30">
          <ShieldOff className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Ruxsat yo'q</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu sahifaga kirish uchun kerakli rol: {" "}
            <span className="font-semibold">
              {(requiredRoles || []).join(", ") || "Maxsus rol"}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">Sizning rolingiz: <span className="font-semibold">{user?.role}</span></p>
        </div>
        <Button onClick={() => setLocation(home)}>Bosh sahifaga qaytish</Button>
      </div>
    </DashboardLayout>
  );
}

// ─── Route himoyasi ─────────────────────────────────────────────────────────
function Guard({
  component: Component,
  roles,
}: {
  component: React.ComponentType;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) return null;

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <AccessDenied requiredRoles={roles} />;
  }

  return <Component />;
}

// Barcha tizimga kirgan foydalanuvchilar uchun
const ALL_ROLES = ["admin", "bosh_agranom", "agranom", "bugalter", "operator", "bosh_ofes"];
const BOSH_OFES = "bosh_ofes";

function Router() {
  return (
    <Switch>
      {/* Ochiq sahifalar */}
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />

      {/* Dashboard — faqat o'z roli uchun */}
      <Route path="/admin/dashboard">
        <Guard component={AdminDashboard} roles={["admin"]} />
      </Route>
      <Route path="/bosh-agranom/dashboard">
        <Guard component={BoshAgranomDashboard} roles={["bosh_agranom"]} />
      </Route>
      <Route path="/agranom/dashboard">
        <Guard component={AgranomDashboard} roles={["agranom"]} />
      </Route>
      <Route path="/bugalter/dashboard">
        <Guard component={BugalterDashboard} roles={["bugalter"]} />
      </Route>

      {/* Asosiy modullar */}
      <Route path="/greenhouse-stages">
        <Guard component={GreenhouseStages} roles={["admin", "bosh_agranom", "agranom", BOSH_OFES]} />
      </Route>
      <Route path="/seedlings">
        <Guard component={Seedlings} roles={["admin", "bosh_agranom", "agranom", "operator", BOSH_OFES]} />
      </Route>
      <Route path="/locations">
        <Guard component={Locations} roles={ALL_ROLES} />
      </Route>
      <Route path="/transfers">
        <Guard component={Transfers} roles={ALL_ROLES} />
      </Route>
      <Route path="/orders">
        <Guard component={Orders} roles={ALL_ROLES} />
      </Route>
      <Route path="/reports">
        <Guard component={Reports} roles={["admin", "bosh_agranom", "bugalter", BOSH_OFES]} />
      </Route>

      {/* Admin only */}
      <Route path="/users">
        <Guard component={Users} roles={["admin"]} />
      </Route>
      <Route path="/catalog">
        <Guard component={Catalog} roles={["admin", BOSH_OFES]} />
      </Route>
      <Route path="/customer-products">
        <Guard component={CustomerProducts} roles={["admin", BOSH_OFES]} />
      </Route>

      {/* Profil — barcha */}
      <Route path="/profile">
        <Guard component={Profile} roles={ALL_ROLES} />
      </Route>
      <Route path="/settings">
        <Guard component={Profile} roles={ALL_ROLES} />
      </Route>

      {/* Yangi modullar */}
      <Route path="/finance">
        <Guard component={Finance} roles={["admin", "bugalter", BOSH_OFES]} />
      </Route>
      <Route path="/customers">
        <Guard component={Customers} roles={["admin", "bugalter", BOSH_OFES]} />
      </Route>
      <Route path="/deliveries">
        <Guard component={Deliveries} roles={["admin", "bugalter", "bosh_agranom", "operator", BOSH_OFES]} />
      </Route>
      <Route path="/agro-journal">
        <Guard component={AgroJournal} roles={["admin", "bosh_agranom", "agranom", BOSH_OFES]} />
      </Route>
      <Route path="/hr">
        <Guard component={Hr} roles={["admin", "bosh_agranom", BOSH_OFES]} />
      </Route>
      <Route path="/certificates">
        <Guard component={Certificates} roles={["admin", "bosh_agranom", BOSH_OFES]} />
      </Route>
      <Route path="/telegram">
        <Guard component={TelegramSettings} roles={["admin", BOSH_OFES]} />
      </Route>
      <Route path="/bosh-ofes/dashboard">
        <Guard component={BoshOfesDashboard} roles={[BOSH_OFES]} />
      </Route>
      <Route path="/temperature">
        <Guard component={Temperature} roles={["admin", "bosh_agranom", BOSH_OFES]} />
      </Route>

      <Route path="/modules" component={AllModules} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppProtection />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

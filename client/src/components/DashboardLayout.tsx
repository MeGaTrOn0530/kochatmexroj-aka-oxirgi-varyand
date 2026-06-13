import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";

import { trpc } from "@/lib/trpc";
import { Bell, BotMessageSquare, CheckCheck, LayoutDashboard, LogOut, Medal, Moon, PanelLeft, Sun, Users, Leaf, TrendingUp, FileText, BarChart3, Layers3, Store, UserRound, Package, BadgeDollarSign, Users2, Truck, BookOpen, UserCheck, TreePine, Thermometer } from "lucide-react";
import AppFooter from "./AppFooter";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";

const ALL_BOSH_OFES_MODULES = [
  { key: "dashboard",         icon: LayoutDashboard, label: "Boshqaruv paneli",    path: "/bosh-ofes/dashboard" },
  { key: "catalog",           icon: Layers3,         label: "Katalog",             path: "/catalog" },
  { key: "customer_products", icon: Store,           label: "Mijoz uchun",         path: "/customer-products" },
  { key: "seedlings",         icon: Leaf,            label: "Ko'chat partiyalari", path: "/seedlings" },
  { key: "greenhouse",        icon: TreePine,        label: "Teplitsa bosqichlari",path: "/greenhouse-stages" },
  { key: "locations",         icon: BarChart3,       label: "Obyektlar",           path: "/locations" },
  { key: "transfers",         icon: TrendingUp,      label: "Transferlar",         path: "/transfers" },
  { key: "orders",            icon: FileText,        label: "Buyurtmalar",         path: "/orders" },
  { key: "reports",           icon: BarChart3,       label: "Hisobotlar",          path: "/reports" },
  { key: "finance",           icon: BadgeDollarSign, label: "Moliya",              path: "/finance" },
  { key: "customers",         icon: Users2,          label: "CRM Mijozlar",        path: "/customers" },
  { key: "deliveries",        icon: Truck,           label: "Yetkazib berish",     path: "/deliveries" },
  { key: "agro_journal",      icon: BookOpen,        label: "Agro jurnal",         path: "/agro-journal" },
  { key: "hr",                icon: UserCheck,       label: "HR",                  path: "/hr" },
  { key: "certificates",      icon: Medal,           label: "Sertifikatlar",       path: "/certificates" },
  { key: "telegram",          icon: BotMessageSquare,label: "Telegram Bot",        path: "/telegram" },
  { key: "temperature",       icon: Thermometer,     label: "Harorat monitoring",  path: "/temperature" },
];

// user — useAuth() dan kelgan obekt, locationIsSource = is_source flag
const getMenuItems = (role?: string, locationIsSource?: boolean, boshOfesModules?: Record<string, boolean>) => {
  switch (role) {
    case "admin":
      return [
        { icon: LayoutDashboard, label: "Boshqaruv paneli",    path: "/admin/dashboard" },
        { icon: Users,           label: "Hodimlar",             path: "/users" },
        { icon: Layers3,         label: "Katalog",              path: "/catalog" },
        { icon: Store,           label: "Mijoz uchun",          path: "/customer-products" },
        { icon: Leaf,            label: "Ko'chat partiyalari",  path: "/seedlings" },
        { icon: TreePine,        label: "Teplitsa bosqichlari", path: "/greenhouse-stages" },
        { icon: BarChart3,       label: "Obyektlar",            path: "/locations" },
        { icon: TrendingUp,      label: "Transferlar",          path: "/transfers" },
        { icon: FileText,        label: "Buyurtmalar",          path: "/orders" },
        { icon: BarChart3,       label: "Hisobotlar",           path: "/reports" },
        { icon: BadgeDollarSign, label: "Moliya",               path: "/finance" },
        { icon: Users2,          label: "CRM Mijozlar",         path: "/customers" },
        { icon: Truck,           label: "Yetkazib berish",      path: "/deliveries" },
        { icon: BookOpen,        label: "Agro jurnal",          path: "/agro-journal" },
        { icon: UserCheck,       label: "HR",                   path: "/hr" },
        { icon: Medal,           label: "Sertifikatlar",        path: "/certificates" },
        { icon: BotMessageSquare,label: "Telegram Bot",         path: "/telegram" },
        { icon: Thermometer,     label: "Harorat monitoring",   path: "/temperature" },
      ];

    case "bosh_agranom":
      return [
        { icon: LayoutDashboard, label: "Nazorat paneli",       path: "/bosh-agranom/dashboard" },
        { icon: Leaf,            label: "Ko'chat partiyalari",  path: "/seedlings" },
        { icon: TreePine,        label: "Teplitsa bosqichlari", path: "/greenhouse-stages" },
        { icon: BarChart3,       label: "Obyektlar",            path: "/locations" },
        { icon: TrendingUp,      label: "Transferlar",          path: "/transfers" },
        { icon: FileText,        label: "Buyurtmalar",          path: "/orders" },
        { icon: BarChart3,       label: "Hisobotlar",           path: "/reports" },
        { icon: BookOpen,        label: "Agro jurnal",          path: "/agro-journal" },
        { icon: Medal,           label: "Sertifikatlar",        path: "/certificates" },
        { icon: UserCheck,       label: "HR",                   path: "/hr" },
        { icon: Truck,           label: "Yetkazib berish",      path: "/deliveries" },
        { icon: Thermometer,     label: "Harorat monitoring",   path: "/temperature" },
      ];

    case "bugalter":
      return [
        { icon: LayoutDashboard, label: "Operatsion panel",     path: "/bugalter/dashboard" },
        { icon: FileText,        label: "Buyurtmalar",          path: "/orders" },
        { icon: BarChart3,       label: "Hisobotlar",           path: "/reports" },
        { icon: BadgeDollarSign, label: "Moliya",               path: "/finance" },
        { icon: Users2,          label: "CRM Mijozlar",         path: "/customers" },
        { icon: Truck,           label: "Yetkazib berish",      path: "/deliveries" },
        { icon: TrendingUp,      label: "Transferlar",          path: "/transfers" },
        { icon: BarChart3,       label: "Obyektlar",            path: "/locations" },
      ];

    case "agranom": {
      // Barcha agronomlar Ko'chat partiyalarini ko'radi (faqat Jomboy yarata oladi)
      // Teplitsa agronomlari qo'shimcha Teplitsa bosqichlari ham ko'radi
      const base = [
        { icon: LayoutDashboard, label: "Mening panelim",      path: "/agranom/dashboard" },
        { icon: Leaf,            label: "Ko'chat partiyalari", path: "/seedlings" },
        { icon: TrendingUp,      label: "Transferlar",         path: "/transfers" },
        { icon: FileText,        label: "Buyurtmalar",         path: "/orders" },
        { icon: BookOpen,        label: "Agro jurnal",         path: "/agro-journal" },
        { icon: BarChart3,       label: "Mening obyektim",     path: "/locations" },
      ];

      if (!locationIsSource) {
        // Teplitsa — Ko'chat partiyalari + Teplitsa bosqichlari
        return [
          base[0],
          base[1],
          { icon: TreePine, label: "Teplitsa bosqichlari", path: "/greenhouse-stages" },
          ...base.slice(2),
        ];
      }

      return base;
    }

    case "bosh_ofes": {
      if (!boshOfesModules || Object.keys(boshOfesModules).length === 0) {
        return [{ icon: LayoutDashboard, label: "Boshqaruv paneli", path: "/bosh-ofes/dashboard" }];
      }
      return ALL_BOSH_OFES_MODULES.filter(m => boshOfesModules[m.key]);
    }

    case "operator":
    default:
      return [
        { icon: LayoutDashboard, label: "Panel",                path: "/agranom/dashboard" },
        { icon: Leaf,            label: "Ko'chat partiyalari",  path: "/seedlings" },
        { icon: BarChart3,       label: "Obyektlar",            path: "/locations" },
        { icon: TrendingUp,      label: "Transferlar",          path: "/transfers" },
        { icon: FileText,        label: "Buyurtmalar",          path: "/orders" },
        { icon: Truck,           label: "Yetkazib berish",      path: "/deliveries" },
      ];
  }
};

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  const { data: boshOfesModules } = trpc.boshOfes.getModules.useQuery(undefined, {
    enabled: user?.role === "bosh_ofes",
  });

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              "SAMARQAND QULUPNAY IMPEKS" MChJ Tizimiga Kirish
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Ushbu panelga kirish uchun login va parol bilan autentifikatsiya talab qilinadi.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Login sahifasiga o'tish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} userRole={user.role} boshOfesModules={boshOfesModules}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  userRole?: string;
  boshOfesModules?: Record<string, boolean>;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  userRole,
  boshOfesModules,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = getMenuItems(userRole, (user as any)?.locationIsSource, boshOfesModules);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const { data: notifications } = trpc.notifications.getMine.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const markNotificationRead = trpc.notifications.markRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getMine.invalidate();
    },
  });
  const markAllNotificationsRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getMine.invalidate();
    },
  });

  const roleLabel = {
    admin: "Admin",
    bosh_agranom: "Bosh Agranom",
    agranom: "Agranom",
    bugalter: "Buxgalter",
    bosh_ofes: "Bosh Ofes",
  }[userRole || "agranom"];
  const notificationItems = notifications?.items || [];
  const unreadCount = Number(notifications?.unreadCount || 0);

  const getNotificationTargetPath = (notification: any) => {
    switch (notification.entityType) {
      case "order":
        return "/orders";
      case "transfer":
        return "/transfers";
      case "batch":
      case "seedling_history":
        return "/seedlings";
      default:
        return activeMenuItem?.path || "/";
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markNotificationRead.mutateAsync(notification.id);
    }

    const targetPath = getNotificationTargetPath(notification);
    if (targetPath && location !== targetPath) {
      setLocation(targetPath);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    await markAllNotificationsRead.mutateAsync();
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold tracking-tight truncate text-[10px] leading-snug">
                      SAMARQAND QULUPNAY IMPEKS MChJ · Boshqaruv tizimi
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                        setOpenMobile(false);
                      }}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-accent" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarImage src={user?.avatarPath || undefined} alt={user?.name || "Profil"} />
                    <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  className="cursor-pointer"
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  <span>Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Chiqish</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:px-4 [transform:translateZ(0)]">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg bg-background md:hidden [touch-action:manipulation]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeMenuItem?.label ?? "Panel"}
              </p>
              <p className="hidden md:block truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-foreground" />
              )}
            </button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Bell className="h-4 w-4 text-foreground" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Bildirishnomalar</p>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} ta o'qilmagan` : "Yangi bildirishnoma yo'q"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2"
                  onClick={handleMarkAllNotificationsRead}
                  disabled={!unreadCount || markAllNotificationsRead.isPending}
                >
                  <CheckCheck className="h-4 w-4" />
                  O'qildi
                </Button>
              </div>
              <ScrollArea className="max-h-96">
                <div className="p-2">
                  {!notificationItems.length ? (
                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      Hozircha bildirishnoma yo'q
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notificationItems.map((notification: any) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-accent/20 ${
                            notification.isRead
                              ? "border-border/60 bg-background"
                              : "border-accent/30 bg-accent/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {notification.message}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {notification.createdAt
                                    ? new Date(notification.createdAt).toLocaleString("uz-UZ")
                                    : "-"}
                                </span>
                                {notification.locationName ? (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                                    {notification.locationName}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {!notification.isRead ? (
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        <main className="flex-1 p-4">{children}</main>

        <AppFooter />
      </SidebarInset>
    </>
  );
}

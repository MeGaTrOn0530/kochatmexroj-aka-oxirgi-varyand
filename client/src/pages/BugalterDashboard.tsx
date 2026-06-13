import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightLeft, BarChart3, ClipboardList, DollarSign, ShoppingCart, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const accountantActions = [
  {
    icon: Truck,
    title: "Transferlar",
    description: "Lokatsiyalar o'rtasidagi ichki ko'chirishlarni yaratish va yuritish.",
    href: "/transfers",
  },
  {
    icon: ArrowRightLeft,
    title: "Qaytarishlar",
    description: "Qaytarish va almashinuv tipidagi operatsiyalarni boshqarish.",
    href: "/transfers",
  },
  {
    icon: BarChart3,
    title: "Obyektlar",
    description: "Qaysi joydan qaysi joyga yuborilayotganini tekshirish.",
    href: "/locations",
  },
  {
    icon: ClipboardList,
    title: "Hisobotlar",
    description: "Operatsiyalar va transferlar bo'yicha yig'ma ko'rinish.",
    href: "/reports",
  },
];

export default function BugalterDashboard() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: transfers } = trpc.transfers.getAll.useQuery();
  const { data: bronStats } = trpc.orders.getReservationStats.useQuery();
  const { data: detailedRows } = trpc.reports.getDetailed.useQuery({});
  const readySeedlingsCount = (detailedRows || [])
    .filter((row: any) => row.stageKey === "ready")
    .reduce((sum: number, row: any) => sum + Number(row.endingQuantity || 0), 0);

  if (user?.role !== "bugalter") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat Rad Etildi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Bu sahifa faqat buxgalter uchun mavjud.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const exchangeCount = transfers?.filter((transfer) => transfer.transferType === "exchange").length || 0;
  const returnCount = transfers?.filter((transfer) => transfer.transferType === "return").length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <DollarSign className="h-8 w-8 text-accent" />
            Buxgalter operatsion paneli
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Ichki almashinuvlar, qaytarishlar va ko'chat operatsiyalarini rasmiy kiritish uchun ish maydoni.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Jami transferlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalTransfers || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Yaratilgan operatsiyalar</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Almashinuvlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{exchangeCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Exchange tipidagi yozuvlar</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Qaytarishlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{returnCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Return tipidagi yozuvlar</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Lokatsiyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalLocations || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Nazoratdagi obyektlar</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elegant border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Bron holati (Rezervatsiya)</CardTitle>
            </div>
            <CardDescription>Faol buyurtmalar — tasdiqlanishi kerak.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Tayyor ko'chatlar</div>
                <div className="mt-1 text-2xl font-bold text-green-600">{readySeedlingsCount}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Bron qilingan</div>
                <div className="mt-1 text-2xl font-bold text-amber-600">{bronStats?.totalReserved || 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Yetishmaydi</div>
                <div className="mt-1 text-2xl font-bold text-red-600">{bronStats?.shortage || 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Faol buyurtmalar</div>
                <div className="mt-1 text-2xl font-bold text-foreground">{bronStats?.activeOrderCount || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {accountantActions.map((action) => (
            <Card key={action.title} className="card-elegant">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <action.icon className="h-5 w-5" />
                </div>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <a href={action.href} className="btn-primary block w-full text-center">
                  Ochish
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

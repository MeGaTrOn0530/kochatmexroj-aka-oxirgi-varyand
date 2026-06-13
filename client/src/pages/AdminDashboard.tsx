import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, ClipboardList, Layers3, Leaf, ShoppingCart, Trash2, Truck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const adminActions = [
  {
    icon: Users,
    title: "Hodimlar",
    description: "Foydalanuvchi qo'shish, role berish va agronomlarni obyektga biriktirish.",
    href: "/users",
  },
  {
    icon: Layers3,
    title: "Katalog",
    description: "Ko'chat turi va navlarni yuritish.",
    href: "/catalog",
  },
  {
    icon: Leaf,
    title: "Partiyalar",
    description: "Bosqichlar kesimida jami ko'chatlar holatini ko'rish.",
    href: "/seedlings",
  },
  {
    icon: ClipboardList,
    title: "Buyurtmalar",
    description: "Tayyor mahsulot va buyurtma ta'minotini nazorat qilish.",
    href: "/orders",
  },
  {
    icon: Truck,
    title: "Transferlar",
    description: "Ichki almashinuv va harakatlarni kuzatish.",
    href: "/transfers",
  },
  {
    icon: BarChart3,
    title: "Hisobotlar",
    description: "Umumiy ko'rsatkich va audit loglarni ko'rish.",
    href: "/reports",
  },
];

const actionLabel: Record<string, string> = {
  login: "Tizimga kirish",
  logout: "Tizimdan chiqish",
  seedlings_stage_changed: "Bosqich o'zgartirildi",
  seedling_history_approved: "Ko'chat tarixi tasdiqlandi",
  seedling_history: "Ko'chat tarixi",
  transfer_created: "Transfer yaratildi",
  transfer_approved: "Transfer tasdiqlandi",
  transfer_rejected: "Transfer rad etildi",
  transfer_completed: "Transfer yakunlandi",
  order_created: "Buyurtma yaratildi",
  order_approved: "Buyurtma tasdiqlandi",
  order_rejected: "Buyurtma rad etildi",
  order_completed: "Buyurtma yakunlandi",
  user_created: "Foydalanuvchi yaratildi",
  user_updated: "Foydalanuvchi yangilandi",
  user_deleted: "Foydalanuvchi o'chirildi",
  batch_created: "Partiya yaratildi",
  batch_updated: "Partiya yangilandi",
  batch_deleted: "Partiya o'chirildi",
  location_created: "Lokatsiya yaratildi",
  location_updated: "Lokatsiya yangilandi",
  location_deleted: "Lokatsiya o'chirildi",
  catalog_created: "Katalog yaratildi",
  catalog_updated: "Katalog yangilandi",
  catalog_deleted: "Katalog o'chirildi",
};

const entityTypeLabel: Record<string, string> = {
  auth: "Autentifikatsiya",
  batch: "Partiya",
  transfer: "Transfer",
  order: "Buyurtma",
  user: "Foydalanuvchi",
  seedling_history: "Ko'chat tarixi",
  location: "Lokatsiya",
  catalog: "Katalog",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: users } = trpc.admin.getAllUsers.useQuery();
  const { data: activity } = trpc.dashboard.getActivityLog.useQuery();
  const { data: detailedRows } = trpc.reports.getDetailed.useQuery({});
  const { data: bronStats } = trpc.orders.getReservationStats.useQuery();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [keepUsers, setKeepUsers] = useState(false);
  const [keepLocations, setKeepLocations] = useState(false);
  const [keepCatalog, setKeepCatalog] = useState(false);
  const RESET_CONFIRM_WORD = "TOZALASH";

  const resetMutation = trpc.adminReset.resetData.useMutation({
    onSuccess: () => {
      toast.success("Baza tozalandi! Server restart qiling — admin qayta yaratiladi.");
      setIsResetDialogOpen(false);
      setResetPassword("");
      setKeepUsers(false);
      setKeepLocations(false);
      setKeepCatalog(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Tozalashda xato");
    },
  });

  const readySeedlingsCount = (stats as any)?.greenhouseReady ||
    (detailedRows || [])
      .filter((row: any) => row.stageKey === "ready")
      .reduce((sum: number, row: any) => sum + Number(row.endingQuantity || 0), 0);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat Rad Etildi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Bu sahifa faqat admin uchun mavjud.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BarChart3 className="h-8 w-8 text-accent" />
            Admin boshqaruv paneli
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Tizimdagi rollar, katalog, ombor holati va buyurtmalarni umumiy kesimda boshqarish oynasi.
          </p>
        </div>

        {/* Teplitsa bosqichlari umumiy holati */}
        <Card className="card-elegant border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700">Teplitsa bosqichlari (umumiy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Kasetada</div>
                <div className="text-xl font-bold text-yellow-600">{(stats as any)?.greenhouseCassette || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Payvantlash</div>
                <div className="text-xl font-bold text-blue-600">{(stats as any)?.greenhouseGrafting || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Payvantlangan</div>
                <div className="text-xl font-bold text-green-600">{(stats as any)?.greenhouseGrafted || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Tayyor</div>
                <div className="text-xl font-bold text-emerald-600">{(stats as any)?.greenhouseReady || 0}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-center text-muted-foreground">
              Jami teplitsalarda: <span className="font-bold text-foreground">{(stats as any)?.greenhouseTotal || 0}</span> ta
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tayyor ko'chatlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {readySeedlingsCount}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Tizimdagi tayyor ko'chatlar soni</p>
            </CardContent>
          </Card>

          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Partiyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalBatches || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Barcha obyektlar bo'yicha</p>
            </CardContent>
          </Card>

          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Lokatsiyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalLocations || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Teplitsa, dala va laboratoriya</p>
            </CardContent>
          </Card>

          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Transferlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalTransfers || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Jarayondagi almashinuvlar</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elegant border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Bron holati (Rezervatsiya)</CardTitle>
            </div>
            <CardDescription>Faol buyurtmalar — tayyor ko'chatdan ajratilgan miqdor.</CardDescription>
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {adminActions.map((action) => (
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

        {/* Xavfli zona */}
        <Card className="card-elegant border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Xavfli zona
            </CardTitle>
            <CardDescription>
              Test ma'lumotlarini tozalash. Lokatsiyalar va kategoriyalar saqlanib qoladi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setIsResetDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Barcha ma'lumotlarni tozalash
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isResetDialogOpen}
        onOpenChange={(o) => {
          setIsResetDialogOpen(o);
          if (!o) {
            setResetPassword("");
            setKeepUsers(false);
            setKeepLocations(false);
            setKeepCatalog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Bazani tozalash</DialogTitle>
            <DialogDescription>
              Bu amalni bekor qilib bo'lmaydi! Quyidagilarni <strong>saqlash</strong> uchun belgilang:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Nima qoldirishni tanlash */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Nimalarni qoldirish kerak?</p>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="keepUsers"
                  checked={keepUsers}
                  onCheckedChange={(v) => setKeepUsers(Boolean(v))}
                />
                <Label htmlFor="keepUsers" className="cursor-pointer text-sm">
                  Hodimlar (foydalanuvchilar)
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="keepLocations"
                  checked={keepLocations}
                  onCheckedChange={(v) => setKeepLocations(Boolean(v))}
                />
                <Label htmlFor="keepLocations" className="cursor-pointer text-sm">
                  Teplitsalar / Lokatsiyalar
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="keepCatalog"
                  checked={keepCatalog}
                  onCheckedChange={(v) => setKeepCatalog(Boolean(v))}
                />
                <Label htmlFor="keepCatalog" className="cursor-pointer text-sm">
                  Katalog (ko'chat turi, nav, payvand turi)
                </Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Qolgan barcha ma'lumotlar (partiyalar, transferlar, buyurtmalar, teplitsa bosqichlari) <strong>o'chiriladi</strong>.
              Tasdiqlash uchun <strong className="text-red-600">TOZALASH</strong> so'zini kiriting:
            </p>
            <Input
              placeholder="TOZALASH"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="border-red-200 focus:border-red-400"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetDialogOpen(false);
                  setResetPassword("");
                  setKeepUsers(false);
                  setKeepLocations(false);
                  setKeepCatalog(false);
                }}
              >
                Bekor qilish
              </Button>
              <Button
                variant="destructive"
                disabled={resetMutation.isPending || resetPassword !== RESET_CONFIRM_WORD}
                onClick={() => resetMutation.mutate({ keepUsers, keepLocations, keepCatalog })}
              >
                {resetMutation.isPending ? "Tozalanmoqda..." : "Ha, tozalash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
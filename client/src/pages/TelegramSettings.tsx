import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bell, BotMessageSquare, CheckCircle2, Send, Settings2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ALL_MODULES = [
  { key: "dashboard",         label: "Boshqaruv paneli" },
  { key: "catalog",           label: "Katalog" },
  { key: "customer_products", label: "Mijoz uchun" },
  { key: "seedlings",         label: "Ko'chat partiyalari" },
  { key: "greenhouse",        label: "Teplitsa bosqichlari" },
  { key: "locations",         label: "Obyektlar" },
  { key: "transfers",         label: "Transferlar" },
  { key: "orders",            label: "Buyurtmalar" },
  { key: "reports",           label: "Hisobotlar" },
  { key: "finance",           label: "Moliya" },
  { key: "customers",         label: "CRM Mijozlar" },
  { key: "deliveries",        label: "Yetkazib berish" },
  { key: "agro_journal",      label: "Agro jurnal" },
  { key: "hr",                label: "HR" },
  { key: "certificates",      label: "Sertifikatlar" },
  { key: "telegram",          label: "Telegram Bot" },
  { key: "temperature",       label: "Harorat monitoring" },
];

const AUTO_NOTIFICATIONS = [
  { label: "Yangi buyurtma yaratilganda", desc: "Admin buyurtma qo'shganida xabar keladi" },
  { label: "Buyurtma sotilganda", desc: "To'liq yoki qisman bajarilganda" },
  { label: "Transfer yaratilganda", desc: "Ko'chat bir obyektdan ikkinchisiga o'tkazilganda" },
  { label: "Kam qoldiq ogohlantirishi", desc: "Tayyor ko'chat 100 tadan kam qolganida" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-600",
};
const statusLabels: Record<string, string> = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  cancelled: "Bekor",
  completed: "Bajarildi",
};

export default function TelegramSettingsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  // --- Shaxsiy Telegram sozlamalari ---
  const { data: settings } = trpc.telegram.getSettings.useQuery();
  const [form, setForm] = useState({ telegramChatId: "", telegramUsername: "" });

  useEffect(() => {
    if (settings) {
      setForm({
        telegramChatId: settings.telegram_chat_id || "",
        telegramUsername: settings.telegram_username || "",
      });
    }
  }, [settings]);

  const saveMutation = trpc.telegram.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("Telegram sozlamalari saqlandi");
      utils.telegram.getSettings.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Bot konfiguratsiyasi (faqat admin) ---
  const { data: botConfig } = trpc.telegram.getBotConfig.useQuery(undefined, { enabled: isAdmin });
  const [botForm, setBotForm] = useState({ botToken: "", isActive: false, siteUrl: "", botUsername: "" });

  useEffect(() => {
    if (botConfig) {
      setBotForm(f => ({
        ...f,
        isActive: Boolean(botConfig.isActive),
        siteUrl: botConfig.siteUrl || "",
        botUsername: botConfig.botUsername ? `@${botConfig.botUsername}` : "",
      }));
    }
  }, [botConfig]);

  const saveBotConfig = trpc.telegram.saveBotConfig.useMutation({
    onSuccess: () => {
      toast.success("Bot konfiguratsiyasi saqlandi");
      setBotForm(f => ({ ...f, botToken: "" }));
      utils.telegram.getBotConfig.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Bot buyurtmalari ---
  const { data: botOrders } = trpc.telegram.getBotOrders.useQuery(undefined, { enabled: isAdmin });
  const updateOrderStatus = trpc.telegram.updateBotOrderStatus.useMutation({
    onSuccess: () => {
      utils.telegram.getBotOrders.invalidate();
      toast.success("Holat yangilandi");
    },
  });

  // --- Bosh Ofes modul konfiguratsiyasi (faqat admin) ---
  const { data: boshOfesModules } = trpc.boshOfes.getModules.useQuery(undefined, { enabled: isAdmin });
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (boshOfesModules) setModuleConfig(boshOfesModules);
  }, [boshOfesModules]);

  const saveModules = trpc.boshOfes.saveModules.useMutation({
    onSuccess: () => {
      toast.success("Bosh Ofes modullari saqlandi");
      utils.boshOfes.getModules.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BotMessageSquare className="h-8 w-8 text-blue-500" />
            Telegram Bot
          </h1>
          <p className="mt-1 text-muted-foreground">
            Platforma hodisalari haqida Telegram orqali bildirishnomalar olish.
          </p>
        </div>

        {/* Bot konfiguratsiyasi — faqat admin — TOP */}
        {isAdmin && (
          <Card className="card-elegant border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-purple-500" />
                Bot konfiguratsiyasi (Admin)
              </CardTitle>
              <CardDescription>
                Bot tokenini va sayt manzilini sozlang
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Bot Token</Label>
                  <Input
                    type="password"
                    placeholder={botConfig?.hasToken ? "••••••• (token saqlangan)" : "1234567890:AAF..."}
                    value={botForm.botToken}
                    onChange={e => setBotForm(f => ({ ...f, botToken: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">@BotFather dan oling</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Bot username (murojaat uchun)</Label>
                  <Input
                    placeholder="@MyBot"
                    value={botForm.botUsername}
                    onChange={e => setBotForm(f => ({ ...f, botUsername: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Saytda "Bot orqali buyurtma" tugmasi shu linkga boradi</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Sayt manzili (URL)</Label>
                  <Input
                    placeholder="https://example.com"
                    value={botForm.siteUrl}
                    onChange={e => setBotForm(f => ({ ...f, siteUrl: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Bot "Saytda ko'rish" tugmasida ishlatiladi</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={botForm.isActive}
                    onChange={e => setBotForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Botni faollashtirish</span>
                </label>
                {botConfig?.isActive && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Faol
                  </span>
                )}
              </div>
              <Button
                disabled={saveBotConfig.isPending}
                onClick={() => saveBotConfig.mutate(botForm)}
              >
                {saveBotConfig.isPending ? "Saqlanmoqda..." : "Bot sozlamalarini saqlash"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Shaxsiy sozlamalar */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-blue-500" />
                Shaxsiy sozlamalar
              </CardTitle>
              <CardDescription>Telegram Chat ID ni kiriting — bildirishnomalar shu ID ga keladi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Telegram Chat ID *</Label>
                <Input
                  placeholder="123456789"
                  value={form.telegramChatId}
                  onChange={e => setForm(f => ({ ...f, telegramChatId: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">@userinfobot ga /start yuboring — u sizga ID beradi</p>
              </div>
              <div className="space-y-1.5">
                <Label>Telegram username (ixtiyoriy)</Label>
                <Input
                  placeholder="@username"
                  value={form.telegramUsername}
                  onChange={e => setForm(f => ({ ...f, telegramUsername: e.target.value }))}
                />
              </div>
              <Button
                className="w-full"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate({
                  ...form,
                  notifyNewOrder: true,
                  notifyOrderSold: true,
                  notifyTransfer: true,
                  notifyLowStock: true,
                })}
              >
                {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </CardContent>
          </Card>

          {/* Avtomatik bildirishnomalar */}
          <Card className="card-elegant border-blue-100 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-blue-500" />
                Avtomatik bildirishnomalar
              </CardTitle>
              <CardDescription>Quyidagi hodisalar haqida avtomatik xabar keladi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {AUTO_NOTIFICATIONS.map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl border border-border/50 bg-green-50/50 dark:bg-green-900/10 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bot buyurtmalari */}
        {isAdmin && (botOrders?.length ?? 0) > 0 && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4 text-green-500" />
                Bot orqali kelgan buyurtmalar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(botOrders || []).map((order: any) => (
                  <div key={order.id} className="rounded-xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">#{order.id} — {order.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          👤 {order.telegram_name || "—"}{order.telegram_username ? ` (@${order.telegram_username})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">🔢 Miqdor: {order.quantity}</p>
                        {order.address && <p className="text-xs text-muted-foreground">📍 {order.address}</p>}
                        {order.phone && <p className="text-xs text-muted-foreground">📞 {order.phone}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString("uz-UZ")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[order.status] || "bg-muted"}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                        {order.status === "new" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => updateOrderStatus.mutate({ id: order.id, status: "confirmed" })}>
                              Tasdiqlash
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                              onClick={() => updateOrderStatus.mutate({ id: order.id, status: "cancelled" })}>
                              Rad
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bosh Ofes modul konfiguratsiyasi */}
        {isAdmin && (
          <Card className="card-elegant border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-orange-500" />
                Bosh Ofes — Ko'rinadigan modullar
              </CardTitle>
              <CardDescription>
                "Bosh Ofes" rolidagi foydalanuvchilar qaysi bo'limlarga kirishi mumkinligini belgilang
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_MODULES.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={Boolean(moduleConfig[key])}
                      onChange={e => setModuleConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <Button
                disabled={saveModules.isPending}
                onClick={() => saveModules.mutate(moduleConfig)}
              >
                {saveModules.isPending ? "Saqlanmoqda..." : "Modullarni saqlash"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

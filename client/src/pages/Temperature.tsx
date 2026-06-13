import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Droplets,
  Plus,
  RefreshCw,
  Thermometer,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Yordamchi funksiyalar ─────────────────────────────────────────────────────

function formatTemp(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Number(value).toFixed(1)}°C`;
}

function formatHumidity(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function tempColor(temp: number | null | undefined): string {
  if (temp == null) return "text-muted-foreground";
  if (temp >= 35) return "text-red-600";
  if (temp >= 30) return "text-orange-500";
  if (temp >= 20) return "text-green-600";
  if (temp >= 10) return "text-blue-500";
  return "text-blue-700";
}

function tempBg(temp: number | null | undefined): string {
  if (temp == null) return "bg-muted/30";
  if (temp >= 35) return "bg-red-50 border-red-200";
  if (temp >= 30) return "bg-orange-50 border-orange-200";
  if (temp >= 20) return "bg-green-50 border-green-200";
  return "bg-blue-50 border-blue-200";
}

function isOnline(minutesAgo: number | null | undefined): boolean {
  return minutesAgo != null && minutesAgo <= 15;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Mini bar chart (soatlik grafik) ──────────────────────────────────────────
function MiniBarChart({ points }: { points: { timeLabel: string; temperature: number | null }[] }) {
  if (!points.length) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        Bugun ma'lumot yo'q
      </div>
    );
  }

  const temps = points.map((p) => p.temperature).filter((t): t is number => t != null);
  const minT = Math.min(...temps) - 2;
  const maxT = Math.max(...temps) + 2;
  const range = maxT - minT || 1;

  return (
    <div className="relative h-32 w-full">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-[9px] text-muted-foreground pr-1">
        <span>{maxT.toFixed(0)}°</span>
        <span>{((minT + maxT) / 2).toFixed(0)}°</span>
        <span>{minT.toFixed(0)}°</span>
      </div>
      {/* Bar chart */}
      <div className="ml-7 flex h-full items-end gap-px overflow-hidden">
        {points.map((p, i) => {
          const height = p.temperature != null ? ((p.temperature - minT) / range) * 100 : 0;
          const color =
            (p.temperature ?? 0) >= 35 ? "bg-red-400" :
            (p.temperature ?? 0) >= 30 ? "bg-orange-400" :
            (p.temperature ?? 0) >= 20 ? "bg-green-400" :
            "bg-blue-400";
          return (
            <div key={i} className="group relative flex flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-sm ${color} transition-all`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {/* Tooltip */}
              {i % Math.max(1, Math.floor(points.length / 8)) === 0 && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-0.5 text-[8px] text-muted-foreground whitespace-nowrap">
                  {p.timeLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lokatsiya batafsil kartasi ────────────────────────────────────────────────
function LocationDetailCard({
  locationId,
  locationName,
  selectedDate,
}: {
  locationId: number;
  locationName: string;
  selectedDate: string;
}) {
  const { data: history } = trpc.sensors.getHistory.useQuery({
    locationId,
    date: selectedDate,
  });
  const { data: dailyData } = trpc.sensors.getDaily.useQuery({
    locationId,
    date: selectedDate,
  });

  const stat = dailyData?.stats?.[0];
  const points = history || [];

  return (
    <div className="space-y-4">
      {/* Kunlik statistika */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Maksimal", value: formatTemp(stat?.maxTemp), sub: stat?.maxAt ? `Soat ${stat.maxAt}` : "", color: "text-red-600" },
          { label: "Minimal", value: formatTemp(stat?.minTemp), sub: stat?.minAt ? `Soat ${stat.minAt}` : "", color: "text-blue-600" },
          { label: "O'rtacha", value: formatTemp(stat?.avgTemp), sub: `${stat?.readingCount || 0} ta o'qish`, color: "text-green-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 text-center">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</div>
            {item.sub && <div className="text-[10px] text-muted-foreground">{item.sub}</div>}
          </div>
        ))}
      </div>
      {stat?.avgHumidity != null && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
          <Droplets className="h-4 w-4 text-blue-500" />
          <span className="text-blue-700">O'rtacha namlik: <strong>{formatHumidity(stat.avgHumidity)}</strong></span>
        </div>
      )}
      {/* Grafik */}
      <div className="rounded-2xl border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Kun davomida harorat (har 10 daqiqada)
        </div>
        <MiniBarChart points={points} />
        <div className="mt-5 text-center text-[9px] text-muted-foreground">Vaqt</div>
      </div>
    </div>
  );
}

// ─── Qurilmalarni boshqarish dialogi (admin) ──────────────────────────────────
function DevicesDialog({
  open,
  onClose,
  onSelectLocation,
}: {
  open: boolean;
  onClose: () => void;
  onSelectLocation?: (locationId: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: devices } = trpc.sensors.getDevices.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();

  const [form, setForm] = useState({ locationId: "", deviceCode: "", label: "" });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const addDevice = trpc.sensors.addDevice.useMutation({
    onSuccess: async (data: any) => {
      toast.success("Qurilma qo'shildi");
      setNewApiKey(data.apiKey);
      setForm({ locationId: "", deviceCode: "", label: "" });
      await utils.sensors.getDevices.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Xatolik"),
  });

  const deleteDevice = trpc.sensors.deleteDevice.useMutation({
    onSuccess: async () => {
      toast.success("Qurilma o'chirildi");
      await utils.sensors.getDevices.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setNewApiKey(null); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            Sensor qurilmalarini boshqarish
          </DialogTitle>
        </DialogHeader>

        {newApiKey && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Qurilma qo'shildi! API kalitini ESP32 ga kiriting:
            </div>
            <code className="block rounded-xl bg-green-100 px-3 py-2 text-xs font-mono text-green-900 break-all select-all">
              {newApiKey}
            </code>
            <p className="text-xs text-green-700">Bu kalit faqat bir marta ko'rsatiladi — nusxalab oling!</p>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="text-sm font-semibold">Yangi qurilma qo'shish</div>
          <div className="space-y-2">
            <Label className="text-xs">Teplitsa (lokatsiya)</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
              <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
              <SelectContent>
                {(locations || []).map((l: any) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Qurilma kodi (ESP32 ID)</Label>
            <Input
              placeholder="ESP32-001"
              value={form.deviceCode}
              onChange={(e) => setForm((f) => ({ ...f, deviceCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Nom (ixtiyoriy)</Label>
            <Input
              placeholder="T-1 termostat"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!form.locationId || !form.deviceCode || addDevice.isPending}
            onClick={() => addDevice.mutate({
              locationId: Number(form.locationId),
              deviceCode: form.deviceCode,
              label: form.label || undefined,
            })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {addDevice.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">Mavjud qurilmalar</div>
          {!(devices || []).filter((d: any) => d.isActive).length ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Qurilma yo'q</p>
          ) : (
            (devices || []).filter((d: any) => d.isActive).map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 hover:bg-muted/20 transition-colors">
                <button
                  className="flex flex-1 items-center gap-3 min-w-0 text-left"
                  onClick={() => d.locationId && onSelectLocation?.(d.locationId)}
                >
                  <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{d.label || d.deviceCode}</div>
                    <div className="text-xs text-muted-foreground">{d.locationName}</div>
                    {d.lastSeenAt && (
                      <div className="text-[10px] text-muted-foreground">
                        Oxirgi: {new Date(d.lastSeenAt).toLocaleString("uz-UZ")}
                      </div>
                    )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-500 hover:text-red-700"
                  onClick={() => deleteDevice.mutate(d.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Asosiy sahifa ─────────────────────────────────────────────────────────────
export default function TemperaturePage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [selectedDate, setSelectedDate] = useState(todayString());
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [devicesOpen, setDevicesOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const canView = user?.role === "admin" || user?.role === "bosh_agranom";

  const { data: liveData, dataUpdatedAt } = trpc.sensors.getLive.useQuery(undefined, {
    refetchInterval: 30_000, // Har 30 soniyada yangilanadi
    enabled: canView,
  } as any);

  const { data: dailyData } = trpc.sensors.getDaily.useQuery(
    { date: selectedDate },
    { enabled: canView } as any
  );

  const lastRefresh = useMemo(() => {
    if (!dataUpdatedAt) return null;
    return new Date(dataUpdatedAt).toLocaleTimeString("uz-UZ");
  }, [dataUpdatedAt]);

  const onlineCount = (liveData || []).filter((r: any) => isOnline(r.minutesAgo) && r.temperature != null).length;
  const totalWithSensor = (liveData || []).filter((r: any) => r.deviceCode).length;

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="card-elegant max-w-sm">
            <CardHeader><CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Ruxsat yo'q
            </CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Bu sahifa faqat bosh agronom va admin uchun ochiq.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ─── Sarlavha ─── */}
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
                <Thermometer className="h-8 w-8 text-red-500" />
                Teplitsa haroratlari
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                Real vaqt harorat monitoringi. Har 30 soniyada yangilanadi.
                {lastRefresh && <span className="ml-2 text-xs">Yangilangan: {lastRefresh}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => utils.sensors.getLive.invalidate()}
              >
                <RefreshCw className="h-4 w-4" />
                Yangilash
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDevicesOpen(true)}
                >
                  <Cpu className="h-4 w-4" />
                  Qurilmalar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Umumiy statistika ─── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Onlayn teplitsalar",
              value: `${onlineCount} / ${totalWithSensor}`,
              icon: Activity,
              color: "text-green-600",
              bg: "bg-green-100",
            },
            {
              label: "Jami lokatsiya",
              value: String((liveData || []).length),
              icon: Thermometer,
              color: "text-accent",
              bg: "bg-accent/10",
            },
            {
              label: "Bugungi max",
              value: (() => {
                const vals = (dailyData?.stats || []).map((s: any) => s.maxTemp).filter((v: any) => v != null);
                return vals.length ? formatTemp(Math.max(...vals)) : "—";
              })(),
              icon: AlertTriangle,
              color: "text-red-600",
              bg: "bg-red-100",
            },
            {
              label: "Bugungi min",
              value: (() => {
                const vals = (dailyData?.stats || []).map((s: any) => s.minTemp).filter((v: any) => v != null);
                return vals.length ? formatTemp(Math.min(...vals)) : "—";
              })(),
              icon: Clock,
              color: "text-blue-600",
              bg: "bg-blue-100",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
              <div className={`mt-2 text-2xl font-bold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* ─── Real vaqt harorat kartalar ─── */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Joriy harorat (real vaqt)
          </h2>
          {!(liveData || []).length ? (
            <div className="rounded-2xl border border-dashed border-border/60 py-12 text-center text-muted-foreground">
              <WifiOff className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">Hozircha sensor ma'lumotlari yo'q.</p>
              {isAdmin && (
                <Button size="sm" className="mt-3 gap-1.5" onClick={() => setDevicesOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Sensor qurilma qo'shish
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(liveData || []).map((row: any) => {
                const online = isOnline(row.minutesAgo) && row.temperature != null;
                const hasSensor = Boolean(row.deviceCode);
                return (
                  <button
                    key={row.locationId}
                    onClick={() => setSelectedLocationId(
                      selectedLocationId === row.locationId ? null : row.locationId
                    )}
                    className={`w-full rounded-2xl border p-4 text-left transition-all hover:shadow-md ${
                      selectedLocationId === row.locationId
                        ? "ring-2 ring-accent " + tempBg(row.temperature)
                        : hasSensor ? tempBg(row.temperature) : "border-border/40 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{row.locationName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{row.locationType}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {hasSensor ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`} />
                            {online ? "Onlayn" : "Oflayn"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Sensor yo'q
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <div className={`text-4xl font-black ${hasSensor ? tempColor(row.temperature) : "text-muted-foreground"}`}>
                        {hasSensor ? formatTemp(row.temperature) : "—"}
                      </div>
                      {row.humidity != null && (
                        <div className="flex items-center gap-1 text-sm text-blue-600">
                          <Droplets className="h-3.5 w-3.5" />
                          {formatHumidity(row.humidity)}
                        </div>
                      )}
                    </div>

                    {hasSensor && row.recordedAt && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                        {row.minutesAgo != null && row.minutesAgo < 60
                          ? `${row.minutesAgo} daqiqa oldin`
                          : new Date(row.recordedAt).toLocaleTimeString("uz-UZ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Tanlangan lokatsiya batafsil ko'rinishi ─── */}
        {selectedLocationId && (
          <Card className="card-elegant">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Thermometer className="h-5 w-5 text-red-500" />
                  {(liveData || []).find((r: any) => r.locationId === selectedLocationId)?.locationName} — Batafsil
                </CardTitle>
                {/* Sana navigatsiya */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayString()}
                    onChange={(e) => setSelectedDate(e.target.value || todayString())}
                    className="rounded-xl border border-border/60 bg-background px-3 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={selectedDate >= todayString()}
                    onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateDisplay(selectedDate)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LocationDetailCard
                locationId={selectedLocationId}
                locationName={(liveData || []).find((r: any) => r.locationId === selectedLocationId)?.locationName || ""}
                selectedDate={selectedDate}
              />
            </CardContent>
          </Card>
        )}

        {/* ─── Kunlik jadval (barcha lokatsiyalar) ─── */}
        <Card className="card-elegant">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                Kunlik statistika
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayString()}
                  onChange={(e) => setSelectedDate(e.target.value || todayString())}
                  className="rounded-xl border border-border/60 bg-background px-3 py-1.5 text-sm"
                />
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={selectedDate >= todayString()}
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!(dailyData?.stats || []).length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {selectedDate} uchun ma'lumot yo'q
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30">
                      {["Lokatsiya", "Max harorat", "Vaqti", "Min harorat", "Vaqti", "O'rtacha", "Namlik", "O'qishlar"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dailyData?.stats || []).map((stat: any) => (
                      <tr
                        key={stat.locationId}
                        className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                        onClick={() => setSelectedLocationId(
                          selectedLocationId === stat.locationId ? null : stat.locationId
                        )}
                      >
                        <td className="px-3 py-2.5 font-semibold">{stat.locationName}</td>
                        <td className={`px-3 py-2.5 font-bold ${tempColor(stat.maxTemp)}`}>
                          {formatTemp(stat.maxTemp)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {stat.maxAt ? `⏰ ${stat.maxAt}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-blue-600">
                          {formatTemp(stat.minTemp)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {stat.minAt ? `⏰ ${stat.minAt}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-green-700 font-semibold">
                          {formatTemp(stat.avgTemp)}
                        </td>
                        <td className="px-3 py-2.5 text-blue-500">
                          {formatHumidity(stat.avgHumidity)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-center">
                          {stat.readingCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Qurilmalar dialogi */}
      {isAdmin && (
        <DevicesDialog
          open={devicesOpen}
          onClose={() => setDevicesOpen(false)}
          onSelectLocation={(locationId) => {
            setDevicesOpen(false);
            setSelectedLocationId(locationId);
          }}
        />
      )}
    </DashboardLayout>
  );
}

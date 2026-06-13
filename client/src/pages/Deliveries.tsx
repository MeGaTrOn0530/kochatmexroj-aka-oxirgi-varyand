import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calendar, Car, MapPin, Package, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("uz-UZ");
}

const statusLabel: Record<string, string> = {
  scheduled: "Rejalashtirilgan", in_transit: "Yo'lda",
  delivered: "Yetkazildi", cancelled: "Bekor qilingan",
};
const statusColor: Record<string, string> = {
  scheduled: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  in_transit: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
  delivered: "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-400",
  cancelled: "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-400",
};

const emptyForm = {
  orderId: "", customerName: "", address: "", quantity: "",
  deliveryDate: "", deliveryTime: "", driverName: "", driverPhone: "", vehicle: "", note: "",
};

export default function DeliveriesPage() {
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: deliveries } = trpc.deliveries.getAll.useQuery(filterStatus !== "all" ? filterStatus : undefined);
  const { data: orders } = trpc.orders.getAll.useQuery();

  const addMutation = trpc.deliveries.add.useMutation({
    onSuccess: async () => {
      toast.success("Yetkazib berish qo'shildi");
      setShowForm(false); setForm(emptyForm);
      await utils.deliveries.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = trpc.deliveries.updateStatus.useMutation({
    onSuccess: async () => { toast.success("Holat yangilandi"); await utils.deliveries.getAll.invalidate(); },
  });

  const removeMutation = trpc.deliveries.remove.useMutation({
    onSuccess: async () => { await utils.deliveries.getAll.invalidate(); },
  });

  const rows = deliveries || [];
  const countByStatus = (s: string) => rows.filter((d: any) => d.status === s).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Truck className="h-8 w-8 text-accent" />
            Yetkazib berish
          </h1>
          <p className="mt-1 text-muted-foreground">Buyurtmalar bo'yicha yetkazib berish jadvali va haydovchilar.</p>
        </div>

        {/* Stat */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Rejalashtirilgan", count: countByStatus("scheduled"), color: "text-blue-600" },
            { label: "Yo'lda", count: countByStatus("in_transit"), color: "text-amber-600" },
            { label: "Yetkazildi", count: countByStatus("delivered"), color: "text-green-600" },
            { label: "Bekor", count: countByStatus("cancelled"), color: "text-red-500" },
          ].map(({ label, count, color }) => (
            <Card key={label} className="card-elegant">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`mt-1 text-2xl font-bold ${color}`}>{count}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtr + qo'shish */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            {["all", "scheduled", "in_transit", "delivered", "cancelled"].map(s => (
              <Button key={s} size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}>
                {s === "all" ? "Hammasi" : statusLabel[s]}
              </Button>
            ))}
          </div>
          <Button className="gap-2" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-4 w-4" /> Yangi yetkazib berish
          </Button>
        </div>

        {/* Forma */}
        {showForm && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="text-base">Yangi yetkazib berish</CardTitle>
              <CardDescription>Mijoz, manzil, sana va haydovchi ma'lumotlarini kiriting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Buyurtma (ixtiyoriy)</Label>
                  <Select value={form.orderId} onValueChange={v => {
                    const order = (orders || []).find((o: any) => String(o.id) === v);
                    setForm(f => ({
                      ...f, orderId: v,
                      customerName: order ? (order.customerName || f.customerName) : f.customerName,
                      quantity: order ? String(order.totalQuantity || f.quantity) : f.quantity,
                    }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bog'liq emas</SelectItem>
                      {(orders || []).map((o: any) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber} — {o.customerName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mijoz nomi *</Label>
                  <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Miqdor (ta)</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Yetkazish manzili *</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sana *</Label>
                  <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vaqt oralig'i</Label>
                  <Input placeholder="09:00 – 18:00" value={form.deliveryTime}
                    onChange={e => setForm(f => ({ ...f, deliveryTime: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Haydovchi ismi</Label>
                  <Input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Haydovchi telefoni</Label>
                  <Input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mashina (raqami)</Label>
                  <Input placeholder="01A 123 AA" value={form.vehicle}
                    onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Bekor</Button>
                <Button
                  disabled={!form.customerName || !form.address || !form.deliveryDate || addMutation.isPending}
                  onClick={() => addMutation.mutate({
                    orderId: form.orderId && form.orderId !== "none" ? Number(form.orderId) : undefined,
                    customerName: form.customerName, address: form.address,
                    quantity: Number(form.quantity || 0), deliveryDate: form.deliveryDate,
                    deliveryTime: form.deliveryTime || undefined, driverName: form.driverName || undefined,
                    driverPhone: form.driverPhone || undefined, vehicle: form.vehicle || undefined,
                  })}>
                  Saqlash
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Yetkazib berishlar */}
        <div className="space-y-3">
          {rows.map((d: any) => (
            <div key={d.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
              <div className={`h-1 w-full ${d.status === "delivered" ? "bg-green-400" : d.status === "in_transit" ? "bg-amber-400" : d.status === "cancelled" ? "bg-red-300" : "bg-blue-400"}`} />
              <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground">{d.customer_name}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor[d.status] || "bg-muted text-muted-foreground border-border"}`}>
                      {statusLabel[d.status] || d.status}
                    </span>
                    {d.order_number && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">{d.order_number}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {d.address}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {formatDate(d.delivery_date)} {d.delivery_time ? `· ${d.delivery_time}` : ""}
                    </span>
                    {d.quantity > 0 && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" /> {d.quantity} ta
                      </span>
                    )}
                    {d.driver_name && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3.5 w-3.5" /> {d.driver_name}
                        {d.driver_phone ? ` · ${d.driver_phone}` : ""}
                        {d.vehicle ? ` · ${d.vehicle}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={d.status}
                    onValueChange={v => statusMutation.mutate({ id: d.id, status: v })}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Rejalashtirilgan</SelectItem>
                      <SelectItem value="in_transit">Yo'lda</SelectItem>
                      <SelectItem value="delivered">Yetkazildi ✓</SelectItem>
                      <SelectItem value="cancelled">Bekor qilish</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeMutation.mutate(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!rows.length && (
            <div className="py-16 text-center">
              <Truck className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Yetkazib berishlar yo'q</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

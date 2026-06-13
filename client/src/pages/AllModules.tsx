import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BadgeDollarSign, Banknote, BookOpen, BotMessageSquare, Calendar,
  CheckCircle2, ClipboardList, Leaf, Medal, Plus, ShoppingBag,
  Trash2, Truck, UserCheck, Users2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatMoney(v: number) { return new Intl.NumberFormat("uz-UZ").format(v || 0); }
function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("uz-UZ");
}

// ─────────────────────────────────────────────
// 1. MOLIYAVIY TIZIM
// ─────────────────────────────────────────────
function PaymentsTab() {
  const utils = trpc.useUtils();
  const { data: payments } = trpc.payments.getAll.useQuery();
  const { data: orders } = trpc.orders.getAll.useQuery();
  const [form, setForm] = useState({ orderId: "", amount: "", paymentMethod: "cash", note: "" });

  const addMutation = trpc.payments.add.useMutation({
    onSuccess: async () => {
      toast.success("To'lov qo'shildi");
      setForm({ orderId: "", amount: "", paymentMethod: "cash", note: "" });
      await utils.payments.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = trpc.payments.remove.useMutation({
    onSuccess: async () => { toast.success("O'chirildi"); await utils.payments.getAll.invalidate(); },
  });

  const paymentMethodLabel: Record<string, string> = {
    cash: "Naqd", card: "Karta", transfer: "Bank o'tkazmasi", other: "Boshqa",
  };

  return (
    <div className="space-y-4">
      <Card className="card-elegant">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4"/>Yangi to'lov</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Buyurtma</Label>
              <Select value={form.orderId} onValueChange={(v) => setForm(f => ({...f, orderId: v}))}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {(orders || []).filter((o: any) => o.status !== "cancelled").map((o: any) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.orderNumber} — {o.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Miqdor (so'm)</Label>
              <Input type="number" placeholder="500000" value={form.amount}
                onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>To'lov usuli</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({...f, paymentMethod: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Naqd</SelectItem>
                  <SelectItem value="card">Karta</SelectItem>
                  <SelectItem value="transfer">Bank o'tkazmasi</SelectItem>
                  <SelectItem value="other">Boshqa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <div className="flex gap-2">
                <Input placeholder="Ixtiyoriy..." value={form.note}
                  onChange={(e) => setForm(f => ({...f, note: e.target.value}))} />
                <Button disabled={!form.orderId || !form.amount || addMutation.isPending}
                  onClick={() => addMutation.mutate({
                    orderId: Number(form.orderId), amount: Number(form.amount),
                    paymentMethod: form.paymentMethod, note: form.note || undefined,
                  })}>
                  <Plus className="h-4 w-4"/>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border/60 bg-muted/30">
            {["Sana","Buyurtma","Mijoz","Miqdor","Usul","Izoh",""].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(payments || []).map((p: any) => (
              <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(p.payment_date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.order_number}</td>
                <td className="px-3 py-2">{p.customer_name}</td>
                <td className="px-3 py-2 font-semibold text-green-600">{formatMoney(p.amount)} so'm</td>
                <td className="px-3 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{paymentMethodLabel[p.payment_method] || p.payment_method}</span></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.note || "-"}</td>
                <td className="px-3 py-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeMutation.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(payments || []).length && <div className="py-10 text-center text-sm text-muted-foreground">To'lovlar yo'q</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2. CRM
// ─────────────────────────────────────────────
function CustomersTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const { data: customers } = trpc.customers.getAll.useQuery(search || undefined);
  const [form, setForm] = useState({ name: "", phone: "", phone2: "", email: "", address: "", notes: "" });
  const [showForm, setShowForm] = useState(false);

  const addMutation = trpc.customers.add.useMutation({
    onSuccess: async () => {
      toast.success("Mijoz qo'shildi"); setShowForm(false);
      setForm({ name: "", phone: "", phone2: "", email: "", address: "", notes: "" });
      await utils.customers.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMutation = trpc.customers.remove.useMutation({
    onSuccess: async () => { toast.success("O'chirildi"); await utils.customers.getAll.invalidate(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input placeholder="Qidirish: ism, telefon, email..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" className="gap-2" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4"/> Yangi mijoz
        </Button>
      </div>

      {showForm && (
        <Card className="card-elegant">
          <CardContent className="pt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5"><Label>Ism *</Label>
                <Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Asosiy tel</Label>
                <Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Qo'shimcha tel</Label>
                <Input value={form.phone2} onChange={e => setForm(f=>({...f,phone2:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Manzil</Label>
                <Input value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Izoh</Label>
              <Textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={2}/></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Bekor</Button>
              <Button disabled={!form.name || addMutation.isPending}
                onClick={() => addMutation.mutate(form)}>Saqlash</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(customers || []).map((c: any) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{c.name}</div>
                {c.phone && <div className="text-sm text-muted-foreground">{c.phone}</div>}
                {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeMutation.mutate(c.id)}>
                <Trash2 className="h-3.5 w-3.5"/>
              </Button>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <div className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-center">
                <div className="text-muted-foreground">Buyurtmalar</div>
                <div className="font-bold text-foreground">{c.order_count || 0}</div>
              </div>
              <div className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-center">
                <div className="text-muted-foreground">Jami xarid</div>
                <div className="font-bold text-green-600">{formatMoney(c.total_spent || 0)} so'm</div>
              </div>
            </div>
          </div>
        ))}
        {!(customers || []).length && <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Mijozlar yo'q</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3. YETKAZIB BERISH
// ─────────────────────────────────────────────
function DeliveriesTab() {
  const utils = trpc.useUtils();
  const { data: deliveries } = trpc.deliveries.getAll.useQuery();
  const { data: orders } = trpc.orders.getAll.useQuery();
  const [form, setForm] = useState({
    orderId: "", customerName: "", address: "", quantity: "",
    deliveryDate: "", deliveryTime: "", driverName: "", driverPhone: "", vehicle: "", note: "",
  });
  const [showForm, setShowForm] = useState(false);

  const addMutation = trpc.deliveries.add.useMutation({
    onSuccess: async () => {
      toast.success("Yetkazib berish qo'shildi"); setShowForm(false);
      setForm({ orderId:"",customerName:"",address:"",quantity:"",deliveryDate:"",deliveryTime:"",driverName:"",driverPhone:"",vehicle:"",note:"" });
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

  const statusLabel: Record<string, string> = {
    scheduled: "Rejalashtirilgan", in_transit: "Yo'lda",
    delivered: "Yetkazildi", cancelled: "Bekor",
  };
  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" className="gap-2" onClick={() => setShowForm(v => !v)}>
        <Plus className="h-4 w-4"/> Yangi yetkazib berish
      </Button>

      {showForm && (
        <Card className="card-elegant">
          <CardContent className="pt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5"><Label>Buyurtma (ixtiyoriy)</Label>
                <Select value={form.orderId} onValueChange={v => setForm(f=>({...f,orderId:v}))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bog'liq emas</SelectItem>
                    {(orders || []).map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber} — {o.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Mijoz nomi *</Label>
                <Input value={form.customerName} onChange={e => setForm(f=>({...f,customerName:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Miqdor</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Manzil *</Label>
                <Input value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Yetkazish sanasi *</Label>
                <Input type="date" value={form.deliveryDate} onChange={e => setForm(f=>({...f,deliveryDate:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Vaqti</Label>
                <Input value={form.deliveryTime} onChange={e => setForm(f=>({...f,deliveryTime:e.target.value}))} placeholder="09:00 - 18:00" /></div>
              <div className="space-y-1.5"><Label>Haydovchi</Label>
                <Input value={form.driverName} onChange={e => setForm(f=>({...f,driverName:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Haydovchi tel</Label>
                <Input value={form.driverPhone} onChange={e => setForm(f=>({...f,driverPhone:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Mashina</Label>
                <Input value={form.vehicle} onChange={e => setForm(f=>({...f,vehicle:e.target.value}))} placeholder="01A 123 AA" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Bekor</Button>
              <Button disabled={!form.customerName || !form.address || !form.deliveryDate || addMutation.isPending}
                onClick={() => addMutation.mutate({
                  orderId: form.orderId && form.orderId !== "none" ? Number(form.orderId) : undefined,
                  customerName: form.customerName, address: form.address,
                  quantity: Number(form.quantity || 0), deliveryDate: form.deliveryDate,
                  deliveryTime: form.deliveryTime || undefined, driverName: form.driverName || undefined,
                  driverPhone: form.driverPhone || undefined, vehicle: form.vehicle || undefined,
                  note: form.note || undefined,
                })}>Saqlash</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(deliveries || []).map((d: any) => (
          <div key={d.id} className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{d.customer_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[d.status] || "bg-muted text-muted-foreground"}`}>
                    {statusLabel[d.status] || d.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{d.address}</div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>📅 {formatDate(d.delivery_date)} {d.delivery_time || ""}</span>
                  {d.driver_name && <span>🚗 {d.driver_name} {d.driver_phone ? `· ${d.driver_phone}` : ""}</span>}
                  {d.vehicle && <span>🚌 {d.vehicle}</span>}
                  {d.quantity > 0 && <span>📦 {d.quantity} ta</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={d.status} onValueChange={v => statusMutation.mutate({ id: d.id, status: v })}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Rejalashtirilgan</SelectItem>
                    <SelectItem value="in_transit">Yo'lda</SelectItem>
                    <SelectItem value="delivered">Yetkazildi</SelectItem>
                    <SelectItem value="cancelled">Bekor</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeMutation.mutate(d.id)}>
                  <Trash2 className="h-3.5 w-3.5"/>
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!(deliveries || []).length && <div className="py-10 text-center text-sm text-muted-foreground">Yetkazib berishlar yo'q</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 4. AGROTEXNIK JURNALI
// ─────────────────────────────────────────────
function AgroJournalTab() {
  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: entries } = trpc.agroJournal.getAll.useQuery();
  const [form, setForm] = useState({
    locationId: "", actionType: "watering", actionDate: "",
    quantityUsed: "", unit: "", productName: "", description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const addMutation = trpc.agroJournal.add.useMutation({
    onSuccess: async () => {
      toast.success("Yozuv qo'shildi"); setShowForm(false);
      setForm({ locationId:"",actionType:"watering",actionDate:"",quantityUsed:"",unit:"",productName:"",description:"" });
      await utils.agroJournal.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMutation = trpc.agroJournal.remove.useMutation({
    onSuccess: async () => { await utils.agroJournal.getAll.invalidate(); },
  });

  const actionTypeLabel: Record<string, string> = {
    watering: "💧 Sug'orish", fertilizing: "🌿 O'g'itlash",
    pesticide: "🔬 Kimyoviy ishlov", pruning: "✂️ Qirqish",
    transplant: "🌱 Ko'chirildi", inspection: "🔍 Tekshiruv",
    other: "📝 Boshqa",
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" className="gap-2" onClick={() => setShowForm(v => !v)}>
        <Plus className="h-4 w-4"/> Yangi yozuv
      </Button>

      {showForm && (
        <Card className="card-elegant">
          <CardContent className="pt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5"><Label>Harakat turi *</Label>
                <Select value={form.actionType} onValueChange={v => setForm(f=>({...f,actionType:v}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {Object.entries(actionTypeLabel).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Obyekt</Label>
                <Select value={form.locationId} onValueChange={v => setForm(f=>({...f,locationId:v}))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {(locations || []).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Sana/vaqt</Label>
                <Input type="datetime-local" value={form.actionDate} onChange={e => setForm(f=>({...f,actionDate:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Mahsulot nomi</Label>
                <Input value={form.productName} onChange={e => setForm(f=>({...f,productName:e.target.value}))} placeholder="Urea, NPK..." /></div>
              <div className="space-y-1.5"><Label>Miqdori</Label>
                <Input type="number" value={form.quantityUsed} onChange={e => setForm(f=>({...f,quantityUsed:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>O'lchov birligi</Label>
                <Input value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} placeholder="kg, litr, dona..." /></div>
            </div>
            <div className="space-y-1.5"><Label>Tavsif</Label>
              <Textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2}/></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Bekor</Button>
              <Button disabled={addMutation.isPending}
                onClick={() => addMutation.mutate({
                  locationId: form.locationId ? Number(form.locationId) : undefined,
                  actionType: form.actionType, actionDate: form.actionDate || undefined,
                  quantityUsed: form.quantityUsed ? Number(form.quantityUsed) : undefined,
                  unit: form.unit || undefined, productName: form.productName || undefined,
                  description: form.description || undefined,
                })}>Saqlash</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(entries || []).map((e: any) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{actionTypeLabel[e.action_type] || e.action_type}</span>
                {e.location_name && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{e.location_name}</span>}
              </div>
              {e.product_name && <div className="text-sm text-foreground">{e.product_name} {e.quantity_used ? `— ${e.quantity_used} ${e.unit || ""}` : ""}</div>}
              {e.description && <div className="text-xs text-muted-foreground line-clamp-1">{e.description}</div>}
              <div className="text-xs text-muted-foreground">{e.performed_by_name?.trim() || "-"} · {e.action_date ? new Date(e.action_date).toLocaleString("uz-UZ") : "-"}</div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeMutation.mutate(e.id)}>
              <Trash2 className="h-3.5 w-3.5"/>
            </Button>
          </div>
        ))}
        {!(entries || []).length && <div className="py-10 text-center text-sm text-muted-foreground">Yozuvlar yo'q</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 5. HR
// ─────────────────────────────────────────────
function HrTab() {
  const utils = trpc.useUtils();
  const [hrTab, setHrTab] = useState<"attendance"|"tasks">("tasks");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: attendance } = trpc.hr.getAttendance.useQuery(selectedDate);
  const { data: tasks } = trpc.hr.getTasks.useQuery();
  const { data: users } = trpc.admin.getAllUsers.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();
  const [taskForm, setTaskForm] = useState({ title:"",description:"",assignedTo:"",locationId:"",priority:"normal",dueDate:"" });

  const saveMutation = trpc.hr.saveAttendance.useMutation({
    onSuccess: async () => { toast.success("Saqlandi"); await utils.hr.getAttendance.invalidate(); },
  });
  const addTaskMutation = trpc.hr.addTask.useMutation({
    onSuccess: async () => {
      toast.success("Topshiriq yaratildi");
      setTaskForm({ title:"",description:"",assignedTo:"",locationId:"",priority:"normal",dueDate:"" });
      await utils.hr.getTasks.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const taskStatusMutation = trpc.hr.updateTaskStatus.useMutation({
    onSuccess: async () => { await utils.hr.getTasks.invalidate(); },
  });
  const removeTaskMutation = trpc.hr.removeTask.useMutation({
    onSuccess: async () => { await utils.hr.getTasks.invalidate(); },
  });

  const statusColor: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={hrTab === "tasks" ? "default" : "outline"} size="sm" onClick={() => setHrTab("tasks")}>
          <ClipboardList className="mr-1.5 h-4 w-4"/> Topshiriqlar
        </Button>
        <Button variant={hrTab === "attendance" ? "default" : "outline"} size="sm" onClick={() => setHrTab("attendance")}>
          <UserCheck className="mr-1.5 h-4 w-4"/> Davomat
        </Button>
      </div>

      {hrTab === "tasks" ? (
        <>
          <Card className="card-elegant">
            <CardHeader><CardTitle className="text-base">Yangi topshiriq</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><Label>Sarlavha *</Label>
                  <Input value={taskForm.title} onChange={e => setTaskForm(f=>({...f,title:e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Mas'ul xodim</Label>
                  <Select value={taskForm.assignedTo} onValueChange={v => setTaskForm(f=>({...f,assignedTo:v}))}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      {(users || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name || u.username}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Muhimligi</Label>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm(f=>({...f,priority:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Past</SelectItem>
                      <SelectItem value="normal">O'rta</SelectItem>
                      <SelectItem value="high">Yuqori</SelectItem>
                      <SelectItem value="urgent">Shoshilinch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Muddat</Label>
                  <Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f=>({...f,dueDate:e.target.value}))} /></div>
              </div>
              <Button disabled={!taskForm.title || addTaskMutation.isPending}
                onClick={() => addTaskMutation.mutate({
                  title: taskForm.title, assignedTo: taskForm.assignedTo ? Number(taskForm.assignedTo) : undefined,
                  priority: taskForm.priority, dueDate: taskForm.dueDate || undefined,
                })}>
                <Plus className="mr-1.5 h-4 w-4"/> Yaratish
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {(tasks || []).map((t: any) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{t.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[t.status] || "bg-muted text-muted-foreground"}`}>
                      {t.status === "pending" ? "Kutilmoqda" : t.status === "in_progress" ? "Jarayonda" : "Bajarildi"}
                    </span>
                    {t.priority === "urgent" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Shoshilinch</span>}
                    {t.priority === "high" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Yuqori</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.assigned_to_name?.trim() || "Biriktirilmagan"}{t.due_date ? ` · Muddat: ${formatDate(t.due_date)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {t.status !== "done" && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      onClick={() => taskStatusMutation.mutate({ id: t.id, status: t.status === "pending" ? "in_progress" : "done" })}>
                      <CheckCircle2 className="h-3.5 w-3.5"/>
                      {t.status === "pending" ? "Boshlash" : "Bajarildi"}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeTaskMutation.mutate(t.id)}>
                    <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
                </div>
              </div>
            ))}
            {!(tasks || []).length && <div className="py-10 text-center text-sm text-muted-foreground">Topshiriqlar yo'q</div>}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Sana:</Label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44"/>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 bg-muted/30">
                {["Xodim","Rol","Kelish","Ketish","Holat",""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(users || []).map((u: any) => {
                  const rec = (attendance || []).find((a: any) => a.user_id === u.id);
                  return (
                    <tr key={u.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-medium">{u.name || u.username}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{u.role}</td>
                      <td className="px-3 py-2 text-xs">{rec?.check_in || "—"}</td>
                      <td className="px-3 py-2 text-xs">{rec?.check_out || "—"}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={rec?.status || ""}
                          onValueChange={v => saveMutation.mutate({ userId: u.id, workDate: selectedDate, status: v, checkIn: rec?.check_in || undefined, checkOut: rec?.check_out || undefined })}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Belgilanmagan"/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Keldi ✓</SelectItem>
                            <SelectItem value="absent">Kelmadi ✗</SelectItem>
                            <SelectItem value="late">Kech keldi</SelectItem>
                            <SelectItem value="sick">Kasallangan</SelectItem>
                            <SelectItem value="vacation">Ta'tilda</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 6. TELEGRAM BOT
// ─────────────────────────────────────────────
function TelegramTab() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.telegram.getSettings.useQuery();
  const [form, setForm] = useState({
    telegramChatId: "", telegramUsername: "",
    notifyNewOrder: true, notifyOrderSold: true, notifyTransfer: true, notifyLowStock: false,
  });

  const saveMutation = trpc.telegram.saveSettings.useMutation({
    onSuccess: () => { toast.success("Telegram sozlamalari saqlandi"); utils.telegram.getSettings.invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = settings || {};

  return (
    <div className="space-y-4 max-w-xl">
      <Card className="card-elegant border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BotMessageSquare className="h-5 w-5 text-blue-500"/>
            Telegram Bot ulanish
          </CardTitle>
          <CardDescription>
            Bot bilan ulanish uchun <strong>@KochatPlatformBot</strong> ga <code>/start</code> yuboring va Chat ID ni kiriting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm">
            <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Chat ID olish:</div>
            <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400 text-xs">
              <li>Telegram da @userinfobot ga /start yuboring</li>
              <li>U sizning Chat ID ni beradi</li>
              <li>Shu ID ni quyiga kiriting</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Telegram Chat ID</Label>
              <Input placeholder="123456789"
                defaultValue={String(current?.telegram_chat_id || "")}
                onChange={e => setForm(f => ({...f, telegramChatId: e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Telegram username (ixtiyoriy)</Label>
              <Input placeholder="@username"
                defaultValue={String(current?.telegram_username || "")}
                onChange={e => setForm(f => ({...f, telegramUsername: e.target.value}))} /></div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Bildirishnomalar</Label>
            {[
              { key: "notifyNewOrder", label: "Yangi buyurtma", val: current?.notify_new_order ?? true },
              { key: "notifyOrderSold", label: "Buyurtma sotildi", val: current?.notify_order_sold ?? true },
              { key: "notifyTransfer", label: "Transfer yaratildi", val: current?.notify_transfer ?? true },
              { key: "notifyLowStock", label: "Kam qoldiq ogohlantirish", val: current?.notify_low_stock ?? false },
            ].map(item => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked={Boolean(item.val)}
                  onChange={e => setForm(f => ({...f, [item.key]: e.target.checked}))}
                  className="rounded border-border" />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>

          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            Saqlash
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// 7. SIFAT SERTIFIKATLARI
// ─────────────────────────────────────────────
function CertificatesTab() {
  const utils = trpc.useUtils();
  const { data: certs } = trpc.certificates.getAll.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const [form, setForm] = useState({
    batchId: "", issuedTo: "", issueDate: new Date().toISOString().slice(0,10),
    expiryDate: "", quantity: "", notes: "", certType: "quality",
  });
  const [showForm, setShowForm] = useState(false);

  const addMutation = trpc.certificates.add.useMutation({
    onSuccess: async () => {
      toast.success("Sertifikat yaratildi"); setShowForm(false);
      setForm({ batchId:"",issuedTo:"",issueDate:new Date().toISOString().slice(0,10),expiryDate:"",quantity:"",notes:"",certType:"quality" });
      await utils.certificates.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const certTypeLabel: Record<string, string> = {
    quality: "Sifat sertifikati", phyto: "Fitosanitar sertifikat",
    origin: "Kelib chiqish sertifikati", other: "Boshqa",
  };

  const handlePrint = (cert: any) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
@page { size: A4; margin: 20mm; }
body { font-family: Arial, sans-serif; text-align: center; }
.title { font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 20px 0 8px; }
.sub { font-size: 14px; color: #666; margin-bottom: 30px; }
.line { border-bottom: 2px solid #000; width: 60%; margin: 0 auto 30px; }
.info { text-align: left; max-width: 500px; margin: 0 auto; }
.row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
.label { color: #666; font-size: 13px; }
.value { font-weight: 600; font-size: 13px; }
.cert-num { font-family: monospace; font-size: 11px; color: #999; margin-top: 30px; }
.footer { margin-top: 50px; display: flex; justify-content: space-around; }
.sign { text-align: center; width: 200px; }
.sign-line { border-bottom: 1px solid #000; margin-bottom: 6px; }
.sign-label { font-size: 11px; color: #666; }
</style></head><body>
<div class="title">S E R T I F I K A T</div>
<div class="sub">${certTypeLabel[cert.cert_type] || cert.cert_type}</div>
<div class="line"></div>
<div class="info">
  <div class="row"><span class="label">Kimga berildi</span><span class="value">${cert.issued_to}</span></div>
  <div class="row"><span class="label">Ko'chat turi</span><span class="value">${cert.seedling_type || "-"}</span></div>
  <div class="row"><span class="label">Nav</span><span class="value">${cert.variety_name || "-"}</span></div>
  <div class="row"><span class="label">Miqdor</span><span class="value">${cert.quantity} ta</span></div>
  <div class="row"><span class="label">Lokatsiya</span><span class="value">${cert.location_name || "-"}</span></div>
  <div class="row"><span class="label">Berilgan sana</span><span class="value">${formatDate(cert.issue_date)}</span></div>
  ${cert.expiry_date ? `<div class="row"><span class="label">Amal qilish muddati</span><span class="value">${formatDate(cert.expiry_date)}</span></div>` : ""}
  ${cert.notes ? `<div class="row"><span class="label">Izoh</span><span class="value">${cert.notes}</span></div>` : ""}
</div>
<div class="cert-num">Sertifikat №: ${cert.certificate_number}</div>
<div class="footer">
  <div class="sign"><div class="sign-line">&nbsp;</div><div class="sign-label">Sana</div></div>
  <div class="sign"><div class="sign-line">&nbsp;</div><div class="sign-label">Imzo</div></div>
  <div class="sign"><div class="sign-line">&nbsp;</div><div class="sign-label">Muhr</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=800,height=700");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); }
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" className="gap-2" onClick={() => setShowForm(v => !v)}>
        <Plus className="h-4 w-4"/> Yangi sertifikat
      </Button>

      {showForm && (
        <Card className="card-elegant">
          <CardContent className="pt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5"><Label>Sertifikat turi</Label>
                <Select value={form.certType} onValueChange={v => setForm(f=>({...f,certType:v}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {Object.entries(certTypeLabel).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Partiya (ixtiyoriy)</Label>
                <Select value={form.batchId} onValueChange={v => setForm(f=>({...f,batchId:v}))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bog'liq emas</SelectItem>
                    {(batches || []).map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.batchNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Kimga berildi *</Label>
                <Input value={form.issuedTo} onChange={e => setForm(f=>({...f,issuedTo:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Berilgan sana *</Label>
                <Input type="date" value={form.issueDate} onChange={e => setForm(f=>({...f,issueDate:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Amal qilish muddati</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f=>({...f,expiryDate:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Miqdor (ta)</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Izoh</Label>
              <Textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={2}/></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Bekor</Button>
              <Button disabled={!form.issuedTo || !form.issueDate || addMutation.isPending}
                onClick={() => addMutation.mutate({
                  batchId: form.batchId && form.batchId !== "none" ? Number(form.batchId) : undefined,
                  certType: form.certType, issuedTo: form.issuedTo, issueDate: form.issueDate,
                  expiryDate: form.expiryDate || undefined, quantity: Number(form.quantity || 0),
                  notes: form.notes || undefined,
                })}>Yaratish</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(certs || []).map((c: any) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-background p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{certTypeLabel[c.cert_type] || c.cert_type}</div>
                <div className="text-sm text-muted-foreground">{c.issued_to}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {c.status === "active" ? "Faol" : "Muddati o'tgan"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {c.seedling_type && <span>🌱 {c.seedling_type}</span>}
              {c.variety_name && <span>🔬 {c.variety_name}</span>}
              <span>📦 {c.quantity} ta</span>
              <span>📅 {formatDate(c.issue_date)}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{c.certificate_number}</div>
            <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => handlePrint(c)}>
              🖨️ Chop etish
            </Button>
          </div>
        ))}
        {!(certs || []).length && <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Sertifikatlar yo'q</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ASOSIY KOMPONENT
// ─────────────────────────────────────────────
export default function AllModulesPage() {
  const { user } = useAuth();

  const tabs = [
    { value: "payments",    label: "Moliya",        icon: BadgeDollarSign },
    { value: "customers",   label: "CRM",            icon: Users2 },
    { value: "deliveries",  label: "Yetkazib berish",icon: Truck },
    { value: "agro",        label: "Agro jurnal",    icon: Leaf },
    { value: "hr",          label: "HR",             icon: UserCheck },
    { value: "telegram",    label: "Telegram Bot",   icon: BotMessageSquare },
    { value: "certs",       label: "Sertifikatlar",  icon: Medal },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ShoppingBag className="h-7 w-7 text-accent"/>
            Kengaytirilgan modullar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Barcha yangi imkoniyatlar — ko'rib chiqing, yoqqanlarini qoldiring.
          </p>
        </div>

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl bg-muted/40 p-2">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                <tab.icon className="h-4 w-4"/>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="payments"><PaymentsTab/></TabsContent>
          <TabsContent value="customers"><CustomersTab/></TabsContent>
          <TabsContent value="deliveries"><DeliveriesTab/></TabsContent>
          <TabsContent value="agro"><AgroJournalTab/></TabsContent>
          <TabsContent value="hr"><HrTab/></TabsContent>
          <TabsContent value="telegram"><TelegramTab/></TabsContent>
          <TabsContent value="certs"><CertificatesTab/></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

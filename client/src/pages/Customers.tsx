import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Edit2, Mail, Phone, Plus, Search, ShoppingCart, Trash2, Users2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatMoney(v: number) { return new Intl.NumberFormat("uz-UZ").format(v || 0); }

const emptyForm = { name: "", phone: "", phone2: "", email: "", address: "", notes: "" };

export default function CustomersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: customers } = trpc.customers.getAll.useQuery(search || undefined);

  const addMutation = trpc.customers.add.useMutation({
    onSuccess: async () => {
      toast.success(editId ? "Yangilandi" : "Mijoz qo'shildi");
      setShowForm(false); setEditId(null); setForm(emptyForm);
      await utils.customers.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: async () => {
      toast.success("Yangilandi");
      setShowForm(false); setEditId(null); setForm(emptyForm);
      await utils.customers.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = trpc.customers.remove.useMutation({
    onSuccess: async () => { toast.success("O'chirildi"); await utils.customers.getAll.invalidate(); },
  });

  const handleEdit = (c: any) => {
    setEditId(c.id);
    setForm({ name: c.name || "", phone: c.phone || "", phone2: c.phone2 || "",
      email: c.email || "", address: c.address || "", notes: c.notes || "" });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Ism majburiy"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      addMutation.mutate(form);
    }
  };

  const rows = customers || [];
  const totalCustomers = rows.length;
  const activeCustomers = rows.filter((c: any) => c.order_count > 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Users2 className="h-8 w-8 text-accent" />
            CRM — Mijozlar bazasi
          </h1>
          <p className="mt-1 text-muted-foreground">Barcha mijozlar, ularning buyurtma tarixi va statistikasi.</p>
        </div>

        {/* Stat */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Jami mijozlar", value: totalCustomers, color: "text-foreground" },
            { label: "Faol (buyurtma bor)", value: activeCustomers, color: "text-green-600" },
            { label: "Jami xaridlar", value: `${formatMoney(rows.reduce((s: number, c: any) => s + Number(c.total_spent || 0), 0))} so'm`, color: "text-accent" },
            { label: "O'rtacha xarid", value: activeCustomers ? `${formatMoney(Math.round(rows.reduce((s: number, c: any) => s + Number(c.total_spent || 0), 0) / activeCustomers))} so'm` : "—", color: "text-foreground" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="card-elegant">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Qidirish + Qo'shish */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Ism, telefon, email..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="gap-2" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(emptyForm); }}>
            <Plus className="h-4 w-4" /> Yangi mijoz
          </Button>
        </div>

        {/* Forma */}
        {showForm && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="text-base">{editId ? "Mijozni tahrirlash" : "Yangi mijoz"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 lg:col-span-1">
                  <Label>Ism *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Asosiy telefon</Label>
                  <Input placeholder="+998 90 000 00 00" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Qo'shimcha telefon</Label>
                  <Input placeholder="+998 90 000 00 00" value={form.phone2}
                    onChange={e => setForm(f => ({ ...f, phone2: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Manzil</Label>
                  <Input value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Izoh</Label>
                <Textarea rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                  Bekor qilish
                </Button>
                <Button disabled={addMutation.isPending || updateMutation.isPending} onClick={handleSave}>
                  {editId ? "Saqlash" : "Qo'shish"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mijozlar grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c: any) => (
            <div key={c.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md">
              <div className={`h-1 w-full ${c.order_count > 0 ? "bg-accent" : "bg-muted"}`} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{c.name}</div>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Mail className="h-3 w-3" /> {c.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(c)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (window.confirm(`${c.name} o'chirilsinmi?`)) removeMutation.mutate(c.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {c.address && (
                  <div className="text-xs text-muted-foreground">📍 {c.address}</div>
                )}

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/30 px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <ShoppingCart className="h-3 w-3" /> Buyurtmalar
                    </div>
                    <div className="mt-0.5 text-lg font-bold text-foreground">{c.order_count || 0}</div>
                  </div>
                  <div className="rounded-xl bg-muted/30 px-3 py-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Jami xarid</div>
                    <div className="mt-0.5 text-sm font-bold text-green-600">
                      {formatMoney(c.total_spent || 0)} so'm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!rows.length && (
          <div className="py-16 text-center">
            <Users2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">{search ? "Qidiruv bo'yicha mijoz topilmadi" : "Mijozlar bazasi bo'sh"}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

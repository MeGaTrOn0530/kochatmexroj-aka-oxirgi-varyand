import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookOpen, Droplets, FlaskConical, Plus, Scissors, Sprout, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const actionTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  watering:    { label: "Sug'orish",     icon: Droplets,     color: "text-blue-500" },
  fertilizing: { label: "O'g'itlash",    icon: Sprout,       color: "text-green-600" },
  pesticide:   { label: "Kimyoviy ishlov",icon: FlaskConical, color: "text-red-500" },
  pruning:     { label: "Qirqish",       icon: Scissors,     color: "text-amber-600" },
  transplant:  { label: "Ko'chirildi",   icon: Sprout,       color: "text-emerald-600" },
  inspection:  { label: "Tekshiruv",     icon: BookOpen,     color: "text-purple-500" },
  other:       { label: "Boshqa",        icon: BookOpen,     color: "text-muted-foreground" },
};

const emptyForm = {
  locationId: "", actionType: "watering", actionDate: "",
  quantityUsed: "", unit: "", productName: "", description: "",
};

export default function AgroJournalPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState(emptyForm);

  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: entries } = trpc.agroJournal.getAll.useQuery(
    filterType !== "all" ? { actionType: filterType } : undefined
  );

  const addMutation = trpc.agroJournal.add.useMutation({
    onSuccess: async () => {
      toast.success("Jurnal yozuvi qo'shildi");
      setShowForm(false); setForm(emptyForm);
      await utils.agroJournal.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = trpc.agroJournal.remove.useMutation({
    onSuccess: async () => { await utils.agroJournal.getAll.invalidate(); },
  });

  const rows = entries || [];
  const countByType = (t: string) => rows.filter((e: any) => e.action_type === t).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BookOpen className="h-8 w-8 text-accent" />
            Agrotexnik jurnali
          </h1>
          <p className="mt-1 text-muted-foreground">Sug'orish, o'g'itlash, kimyoviy ishlov va boshqa agrotexnik tadbirlar qaydnomasi.</p>
        </div>

        {/* Tip bo'yicha stat */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(actionTypeConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button key={key}
                onClick={() => setFilterType(filterType === key ? "all" : key)}
                className={`rounded-2xl border p-3 text-center transition-all hover:shadow-sm ${filterType === key ? "border-accent bg-accent/10" : "border-border/60 bg-background"}`}>
                <Icon className={`mx-auto mb-1 h-5 w-5 ${cfg.color}`} />
                <div className="text-xs text-muted-foreground leading-tight">{cfg.label}</div>
                <div className="mt-1 font-bold text-foreground">{countByType(key)}</div>
              </button>
            );
          })}
        </div>

        {/* Qo'shish tugmasi */}
        <div className="flex gap-3">
          <Button className="gap-2" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-4 w-4" /> Yangi yozuv
          </Button>
          {filterType !== "all" && (
            <Button variant="outline" onClick={() => setFilterType("all")}>
              Barchasini ko'rsatish
            </Button>
          )}
        </div>

        {/* Forma */}
        {showForm && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="text-base">Yangi agrotexnik yozuv</CardTitle>
              <CardDescription>Bajarilgan tadbir haqida batafsil ma'lumot kiriting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Harakat turi *</Label>
                  <Select value={form.actionType} onValueChange={v => setForm(f => ({ ...f, actionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(actionTypeConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Obyekt (lokatsiya)</Label>
                  <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      {(locations || []).map((l: any) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sana va vaqt</Label>
                  <Input type="datetime-local" value={form.actionDate}
                    onChange={e => setForm(f => ({ ...f, actionDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mahsulot / Material nomi</Label>
                  <Input placeholder="Urea, NPK, Xlorofos..." value={form.productName}
                    onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Miqdori</Label>
                  <Input type="number" value={form.quantityUsed}
                    onChange={e => setForm(f => ({ ...f, quantityUsed: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>O'lchov birligi</Label>
                  <Input placeholder="kg, litr, dona, m²..." value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tavsif / Izoh</Label>
                <Textarea rows={2} placeholder="Bajarilgan ish haqida qo'shimcha ma'lumot..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Bekor</Button>
                <Button disabled={addMutation.isPending}
                  onClick={() => addMutation.mutate({
                    locationId: form.locationId ? Number(form.locationId) : undefined,
                    actionType: form.actionType,
                    actionDate: form.actionDate || undefined,
                    quantityUsed: form.quantityUsed ? Number(form.quantityUsed) : undefined,
                    unit: form.unit || undefined,
                    productName: form.productName || undefined,
                    description: form.description || undefined,
                  })}>
                  Saqlash
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jurnal yozuvlari */}
        <div className="space-y-2">
          {rows.map((e: any) => {
            const cfg = actionTypeConfig[e.action_type] || actionTypeConfig.other;
            const Icon = cfg.icon;
            return (
              <div key={e.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 ${cfg.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{cfg.label}</span>
                      {e.location_name && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {e.location_name}
                        </span>
                      )}
                    </div>
                    {e.product_name && (
                      <div className="text-sm text-foreground">
                        {e.product_name}
                        {e.quantity_used ? <span className="text-muted-foreground"> — {e.quantity_used} {e.unit || ""}</span> : null}
                      </div>
                    )}
                    {e.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{e.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      👤 {e.performed_by_name?.trim() || "—"} · 📅 {e.action_date ? new Date(e.action_date).toLocaleString("uz-UZ") : "—"}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeMutation.mutate(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {!rows.length && (
            <div className="py-16 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Jurnal yozuvlari yo'q</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

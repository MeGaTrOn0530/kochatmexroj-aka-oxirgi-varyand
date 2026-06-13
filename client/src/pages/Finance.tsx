import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BadgeDollarSign, Plus, Trash2, TrendingUp, Wallet, CreditCard, ArrowUpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatMoney(v: number) { return new Intl.NumberFormat("uz-UZ").format(v || 0); }
function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("uz-UZ");
}

const paymentMethodLabel: Record<string, string> = {
  cash: "Naqd", card: "Karta", transfer: "Bank o'tkazmasi", other: "Boshqa",
};

export default function FinancePage() {
  const { user } = useAuth();
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

  const rows = payments || [];
  const activeOrders = (orders || []).filter((o: any) => o.status !== "cancelled");

  // --- Asosiy statistika ---
  const totalOrdersAmount = activeOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
  const totalPaid = rows.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const totalDebt = Math.max(totalOrdersAmount - totalPaid, 0);
  const cashTotal = rows.filter((p: any) => p.payment_method === "cash").reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const cardTotal = rows.filter((p: any) => p.payment_method === "card").reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  // --- Buyurtma bo'yicha to'lov holati ---
  const orderPaymentMap = new Map<number, number>();
  rows.forEach((p: any) => {
    const prev = orderPaymentMap.get(Number(p.order_id)) || 0;
    orderPaymentMap.set(Number(p.order_id), prev + Number(p.amount || 0));
  });

  const orderSummaries = activeOrders
    .filter((o: any) => Number(o.totalAmount || 0) > 0)
    .map((o: any) => {
      const paid = orderPaymentMap.get(Number(o.id)) || 0;
      const remaining = Math.max(Number(o.totalAmount || 0) - paid, 0);
      const pct = Number(o.totalAmount || 0) > 0 ? Math.min((paid / Number(o.totalAmount)) * 100, 100) : 0;
      return { ...o, paid, remaining, pct };
    })
    .sort((a: any, b: any) => b.remaining - a.remaining);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BadgeDollarSign className="h-8 w-8 text-accent" />
            Moliyaviy tizim
          </h1>
          <p className="mt-1 text-muted-foreground">Buyurtmalar bo'yicha to'lovlar va moliyaviy holat.</p>
        </div>

        {/* Asosiy statistika */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="card-elegant border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Jami buyurtmalar summasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatMoney(totalOrdersAmount)} so'm</div>
              <p className="text-xs text-muted-foreground mt-1">{activeOrders.length} ta faol buyurtma</p>
            </CardContent>
          </Card>

          <Card className="card-elegant border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowUpCircle className="h-4 w-4 text-green-500" />
                Qabul qilingan to'lovlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMoney(totalPaid)} so'm</div>
              <p className="text-xs text-muted-foreground mt-1">
                Naqd: {formatMoney(cashTotal)} | Karta: {formatMoney(cardTotal)}
              </p>
            </CardContent>
          </Card>

          <Card className="card-elegant border-l-4 border-l-red-400">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-red-400" />
                Qolgan qarzdorlik
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalDebt > 0 ? "text-red-500" : "text-green-600"}`}>
                {formatMoney(totalDebt)} so'm
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalOrdersAmount > 0
                  ? `${Math.round((totalPaid / totalOrdersAmount) * 100)}% to'langan`
                  : "Buyurtma yo'q"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Buyurtma bo'yicha to'lov holati */}
        {orderSummaries.length > 0 && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Buyurtmalar bo'yicha to'lov holati
              </CardTitle>
              <CardDescription>Har bir buyurtma uchun to'langan va qolgan summa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderSummaries.slice(0, 20).map((o: any) => (
                  <div key={o.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-foreground">{o.orderNumber}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground truncate">{o.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        {o.remaining === 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-semibold dark:bg-green-900/40 dark:text-green-400">To'liq to'langan</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-semibold dark:bg-red-900/40 dark:text-red-400">
                            Qarz: {formatMoney(o.remaining)} so'm
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${o.pct >= 100 ? "bg-green-500" : o.pct > 50 ? "bg-yellow-500" : "bg-red-400"}`}
                        style={{ width: `${o.pct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Jami summa:</span>
                        <div className="font-bold text-foreground">{formatMoney(Number(o.totalAmount))} so'm</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">To'langan:</span>
                        <div className="font-bold text-green-600">{formatMoney(o.paid)} so'm</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Qoldi:</span>
                        <div className={`font-bold ${o.remaining > 0 ? "text-red-500" : "text-green-600"}`}>
                          {formatMoney(o.remaining)} so'm
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Yangi to'lov formasi */}
        <Card className="card-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Yangi to'lov qo'shish
            </CardTitle>
            <CardDescription>Buyurtma bo'yicha to'lov qabul qilganda qayd eting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Buyurtma *</Label>
                <Select value={form.orderId} onValueChange={(v) => setForm(f => ({ ...f, orderId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {(orders || []).filter((o: any) => o.status !== "cancelled").map((o: any) => {
                      const paid = orderPaymentMap.get(Number(o.id)) || 0;
                      const rem = Math.max(Number(o.totalAmount || 0) - paid, 0);
                      return (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.orderNumber} — {o.customerName}
                          {rem > 0 ? ` (qarz: ${formatMoney(rem)})` : " ✓"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Miqdor (so'm) *</Label>
                <Input type="number" placeholder="500 000" value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To'lov usuli</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Naqd</SelectItem>
                    <SelectItem value="card">💳 Karta</SelectItem>
                    <SelectItem value="transfer">🏦 Bank o'tkazmasi</SelectItem>
                    <SelectItem value="other">Boshqa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Izoh</Label>
                <div className="flex gap-2">
                  <Input placeholder="Ixtiyoriy..." value={form.note}
                    onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
                  <Button
                    disabled={!form.orderId || !form.amount || addMutation.isPending}
                    onClick={() => addMutation.mutate({
                      orderId: Number(form.orderId), amount: Number(form.amount),
                      paymentMethod: form.paymentMethod, note: form.note || undefined,
                    })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* To'lovlar tarixi */}
        <Card className="card-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-accent" />
              To'lovlar tarixi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {["Sana", "Buyurtma №", "Mijoz", "Miqdor", "Usul", "Izoh", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(p.payment_date)}</td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold">{p.order_number}</td>
                      <td className="px-3 py-3 font-medium">{p.customer_name}</td>
                      <td className="px-3 py-3 font-bold text-green-600">{formatMoney(p.amount)} so'm</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {paymentMethodLabel[p.payment_method] || p.payment_method}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{p.note || "—"}</td>
                      <td className="px-3 py-3">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <BadgeDollarSign className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  To'lovlar qayd etilmagan
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

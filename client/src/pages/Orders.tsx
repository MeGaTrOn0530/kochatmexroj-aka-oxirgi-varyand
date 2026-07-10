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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadHtmlDocument,
  escapeHtml,
  printHtmlDocument,
  printReceiptDocument,
} from "@/lib/print-documents";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Plus, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type OrderBatch = {
  id: number;
  batchId: number;
  inventoryId: number | null;
  batchNumber: string;
  seedlingTypeName: string;
  locationId: number | null;
  healthyQuantity: number;
};

type OrderLocation = {
  id: number;
  name: string;
};

const statusLabel = {
  new: "Yangi",
  partial: "Qisman",
  fulfilled: "To'liq",
  shortage: "Yetishmaydi",
  agranom_confirmed: "Berildi (tasdiqlash kerak)",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(Number(value || 0));
}

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("uz-UZ");
}

function getDateTimeLocalValue(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function buildSafeFileName(prefix: string, value: string) {
  const normalized = String(value || "receipt")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${normalized || "receipt"}`;
}

function buildReceiptHtml(detail: any) {
  const order = detail?.order || {};
  const items = Array.isArray(detail?.items) ? detail.items : [];
  const totalQty = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

  const itemRows = items.length
    ? items.map((item: any, idx: number) => `
        <tr>
          <td>${idx + 1}. ${escapeHtml(item.batchCode || "-")}</td>
          <td class="num">${Number(item.quantity || 0)}</td>
          <td class="num">${formatMoney(item.unitPrice || 0)}</td>
          <td class="num">${formatMoney(item.totalPrice || 0)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center">—</td></tr>`;

  const statusTxt = statusLabel[order.status as keyof typeof statusLabel] || order.status || "-";

  return `
    <div class="center bold" style="font-size:13pt;letter-spacing:1px;margin-bottom:2px;">KOCHAT</div>
    <div class="center small">Ko'chat yetkazib berish xizmati</div>
    <div class="sep-solid"></div>

    <div class="row"><span class="lbl">Buyurtma №</span><span class="val bold">${escapeHtml(order.orderNumber || "-")}</span></div>
    <div class="row"><span class="lbl">Holat</span><span class="val">${escapeHtml(statusTxt)}</span></div>
    <div class="row"><span class="lbl">Sana</span><span class="val">${escapeHtml(formatDateTime(order.orderDate || order.createdAt))}</span></div>
    <div class="sep-dash"></div>

    <div class="row"><span class="lbl">Mijoz</span><span class="val">${escapeHtml(order.customerName || "-")}</span></div>
    ${order.customerPhone ? `<div class="row"><span class="lbl">Telefon</span><span class="val">${escapeHtml(order.customerPhone)}</span></div>` : ""}
    <div class="row"><span class="lbl">Lokatsiya</span><span class="val">${escapeHtml(order.locationName || "-")}</span></div>
    <div class="sep-dash"></div>

    <table>
      <thead><tr>
        <th>Partiya</th>
        <th style="text-align:right">Dona</th>
        <th style="text-align:right">Narx</th>
        <th style="text-align:right">Jami</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="sep-solid"></div>
    <div class="row"><span class="lbl">Jami dona</span><span class="val">${totalQty} ta</span></div>
    <div class="total-line"><span>JAMI SUMMA</span><span>${formatMoney(order.totalAmount || 0)} so'm</span></div>
    <div class="sep-dash"></div>

    <div class="row"><span class="lbl">Yaratgan</span><span class="val">${escapeHtml(order.createdByName || "-")}</span></div>
    ${order.soldByName ? `<div class="row"><span class="lbl">Sotgan</span><span class="val">${escapeHtml(order.soldByName)}</span></div>` : ""}
    ${order.soldAt ? `<div class="row"><span class="lbl">Sotilgan sana</span><span class="val">${escapeHtml(formatDateTime(order.soldAt))}</span></div>` : ""}
    ${order.notes ? `<div class="sep-dash"></div><div class="small">Izoh: ${escapeHtml(order.notes)}</div>` : ""}

    <div class="sep-dash"></div>
    <div class="center small">Chek: ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    <div class="center small" style="margin-top:4px;">*** RAHMAT! ***</div>
  `;
}

// Eski A4 format uchun (hisobotlarda ishlatiladi)
function buildOrderReceiptBody(detail: any) {
  const order = detail?.order || {};
  const items = Array.isArray(detail?.items) ? detail.items : [];

  const rowsHtml = items.length
    ? items.map((item: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td class="text-left">${escapeHtml(item.batchCode || "-")}</td>
          <td class="text-left">${escapeHtml(item.seedlingTypeName || "-")}</td>
          <td class="text-left">${escapeHtml(item.varietyName || "-")}</td>
          <td>${Number(item.quantity || 0)}</td>
          <td>${formatMoney(item.unitPrice || 0)}</td>
          <td>${formatMoney(item.totalPrice || 0)}</td>
        </tr>`).join("")
    : `<tr><td colspan="7">Buyurtma itemlari topilmadi.</td></tr>`;

  return `
    <section class="doc-section">
      <div class="meta-grid">
        <div class="meta-card"><div class="meta-label">Buyurtma raqami</div><div class="meta-value">${escapeHtml(order.orderNumber || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Holat</div><div class="meta-value">${escapeHtml(statusLabel[order.status as keyof typeof statusLabel] || order.status || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Mijoz</div><div class="meta-value">${escapeHtml(order.customerName || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Telefon</div><div class="meta-value">${escapeHtml(order.customerPhone || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Lokatsiya</div><div class="meta-value">${escapeHtml(order.locationName || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Buyurtma sanasi</div><div class="meta-value">${escapeHtml(formatDateTime(order.createdAt))}</div></div>
        <div class="meta-card"><div class="meta-label">Yaratgan</div><div class="meta-value">${escapeHtml(order.createdByName || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Sotgan</div><div class="meta-value">${escapeHtml(order.soldByName || "-")}</div></div>
        <div class="meta-card"><div class="meta-label">Sotilgan sana</div><div class="meta-value">${escapeHtml(formatDateTime(order.soldAt))}</div></div>
        <div class="meta-card"><div class="meta-label">Jami summa</div><div class="meta-value">${escapeHtml(formatMoney(order.totalAmount || 0))}</div></div>
      </div>
      ${order.notes ? `<div class="summary-note"><strong>Izoh:</strong> ${escapeHtml(order.notes)}</div>` : ""}
    </section>
    <section class="doc-section">
      <h2>Buyurtma tarkibi</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 52px;">№</th>
            <th class="text-left">Partiya</th>
            <th class="text-left">Ko'chat turi</th>
            <th class="text-left">Nav</th>
            <th>Miqdor</th>
            <th>Bir dona narxi</th>
            <th>Jami</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </section>
    <section class="doc-section">
      <div class="sign-grid">
        <div class="sign-card">
          <div class="sign-label">Buyurtmani yaratgan</div>
          <div class="sign-value">${escapeHtml(order.createdByName || "-")}</div>
        </div>
        <div class="sign-card">
          <div class="sign-label">Buyurtmani sotgan</div>
          <div class="sign-value">${escapeHtml(order.soldByName || "-")}</div>
        </div>
        <div class="sign-card">
          <div class="sign-label">Chek yaratilgan vaqt</div>
          <div class="sign-value">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
        </div>
      </div>
    </section>
  `;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAgranom = user?.role === "agranom";
  const isBugalter = user?.role === "bugalter";
  // Jomboy padvo (is_source=1): agranom o'z lokatsiyasida buyurtma yarata oladi (batch forma)
  const isSourceAgranom = isAgranom && Boolean(user?.locationIsSource);
  // Bugalter endi buyurtma yaratadi; agranom faqat "berdim" tasdiqlaydi (manba lokatsiyasidan tashqari)
  const canCreateOrder = ["admin", "bugalter", "bosh_agranom"].includes(user?.role || "") || isSourceAgranom;
  const canViewOrders = ["admin", "agranom", "bosh_agranom", "bugalter"].includes(user?.role || "");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGhDialogOpen, setIsGhDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
    customerPhone: "",
    batchId: "",
    quantity: "",
    unitPrice: "",
    notes: "",
    orderDate: getDateTimeLocalValue(),
    expectedDate: "",
  });
  const [ghForm, setGhForm] = useState({
    customerName: "",
    customerPhone: "",
    selectedVariety: null as null | { varietyId: number; seedlingTypeId: number; rootstockTypeId: number; varietyName: string; seedlingTypeName: string; rootstockTypeName: string; quantity: number },
    quantity: "",
    unitPrice: "",
    notes: "",
    expectedDate: "",
  });
  const [receiptLoadingOrderId, setReceiptLoadingOrderId] = useState<number | null>(null);
  const [partialFulfillOrderId, setPartialFulfillOrderId] = useState<number | null>(null);
  const [partialDeliverQty, setPartialDeliverQty] = useState("");

  const { data: batches } = trpc.seedlings.getBatches.useQuery(undefined, {
    enabled: canCreateOrder,
  });
  const { data: locations } = trpc.locations.getAll.useQuery(undefined, {
    enabled: canCreateOrder,
  });
  const { data: orders } = trpc.orders.getAll.useQuery(undefined, {
    enabled: canViewOrders,
  });
  // Bugalter ham tayyor ko'chatlarni ko'rishi uchun
  const { data: ghVarietyStock } = trpc.greenhouse.getVarietyStock.useQuery(
    user?.locationId as number,
    { enabled: (isAgranom || isBugalter) && !!user?.locationId }
  );

  const selectedBatch = useMemo(
    () =>
      ((batches || []) as OrderBatch[]).find(
        (batch) => Number(batch.inventoryId || batch.id) === Number(formData.batchId)
      ) || null,
    [batches, formData.batchId]
  );
  const locationNameById = useMemo(
    () => new Map(((locations || []) as OrderLocation[]).map((location) => [location.id, location.name])),
    [locations]
  );
  const getLocationLabel = (locationId?: number | null) =>
    locationNameById.get(locationId ?? -1) || (locationId ? String(locationId) : "-");

  const createOrderMutation = trpc.orders.createOrder.useMutation({
    onSuccess: async (data: any) => {
      const shortage = Number(data?.shortageQuantity || 0);
      if (shortage > 0) {
        const immediate = Number(data?.immediateQuantity || 0);
        toast.success(`Buyurtma yaratildi: ${immediate} ta darhol + ${shortage} ta bron`);
      } else {
        toast.success("Buyurtma yaratildi");
      }
      setFormData({
        orderNumber: "",
        customerName: "",
        customerPhone: "",
        batchId: "",
        quantity: "",
        unitPrice: "",
        notes: "",
        orderDate: getDateTimeLocalValue(),
        expectedDate: "",
      });
      setIsDialogOpen(false);
      await utils.orders.getAll.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Buyurtmani yaratib bo'lmadi");
    },
  });

  const createGhOrderMutation = trpc.orders.createGreenhouseOrder.useMutation({
    onSuccess: async (data: any) => {
      const shortage = Number(data?.shortageQuantity || 0);
      if (shortage > 0) {
        const immediate = Number(data?.immediateQuantity || 0);
        toast.success(`Buyurtma yaratildi: ${immediate} ta darhol + ${shortage} ta bron`);
      } else {
        toast.success("Buyurtma yaratildi");
      }
      setGhForm({ customerName: "", customerPhone: "", selectedVariety: null, quantity: "", unitPrice: "", notes: "", expectedDate: "" });
      setIsGhDialogOpen(false);
      await utils.orders.getAll.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Buyurtmani yaratib bo'lmadi");
    },
  });

  const partialFulfillMutation = trpc.orders.partialFulfill.useMutation({
    onSuccess: async (data: any) => {
      const remaining = Number(data?.shortageQuantity || 0);
      if (remaining > 0) {
        toast.success(`${data?.deliveredNow} ta berildi. Qoldi: ${remaining} ta bron`);
      } else {
        toast.success("Buyurtma to'liq bajarildi!");
      }
      setPartialFulfillOrderId(null);
      setPartialDeliverQty("");
      await Promise.all([
        utils.orders.getAll.invalidate(),
        utils.seedlings.getBatches.invalidate(),
        utils.locations.getAll.invalidate(),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Qisman berish bajarilmadi");
    },
  });

  const agranomConfirmMutation = trpc.orders.agranomConfirm.useMutation({
    onSuccess: async () => {
      toast.success("'Berdim' tasdiqlandi. Bosh agronom tasdiqlashi kutilmoqda.");
      await utils.orders.getAll.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Tasdiqlab bo'lmadi");
    },
  });

  const sellOrderMutation = trpc.orders.sellOrder.useMutation({
    onSuccess: async () => {
      toast.success("Buyurtma sotilgan deb tasdiqlandi");
      await Promise.all([
        utils.orders.getAll.invalidate(),
        utils.seedlings.getBatches.invalidate(),
        utils.locations.getAll.invalidate(),
        utils.reports.getOverview.invalidate(),
        utils.reports.getGeneral.invalidate(),
        utils.reports.getDetailed.invalidate(),
        utils.reports.getMovements.invalidate(),
        utils.dashboard.getStats.invalidate(),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Buyurtmani sotilgan deb belgilab bo'lmadi");
    },
  });
  const orderDetailMutation = trpc.orders.getDetail.useMutation();

  const deleteOrderMutation = trpc.orders.deleteOrder.useMutation({
    onSuccess: async () => {
      toast.success("Buyurtma o'chirildi");
      await utils.orders.getAll.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || "O'chirib bo'lmadi");
    },
  });

  const handleCreateOrder = () => {
    if (!canCreateOrder) {
      toast.error("Buyurtma yaratish uchun ruxsat yo'q.");
      return;
    }

    if (!formData.orderNumber || !formData.customerName || !formData.batchId || !formData.quantity) {
      toast.error("Buyurtma raqami, mijoz, partiya va miqdor majburiy");
      return;
    }

    if (!selectedBatch) {
      toast.error("Amaldagi inventardan partiya tanlang");
      return;
    }

    if (!selectedBatch.locationId) {
      toast.error("Tanlangan partiyaning lokatsiyasi topilmadi");
      return;
    }

    // Bron miqdori hisoblash (warning emas, davom etadi)
    const orderedQty = Number(formData.quantity);
    const availableQty = Number(selectedBatch.healthyQuantity || 0);
    const bronQty = Math.max(0, orderedQty - availableQty);

    if (bronQty > 0 && !formData.expectedDate) {
      const confirmed = window.confirm(
        `${bronQty} ta ko'chat bron bo'ladi (hozir faqat ${availableQty} ta mavjud). Davom etasizmi?`
      );
      if (!confirmed) return;
    }

    createOrderMutation.mutate({
      orderNumber: formData.orderNumber.trim(),
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim() || undefined,
      batchId: Number(selectedBatch.batchId || selectedBatch.id),
      locationId: Number(selectedBatch.locationId),
      quantity: orderedQty,
      unitPrice: Number(formData.unitPrice || 0),
      notes: formData.notes.trim() || undefined,
      orderDate: formData.orderDate ? new Date(formData.orderDate) : new Date(),
      expectedDate: formData.expectedDate || undefined,
    } as any);
  };

  // Agranom "Berdim" tugmasi: new yoki partial statusda, o'z lokatsiyasi
  const canAgranomConfirm = (order: any) =>
    ["new", "partial"].includes(order.status) &&
    (user?.role === "admin" ||
      (user?.role === "agranom" && Number(user.locationId) === Number(order.locationId)));

  // Bosh agronom / admin yakunlash (miqdor kamayadi)
  const canSellOrder = (order: any) =>
    ["new", "partial", "shortage", "agranom_confirmed"].includes(order.status) &&
    (user?.role === "admin" || user?.role === "bosh_agranom" ||
      (user?.role === "agranom" && Number(user.locationId) === Number(order.locationId) && order.status !== "agranom_confirmed"));

  const handleOrderReceipt = (orderId: number, action: "print" | "download") => {
    setReceiptLoadingOrderId(orderId);
    orderDetailMutation.mutate(orderId, {
      onSuccess: (detail: any) => {
        const order = detail?.order || {};

        if (action === "print") {
          printReceiptDocument(
            buildReceiptHtml(detail),
            `Buyurtma cheki №${order.orderNumber || orderId}`
          );
          return;
        }

        // Download — A4 formatida
        downloadHtmlDocument({
          title: `Buyurtma cheki №${order.orderNumber || orderId}`,
          subtitle: `Mijoz buyurtmasi bo'yicha chek · ${formatDateTime(order.createdAt)}`,
          bodyHtml: buildOrderReceiptBody(detail),
          fileName: buildSafeFileName("buyurtma-chek", order.orderNumber || String(orderId)),
        });
      },
      onError: (error: Error) => {
        toast.error(error.message || "Buyurtma cheki tayyorlanmadi");
      },
      onSettled: () => {
        setReceiptLoadingOrderId(null);
      },
    });
  };

  if (!canViewOrders) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat Rad Etildi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Buyurtmalar bo'limi sizning rol uchun ochilmagan.
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
              <FileText className="h-8 w-8 text-accent" />
              Buyurtmalar
            </h1>
            <p className="mt-1 text-muted-foreground">
              Mijoz buyurtmalarini yarating, narx va miqdor bilan kuzating.
            </p>
          </div>

          {canCreateOrder ? (
            isAgranom && !isSourceAgranom ? (
              <Dialog open={isGhDialogOpen} onOpenChange={setIsGhDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary gap-2">
                    <Plus className="h-4 w-4" />
                    Yangi buyurtma
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Teplitsa buyurtmasi</DialogTitle>
                    <DialogDescription>
                      Tayyor bosqichdagi navlardan buyurtma yarating.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    {/* Tayyor navlar */}
                    {(() => {
                      const readyVars = (ghVarietyStock || []).filter((r: any) => r.stage === "ready" && r.quantity > 0);
                      if (!readyVars.length) return (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                          Tayyor bosqichda ko'chat mavjud emas
                        </div>
                      );
                      return (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-emerald-700">Tayyor bosqichdagi navlar (tanlash uchun bosing):</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {readyVars.map((r: any, i: number) => {
                              const isSel = ghForm.selectedVariety &&
                                ghForm.selectedVariety.varietyId === r.varietyId &&
                                ghForm.selectedVariety.seedlingTypeId === r.seedlingTypeId &&
                                ghForm.selectedVariety.rootstockTypeId === r.rootstockTypeId;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs border transition-colors ${isSel ? "border-emerald-400 bg-emerald-50" : "border-border/60 bg-background hover:bg-emerald-50"}`}
                                  onClick={() => setGhForm(f => ({
                                    ...f,
                                    selectedVariety: {
                                      varietyId: r.varietyId,
                                      seedlingTypeId: r.seedlingTypeId,
                                      rootstockTypeId: r.rootstockTypeId,
                                      varietyName: r.varietyName || "Aniqlanmagan",
                                      seedlingTypeName: r.seedlingTypeName || "",
                                      rootstockTypeName: r.rootstockTypeName || "",
                                      quantity: r.quantity,
                                    }
                                  }))}
                                >
                                  <span className="font-medium">
                                    {r.varietyName || "Aniqlanmagan"}
                                    {r.seedlingTypeName ? ` · ${r.seedlingTypeName}` : ""}
                                    {r.rootstockTypeName ? ` / ${r.rootstockTypeName}` : ""}
                                  </span>
                                  <span className="font-bold text-emerald-700">{new Intl.NumberFormat("uz-UZ").format(r.quantity)} ta tayyor</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mijoz */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mijoz nomi *</Label>
                        <Input
                          placeholder="Agro Mijoz"
                          value={ghForm.customerName}
                          onChange={e => setGhForm(f => ({ ...f, customerName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Telefon</Label>
                        <Input
                          placeholder="+998 90 000 00 00"
                          value={ghForm.customerPhone}
                          onChange={e => setGhForm(f => ({ ...f, customerPhone: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Miqdor va narx */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Miqdori *</Label>
                        <Input
                          type="number"
                          placeholder="100"
                          value={ghForm.quantity}
                          onChange={e => setGhForm(f => ({ ...f, quantity: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Narx (1 dona)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={ghForm.unitPrice}
                          onChange={e => setGhForm(f => ({ ...f, unitPrice: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Bron hisob-kitobi */}
                    {ghForm.selectedVariety && ghForm.quantity && (() => {
                      const qty = Number(ghForm.quantity);
                      const avail = ghForm.selectedVariety.quantity;
                      const bron = Math.max(0, qty - avail);
                      if (qty <= 0) return null;
                      return (
                        <div className={`rounded-xl border p-3 text-xs space-y-1 ${bron > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                          <div className="font-semibold text-sm mb-1">{bron > 0 ? "⚠️ Bron tizimi ishga tushadi" : "✓ To'liq mavjud"}</div>
                          <div className="flex gap-6">
                            <span className="text-emerald-700">✓ Darhol: <strong>{Math.min(avail, qty)} ta</strong></span>
                            {bron > 0 && <span className="text-amber-700">⏳ Bron: <strong>{bron} ta</strong></span>}
                          </div>
                          {bron > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <Label className="text-xs">Taxminiy tayyor bo'lish sanasi</Label>
                              <Input
                                type="date"
                                value={ghForm.expectedDate}
                                onChange={e => setGhForm(f => ({ ...f, expectedDate: e.target.value }))}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Izoh</Label>
                      <Input
                        placeholder="Qo'shimcha ma'lumot..."
                        value={ghForm.notes}
                        onChange={e => setGhForm(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-3">
                      <Button variant="outline" onClick={() => setIsGhDialogOpen(false)}>Bekor qilish</Button>
                      <Button
                        disabled={createGhOrderMutation.isPending || !ghForm.customerName || !ghForm.quantity || !ghForm.selectedVariety}
                        onClick={() => {
                          if (!user?.locationId || !ghForm.selectedVariety) return;
                          createGhOrderMutation.mutate({
                            locationId: user.locationId,
                            customerName: ghForm.customerName,
                            customerPhone: ghForm.customerPhone || undefined,
                            varietyId: ghForm.selectedVariety.varietyId || undefined,
                            seedlingTypeId: ghForm.selectedVariety.seedlingTypeId || undefined,
                            rootstockTypeId: ghForm.selectedVariety.rootstockTypeId || undefined,
                            quantity: Number(ghForm.quantity),
                            unitPrice: Number(ghForm.unitPrice || 0),
                            notes: ghForm.notes || undefined,
                            expectedDate: ghForm.expectedDate || undefined,
                          });
                        }}
                      >
                        {createGhOrderMutation.isPending ? "Saqlanmoqda..." : "Buyurtmani saqlash"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Yangi buyurtma
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Yangi buyurtma</DialogTitle>
                  <DialogDescription>
                    Partiya tanlab, mijoz va miqdor bilan buyurtma yarating.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Partiya tanlash — kartochkalar */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-700">Ko'chat partiyalari (tanlash uchun bosing):</p>
                    {!(batches as OrderBatch[] | undefined)?.length ? (
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                        Mavjud partiyalar topilmadi
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                        {(batches as OrderBatch[] | undefined)?.map((batch) => {
                          const bId = (batch.inventoryId || batch.id).toString();
                          const isSel = formData.batchId === bId;
                          return (
                            <button
                              key={`${batch.batchId || batch.id}-${batch.inventoryId || "i"}`}
                              type="button"
                              className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs border transition-colors ${
                                isSel
                                  ? "border-emerald-400 bg-emerald-50"
                                  : "border-border/60 bg-background hover:bg-emerald-50/50"
                              }`}
                              onClick={() => setFormData((f) => ({ ...f, batchId: bId }))}
                            >
                              <div className="text-left min-w-0">
                                <div className="font-mono font-bold text-foreground">{batch.batchNumber}</div>
                                <div className="text-muted-foreground mt-0.5 truncate">
                                  {batch.seedlingTypeName}
                                  {batch.varietyName && batch.varietyName !== "Aniqlanmagan nav" ? ` · ${batch.varietyName}` : ""}
                                  {" · "}{getLocationLabel(batch.locationId)}
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <div className="font-semibold text-green-600">
                                  {new Intl.NumberFormat("uz-UZ").format(Number(batch.healthyQuantity || 0))} ta
                                </div>
                                <div className="text-[10px] text-muted-foreground">mavjud</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Mijoz */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mijoz nomi *</Label>
                      <Input
                        placeholder="Agro Mijoz"
                        value={formData.customerName}
                        onChange={(e) => setFormData((f) => ({ ...f, customerName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefon</Label>
                      <Input
                        placeholder="+998 90 000 00 00"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData((f) => ({ ...f, customerPhone: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Miqdor va narx */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Miqdori *</Label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={formData.quantity}
                        onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bir dona narxi</Label>
                      <Input
                        type="number"
                        placeholder="15000"
                        value={formData.unitPrice}
                        onChange={(e) => setFormData((f) => ({ ...f, unitPrice: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Bron hisob-kitobi */}
                  {selectedBatch && formData.quantity && (() => {
                    const qty = Number(formData.quantity);
                    const avail = Number(selectedBatch.healthyQuantity || 0);
                    const bron = Math.max(0, qty - avail);
                    if (qty <= 0) return null;
                    return (
                      <div className={`rounded-xl border p-3 text-xs space-y-1 ${bron > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                        <div className="font-semibold text-sm mb-1">{bron > 0 ? "⚠️ Bron tizimi ishga tushadi" : "✓ To'liq mavjud"}</div>
                        <div className="flex gap-6">
                          <span className="text-emerald-700">✓ Darhol: <strong>{Math.min(avail, qty)} ta</strong></span>
                          {bron > 0 && <span className="text-amber-700">⏳ Bron: <strong>{bron} ta</strong></span>}
                        </div>
                        {bron > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <Label className="text-xs">Taxminiy tayyor bo'lish sanasi</Label>
                            <Input
                              type="date"
                              value={formData.expectedDate}
                              onChange={(e) => setFormData((f) => ({ ...f, expectedDate: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Qo'shimcha */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Buyurtma raqami</Label>
                      <Input
                        placeholder="BUY-2026-001"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData((f) => ({ ...f, orderNumber: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Buyurtma vaqti</Label>
                      <Input
                        type="datetime-local"
                        value={formData.orderDate}
                        onChange={(e) => setFormData((f) => ({ ...f, orderDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Izoh</Label>
                    <Textarea
                      placeholder="Buyurtma haqida eslatma yoki kelishuv..."
                      value={formData.notes}
                      onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t pt-3">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Bekor qilish</Button>
                    <Button
                      disabled={createOrderMutation.isPending || !formData.customerName || !formData.quantity || !formData.batchId}
                      onClick={handleCreateOrder}
                    >
                      {createOrderMutation.isPending ? "Saqlanmoqda..." : "Buyurtmani saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )
          ) : (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Buyurtmalar bu sahifada ko'rinadi. Yangi buyurtma yaratish faqat admin uchun ochiq.
            </div>
          )}
        </div>

        {/* Qisman berish dialogi */}
        {partialFulfillOrderId !== null && (() => {
          const order = (orders || []).find((o: any) => o.id === partialFulfillOrderId);
          if (!order) return null;
          const maxQty = Number(order.shortageQuantity || 0);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setPartialFulfillOrderId(null); setPartialDeliverQty(""); } }}
            >
              <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-foreground">Qisman berish</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buyurtma: <strong>{order.orderNumber}</strong> · {order.customerName}
                </p>
                <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bron qoldiq:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{maxQty} ta</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Allaqachon berilgan:</span>
                    <span className="font-semibold text-green-600">{order.fulfilledQuantity || 0} ta</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Hozir necha ta berasiz? (maks: {maxQty})</Label>
                  <Input
                    type="number"
                    min={1}
                    max={maxQty}
                    placeholder={`1 – ${maxQty}`}
                    value={partialDeliverQty}
                    onChange={(e) => setPartialDeliverQty(e.target.value)}
                    autoFocus
                  />
                  {Number(partialDeliverQty) > 0 && Number(partialDeliverQty) <= maxQty && (
                    <p className="text-xs text-muted-foreground">
                      Berganidan so'ng qoladi:{" "}
                      <strong className={maxQty - Number(partialDeliverQty) === 0 ? "text-green-600" : "text-amber-600"}>
                        {maxQty - Number(partialDeliverQty)} ta bron
                      </strong>
                      {maxQty - Number(partialDeliverQty) === 0 && " — buyurtma to'liq bajariladi!"}
                    </p>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setPartialFulfillOrderId(null); setPartialDeliverQty(""); }}>
                    Bekor qilish
                  </Button>
                  <Button
                    disabled={
                      partialFulfillMutation.isPending ||
                      !partialDeliverQty ||
                      Number(partialDeliverQty) < 1 ||
                      Number(partialDeliverQty) > maxQty
                    }
                    onClick={() => {
                      partialFulfillMutation.mutate({
                        orderId: partialFulfillOrderId,
                        deliverQuantity: Number(partialDeliverQty),
                      });
                    }}
                  >
                    {partialFulfillMutation.isPending ? "Saqlanmoqda..." : `${partialDeliverQty || 0} ta berish`}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        <Card className="card-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-accent" />
              Buyurtmalar ro'yxati
            </CardTitle>
            <CardDescription>
              Yaratilgan buyurtmalar, mijoz va summa bo'yicha ko'rinish.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!orders?.length ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Buyurtmalar topilmadi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm"
                  >
                    {/* Top strip */}
                    <div className={`-mx-4 -mt-4 mb-3 h-1 rounded-t-2xl ${
                      order.status === "completed" ? "bg-green-400" :
                      order.status === "partial" ? "bg-amber-400" :
                      order.status === "cancelled" ? "bg-red-300" : "bg-blue-400"
                    }`} />
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-base font-bold text-foreground">{order.orderNumber}</p>
                        <p className="text-sm font-medium text-muted-foreground">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-muted-foreground">{order.customerPhone}</p>}
                        {order.batchCodes && <p className="text-xs text-muted-foreground">Partiya: {order.batchCodes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          order.status === "completed" ? "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-400" :
                          order.status === "partial" ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-400" :
                          order.status === "cancelled" ? "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-400" :
                          "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
                        }`}>
                          {order.status === "partial"
                            ? `Qisman · ${order.shortageQuantity || 0} ta bron`
                            : (statusLabel[order.status as keyof typeof statusLabel] || order.status)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                          {order.totalQuantity} ta
                        </span>
                      </div>
                    </div>
                    {/* Bron progress bar */}
                    {order.status === "partial" && Number(order.totalQuantity) > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${Math.round((Number(order.fulfilledQuantity || 0) / Number(order.totalQuantity)) * 100)}%` }}
                          />
                          <div
                            className="bg-amber-400 transition-all"
                            style={{ width: `${Math.round((Number(order.shortageQuantity || 0) / Number(order.totalQuantity)) * 100)}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="text-green-600">✓ Berildi: {order.fulfilledQuantity || 0} ta</span>
                          <span className="text-amber-600">⏳ Bron: {order.shortageQuantity || 0} ta</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-xl bg-muted/30 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Lokatsiya</div>
                        <div className="mt-1 font-medium text-foreground">{order.locationName}</div>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Jami summa</div>
                        <div className="mt-1 font-medium text-foreground">{formatMoney(order.totalAmount)}</div>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Sana</div>
                        <div className="mt-1 font-medium text-foreground">
                          {formatDateTime(order.createdAt)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Amalni bajarganlar</div>
                        <div className="mt-1 space-y-1 text-sm">
                          <div className="font-medium text-foreground">
                            Yaratgan: {order.createdByName || "-"}
                          </div>
                          <div className="font-medium text-foreground">
                            Sotgan: {order.soldByName || "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Sotilgan sana:{" "}
                        <span className="font-medium text-foreground">{formatDateTime(order.soldAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleOrderReceipt(order.id, "download")}
                          disabled={receiptLoadingOrderId === order.id}
                        >
                          <Download className="h-4 w-4" />
                          {receiptLoadingOrderId === order.id ? "Tayyorlanmoqda..." : "Chekni yuklash"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleOrderReceipt(order.id, "print")}
                          disabled={receiptLoadingOrderId === order.id}
                        >
                          <Printer className="h-4 w-4" />
                          {receiptLoadingOrderId === order.id ? "Tayyorlanmoqda..." : "Chekni chiqarish"}
                        </Button>
                        {order.status === "partial" && (user?.role === "admin" || user?.role === "agranom") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                            onClick={() => {
                              setPartialFulfillOrderId(order.id);
                              setPartialDeliverQty("");
                            }}
                          >
                            <span>⏳</span>
                            Qisman berish ({order.shortageQuantity} ta bron)
                          </Button>
                        )}
                        {/* Agranom: "Berdim" tugmasi */}
                        {canAgranomConfirm(order) && user?.role === "agranom" && order.status !== "partial" && (
                          <Button
                            variant="outline"
                            className="border-blue-400 text-blue-700 hover:bg-blue-50"
                            onClick={() => agranomConfirmMutation.mutate(order.id)}
                            disabled={agranomConfirmMutation.isPending}
                          >
                            {agranomConfirmMutation.isPending ? "Tasdiqlanmoqda..." : "✓ Berdim"}
                          </Button>
                        )}
                        {/* Bosh agronom / Admin: yakunlash (miqdor kamayadi) */}
                        {canSellOrder(order) && order.status !== "partial" && user?.role !== "agranom" && (
                          <Button
                            onClick={() => sellOrderMutation.mutate({ orderId: order.id })}
                            disabled={sellOrderMutation.isPending}
                          >
                            {sellOrderMutation.isPending ? "Tasdiqlanmoqda..." :
                              order.status === "agranom_confirmed" ? "Tasdiqlash (miqdor kamayadi)" : "Sotilgan deb tasdiqlash"}
                          </Button>
                        )}
                        {user?.role === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            disabled={deleteOrderMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`"${order.orderNumber}" buyurtmasini o'chirishni tasdiqlaysizmi?`)) {
                                deleteOrderMutation.mutate(order.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            O'chirish
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

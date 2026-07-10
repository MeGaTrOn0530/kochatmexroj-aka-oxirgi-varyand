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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  downloadHtmlDocument,
  escapeHtml,
  printHtmlDocument,
} from "@/lib/print-documents";
import { ArrowRight, CheckCircle2, Download, Plus, Printer, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const roleText = {
  admin: "Ichki almashinuvlar va transferlar umumiy nazorati",
  bosh_agranom: "Tasdiqlash va nazorat uchun transferlar ro'yxati",
  agranom: "Qabul va yuborish jarayonlari bo'yicha ko'rinish",
  bugalter: "Transfer, qaytarish va operatsion yozuvlarni boshqarish",
} as const;

const workflowStatusLabel = {
  pending_sender: "Jo'natuvchi tasdig'i kutilmoqda",
  pending_receiver: "Qabul qiluvchi tasdig'i kutilmoqda",
  pending_head: "Bosh agronom tasdig'i kutilmoqda",
  completed: "Yakunlandi",
  rejected: "Rad etildi",
} as const;

const transferTypeLabel = {
  movement: "Harakatlanish",
  exchange: "Almashinuv",
  return: "Qaytarish",
} as const;

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("uz-UZ");
}

function buildSafeFileName(prefix: string, value: string) {
  const normalized = String(value || "receipt")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${normalized || "receipt"}`;
}

function buildTransferReceiptBody(transfer: any) {
  const timeline = [
    {
      title: "Transfer yaratildi",
      actor: transfer.createdByName || "-",
      at: formatDateTime(transfer.transferDate || transfer.createdAt),
    },
    {
      title: "Jo'natuvchi tasdig'i",
      actor: transfer.senderConfirmedByName || "-",
      at: formatDateTime(transfer.senderConfirmedAt),
    },
    {
      title: "Bosh agronom tasdig'i",
      actor: transfer.headConfirmedByName || "-",
      at: formatDateTime(transfer.headConfirmedAt),
    },
    {
      title: "Qabul qiluvchi tasdig'i",
      actor: transfer.receiverConfirmedByName || "-",
      at: formatDateTime(transfer.receiverConfirmedAt),
    },
  ];

  return `
    <section class="doc-section">
      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Transfer kodi</div>
          <div class="meta-value">${escapeHtml(transfer.transferCode || `TRF-${transfer.id}`)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Holat</div>
          <div class="meta-value">${escapeHtml(
            workflowStatusLabel[transfer.workflowStatus as keyof typeof workflowStatusLabel] ||
              transfer.workflowStatus ||
              "-"
          )}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Partiya</div>
          <div class="meta-value">${escapeHtml(transfer.batchCode || `#${transfer.batchId}`)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Ko'chat turi / nav</div>
          <div class="meta-value">${escapeHtml(
            `${transfer.seedlingTypeName || "-"} / ${transfer.varietyName || "-"}`
          )}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Jo'natish joyi</div>
          <div class="meta-value">${escapeHtml(transfer.fromLocationName || "-")}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Qabul joyi</div>
          <div class="meta-value">${escapeHtml(transfer.toLocationName || "-")}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Transfer turi</div>
          <div class="meta-value">${escapeHtml(
            transferTypeLabel[transfer.transferType as keyof typeof transferTypeLabel] ||
              transfer.transferType ||
              "-"
          )}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Miqdori</div>
          <div class="meta-value">${escapeHtml(`${Number(transfer.quantity || 0)} ta`)}</div>
        </div>
      </div>
      ${
        transfer.note
          ? `
            <div class="summary-note">
              <strong>Izoh:</strong> ${escapeHtml(transfer.note)}
            </div>
          `
          : ""
      }
    </section>
    <section class="doc-section">
      <h2>Tasdiqlar tarixi</h2>
      <ul class="timeline">
        ${timeline
          .map(
            (item) => `
              <li>
                <div class="timeline-title">${escapeHtml(item.title)}</div>
                <div class="timeline-meta">Bajargan: ${escapeHtml(item.actor)}</div>
                <div class="timeline-meta">Vaqti: ${escapeHtml(item.at)}</div>
              </li>
            `
          )
          .join("")}
      </ul>
    </section>
    <section class="doc-section">
      <div class="sign-grid">
        <div class="sign-card">
          <div class="sign-label">Yaratgan</div>
          <div class="sign-value">${escapeHtml(transfer.createdByName || "-")}</div>
        </div>
        <div class="sign-card">
          <div class="sign-label">Qabul yakuni</div>
          <div class="sign-value">${escapeHtml(transfer.receiverConfirmedByName || "-")}</div>
        </div>
        <div class="sign-card">
          <div class="sign-label">Chek yaratilgan vaqt</div>
          <div class="sign-value">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
        </div>
      </div>
    </section>
  `;
}

const STAGES = ["cassette", "grafting", "grafted", "ready"] as const;
const STAGE_LABELS: Record<string, string> = {
  cassette: "Kasetada",
  grafting: "Payvantlanmagan",
  grafted: "Payvantlangan",
  ready: "Tayyor",
};
const STAGE_COLORS: Record<string, string> = {
  cassette: "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
  grafting: "border-blue-300 bg-blue-50 dark:bg-blue-900/20",
  grafted: "border-green-300 bg-green-50 dark:bg-green-900/20",
  ready: "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20",
};

function formatN(n: number) {
  return n.toLocaleString("uz-UZ");
}

export default function TransfersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rejectTransferId, setRejectTransferId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const agranomFromLocationId = user?.role === "agranom" && user?.locationId
    ? String(user.locationId)
    : "";
  const [formData, setFormData] = useState({
    batchId: "",
    fromLocationId: "",
    toLocationId: "",
    quantity: "",
    transferType: "movement",
    note: "",
    // greenhouse bosqich transfer uchun qo'shimcha maydonlar
    fromStage: "",
    fromRootstockTypeId: "",
    fromVarietyId: "",
    toStage: "cassette",
    actionDate: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (agranomFromLocationId) {
      setFormData((current) => ({ ...current, fromLocationId: agranomFromLocationId, batchId: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agranomFromLocationId]);

  const { data: transfers } = trpc.transfers.getAll.useQuery();
  const { data: ghTransfers } = trpc.greenhouse.getGreenhouseTransfers.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const { data: locations } = trpc.locations.getAllDestinations.useQuery();

  // Tanlangan manba lokatsiyaning turi
  const fromLocation = (locations || []).find((l) => String(l.id) === formData.fromLocationId);
  // is_source=1 (Жомбой kabi dona chiqaruvchi joy) → batch flow; oddiy teplitsa → stage flow
  const isGreenhouseSource = fromLocation?.type === "greenhouse" && !fromLocation?.isSource;

  // Greenhouse manbasi tanlanganda uning stok va nav ma'lumotlarini yuklash
  const ghSourceId = isGreenhouseSource && formData.fromLocationId ? Number(formData.fromLocationId) : 0;
  const { data: ghSourceStatus } = trpc.greenhouse.getOne.useQuery(ghSourceId, { enabled: ghSourceId > 0 });
  const { data: ghSourceVariety } = trpc.greenhouse.getVarietyStock.useQuery(ghSourceId, { enabled: ghSourceId > 0 });
  const ghStock = ghSourceStatus?.stock;

  const invalidateTransfers = async () => {
    await utils.transfers.getAll.invalidate();
  };

  const resetForm = () => setFormData({
    batchId: "",
    fromLocationId: agranomFromLocationId,
    toLocationId: "",
    quantity: "",
    transferType: "movement",
    note: "",
    fromStage: "",
    fromRootstockTypeId: "",
    fromVarietyId: "",
    toStage: "cassette",
    actionDate: new Date().toISOString().slice(0, 10),
  });

  const createTransferMutation = trpc.transfers.createTransfer.useMutation({
    onSuccess: async () => {
      toast.success("Transfer yaratildi");
      resetForm();
      setIsDialogOpen(false);
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Xato yuz berdi");
    },
  });

  const stageTransferMutation = trpc.greenhouse.stageTransfer.useMutation({
    onSuccess: async () => {
      toast.success("Transfer yaratildi. Bosh agronom tasdig'i kutilmoqda.");
      resetForm();
      setIsDialogOpen(false);
      await utils.greenhouse.transfers.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Xato yuz berdi");
    },
  });

  const confirmGHHeadMutation = trpc.greenhouse.confirmGHTransferHead.useMutation({
    onSuccess: async () => {
      toast.success("Bosh agronom tasdig'i saqlandi");
      await utils.greenhouse.transfers.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Xato yuz berdi");
    },
  });

  const confirmGHReceiverMutation = trpc.greenhouse.confirmGHTransferReceiver.useMutation({
    onSuccess: async () => {
      toast.success("Qabul tasdig'i saqlandi");
      await utils.greenhouse.transfers.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Xato yuz berdi");
    },
  });

  const confirmSenderMutation = trpc.transfers.confirmSender.useMutation({
    onSuccess: async () => {
      toast.success("Jo'natish tasdiqlandi");
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Jo'natishni tasdiqlab bo'lmadi");
    },
  });

  const confirmHeadMutation = trpc.transfers.confirmHead.useMutation({
    onSuccess: async () => {
      toast.success("Bosh agronom tasdig'i saqlandi");
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Tasdiqlab bo'lmadi");
    },
  });

  const confirmReceiverMutation = trpc.transfers.confirmReceiver.useMutation({
    onSuccess: async () => {
      toast.success("Qabul tasdiqlandi. Bosh agronom tasdig'i kutilmoqda.");
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Qabulni tasdiqlab bo'lmadi");
    },
  });

  const rejectTransferMutation = trpc.transfers.rejectTransfer.useMutation({
    onSuccess: async () => {
      toast.success("Transfer rad etildi");
      setRejectTransferId(null);
      setRejectReason("");
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Rad etib bo'lmadi");
    },
  });

  const batchMap = useMemo(
    () =>
      new Map<number, string>(
        ((batches || []) as Array<any>).map((batch) => [
          Number(batch.batchId || batch.id),
          String(batch.batchNumber || `Partiya #${batch.batchId || batch.id}`),
        ])
      ),
    [batches]
  );
  const locationMap = useMemo(
    () =>
      new Map<number, string>(
        ((locations || []) as Array<any>).map((location) => [Number(location.id), String(location.name || "")])
      ),
    [locations]
  );

  const visibleTransfers = useMemo(() => {
    if (!transfers) {
      return [];
    }

    if (user?.role === "agranom") {
      return transfers.filter(
        (transfer) =>
          transfer.fromLocationId === user.locationId ||
          transfer.toLocationId === user.locationId
      );
    }

    return transfers;
  }, [transfers, user?.locationId, user?.role]);

  const availableTransferBatches = useMemo(() => {
    if (!batches) {
      return [];
    }

    if (!formData.fromLocationId) {
      return batches;
    }

    return batches.filter((batch) => Number(batch.locationId) === Number(formData.fromLocationId));
  }, [batches, formData.fromLocationId]);

  const selectedBatch = useMemo(
    () =>
      (batches || []).find((batch) => Number(batch.inventoryId || batch.id) === Number(formData.batchId)) || null,
    [batches, formData.batchId]
  );

  useEffect(() => {
    if (!selectedBatch || formData.fromLocationId) {
      return;
    }

    setFormData((current) => ({
      ...current,
      fromLocationId: current.fromLocationId || String(selectedBatch.locationId || ""),
    }));
  }, [formData.fromLocationId, selectedBatch]);

  useEffect(() => {
    if (!selectedBatch || !formData.fromLocationId) {
      return;
    }

    if (Number(selectedBatch.locationId) !== Number(formData.fromLocationId)) {
      setFormData((current) => ({
        ...current,
        batchId: "",
      }));
    }
  }, [formData.fromLocationId, selectedBatch]);

  const handleCreateTransfer = () => {
    if (!formData.fromLocationId || !formData.toLocationId || !formData.quantity) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    if (formData.fromLocationId === formData.toLocationId) {
      toast.error("Jo'natish va qabul lokatsiyasi bir xil bo'lmasligi kerak");
      return;
    }

    // Greenhouse bosqich transferi
    if (isGreenhouseSource) {
      if (!formData.fromStage) {
        toast.error("Qaysi bosqichdan o'tkazishni tanlang");
        return;
      }
      stageTransferMutation.mutate({
        locationId: Number(formData.fromLocationId),
        toLocationId: Number(formData.toLocationId),
        fromStage: formData.fromStage,
        toStage: formData.toStage || formData.fromStage,
        quantity: Number(formData.quantity),
        fromRootstockTypeId: formData.fromRootstockTypeId && formData.fromRootstockTypeId !== "0"
          ? Number(formData.fromRootstockTypeId)
          : undefined,
        notes: formData.note.trim() || undefined,
        actionDate: formData.actionDate || undefined,
      });
      return;
    }

    // Jomboya/boshqa batch transferi
    if (!formData.batchId) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    if (selectedBatch && Number(formData.quantity) > Number(selectedBatch.quantityAvailable || 0)) {
      toast.error(`Mavjud qoldiq yetarli emas. Mavjud: ${selectedBatch.quantityAvailable ?? 0} ta`);
      return;
    }
    createTransferMutation.mutate({
      batchId: Number(selectedBatch?.batchId || selectedBatch?.id),
      fromLocationId: Number(formData.fromLocationId),
      toLocationId: Number(formData.toLocationId),
      quantity: Number(formData.quantity),
      transferDate: new Date(),
      transferType: formData.transferType as "exchange" | "movement" | "return",
      note: formData.note.trim() || undefined,
    });
  };

  const canCreateTransfer = ["bugalter", "admin", "agranom"].includes(user?.role || "");
  const currentRole = (user?.role || "agranom") as keyof typeof roleText;

  const handleTransferReceipt = (transfer: any, action: "print" | "download") => {
    const payload = {
      title: `Transfer cheki ${transfer.transferCode || `№${transfer.id}`}`,
      subtitle: `To'liq yakunlangan transfer bo'yicha chek · ${formatDateTime(
        transfer.receiverConfirmedAt || transfer.transferDate
      )}`,
      bodyHtml: buildTransferReceiptBody(transfer),
      fileName: buildSafeFileName("transfer-chek", transfer.transferCode || String(transfer.id)),
    };

    if (action === "download") {
      downloadHtmlDocument(payload);
      return;
    }

    printHtmlDocument(payload);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
              <TrendingUp className="h-8 w-8 text-accent" />
              Ko'chat transferlari
            </h1>
            <p className="mt-1 text-muted-foreground">{roleText[currentRole]}</p>
          </div>
          {canCreateTransfer && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Yangi transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Yangi Ko'chat Transferi</DialogTitle>
                  <DialogDescription>
                    {isGreenhouseSource
                      ? "Teplitsadan bosqich bo'yicha boshqa teplitsaga o'tkazish."
                      : user?.role === "agranom"
                        ? "Transfer so'rovi yaratiladi va bosh agronom tasdiqlashidan so'ng amalga oshiriladi."
                        : "Ko'chatlarni lokatsiyalar orasida transfer qilish."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">

                  {/* Qaysi joydan */}
                  <div className="space-y-2">
                    <Label>Qaysi joydan</Label>
                    {user?.role === "agranom" ? (
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                        {locationMap.get(Number(agranomFromLocationId)) || "Lokatsiya biriktirilmagan"}
                      </div>
                    ) : (
                      <Select
                        value={formData.fromLocationId}
                        onValueChange={(value) =>
                          setFormData((current) => ({
                            ...current,
                            fromLocationId: value,
                            batchId: "",
                            fromStage: "",
                            fromRootstockTypeId: "",
                            fromVarietyId: "",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlang..." />
                        </SelectTrigger>
                        <SelectContent>
                          {locations?.map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Greenhouse: bosqich+nav visual panel */}
                  {isGreenhouseSource ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-yellow-800">
                        Qaysi bosqich va navdan * (bosing tanlash uchun)
                      </Label>
                      <div className="space-y-2">
                        {STAGES.map((stage) => {
                          const stRows = (ghSourceVariety || []).filter(
                            (r: any) => r.stage === stage && r.quantity > 0
                          );
                          const stActual = (ghStock?.[stage as keyof typeof ghStock] as number) || 0;
                          if (stActual === 0) return null;
                          const stVarTotal = stRows.reduce((s: number, r: any) => s + r.quantity, 0);
                          const stScale = stVarTotal > stActual && stVarTotal > 0 ? stActual / stVarTotal : 1;
                          return (
                            <div key={stage} className={`rounded-lg border p-2 ${STAGE_COLORS[stage]}`}>
                              <p className="text-[11px] font-semibold mb-1.5 opacity-80">
                                {STAGE_LABELS[stage]} — jami {formatN(stActual)} ta
                              </p>
                              <div className="space-y-1">
                                {stRows.length > 0 ? stRows.map((r: any, i: number) => {
                                  const isSelected =
                                    formData.fromStage === stage &&
                                    formData.fromRootstockTypeId === String(r.rootstockTypeId ?? 0) &&
                                    formData.fromVarietyId === String(r.varietyId ?? 0);
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 text-xs border transition-colors ${
                                        isSelected
                                          ? "border-primary bg-primary/10 font-semibold"
                                          : "border-border/60 bg-background hover:bg-muted/40"
                                      }`}
                                      onClick={() => setFormData((f) => ({
                                        ...f,
                                        fromStage: stage,
                                        fromRootstockTypeId: String(r.rootstockTypeId ?? 0),
                                        fromVarietyId: String(r.varietyId ?? 0),
                                      }))}
                                    >
                                      <span>
                                        {r.varietyName || "Aniqlanmagan nav"}
                                        {r.rootstockTypeName ? ` / ${r.rootstockTypeName}` : ""}
                                      </span>
                                      <span className="font-bold">{formatN(Math.round(r.quantity * stScale))} ta</span>
                                    </button>
                                  );
                                }) : (
                                  <button
                                    type="button"
                                    className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 text-xs border transition-colors ${
                                      formData.fromStage === stage
                                        ? "border-primary bg-primary/10 font-semibold"
                                        : "border-border/60 bg-background hover:bg-muted/40"
                                    }`}
                                    onClick={() => setFormData((f) => ({
                                      ...f,
                                      fromStage: stage,
                                      fromRootstockTypeId: "0",
                                    }))}
                                  >
                                    <span>Barcha ko'chatlar</span>
                                    <span className="font-bold">{formatN(stActual)} ta</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Jomboya/boshqa: partiya tanlash */
                    <div className="space-y-2">
                      <Label>Ko'chat partiyasi</Label>
                      <Select
                        value={formData.batchId}
                        onValueChange={(value) =>
                          setFormData((current) => ({ ...current, batchId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlang..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTransferBatches?.map((batch) => (
                            <SelectItem
                              key={`${batch.batchId || batch.id}-${batch.inventoryId || batch.id}`}
                              value={(batch.inventoryId || batch.id).toString()}
                            >
                              {batch.batchNumber} · {locationMap.get(batch.locationId) || batch.locationId} · {Number(batch.quantityAvailable || batch.healthyQuantity || 0).toLocaleString("uz-UZ")} ta
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBatch && (
                        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Jo'natish joyi</span>
                            <span className="font-medium text-foreground">
                              {locationMap.get(selectedBatch.locationId) || selectedBatch.locationId}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between gap-3">
                            <span className="text-muted-foreground">Mavjud qoldiq</span>
                            <span className="font-medium text-green-600">
                              {selectedBatch.quantityAvailable ?? selectedBatch.healthyQuantity}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Qaysi joyga */}
                  <div className="space-y-2">
                    <Label>Qaysi joyga</Label>
                    <Select
                      value={formData.toLocationId}
                      onValueChange={(value) =>
                        setFormData((current) => ({ ...current, toLocationId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(locations || [])
                          .filter((location) =>
                            location.id.toString() !== formData.fromLocationId &&
                            (!isGreenhouseSource || location.type === "greenhouse")
                          )
                          .map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Greenhouse: qaysi bosqichga */}
                  {isGreenhouseSource && (
                    <div className="space-y-2">
                      <Label>Qaysi bosqichga *</Label>
                      <Select
                        value={formData.toStage}
                        onValueChange={(value) => setFormData((f) => ({ ...f, toStage: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="transfer-quantity">Miqdori</Label>
                    <Input
                      id="transfer-quantity"
                      type="number"
                      placeholder="500"
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData((current) => ({ ...current, quantity: e.target.value }))
                      }
                    />
                  </div>

                  {/* Greenhouse: sana */}
                  {isGreenhouseSource && (
                    <div className="space-y-2">
                      <Label>Sana</Label>
                      <Input
                        type="date"
                        value={formData.actionDate}
                        onChange={(e) => setFormData((f) => ({ ...f, actionDate: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Batch: transfer turi */}
                  {!isGreenhouseSource && (
                    <div className="space-y-2">
                      <Label>Transfer turi</Label>
                      <Select
                        value={formData.transferType}
                        onValueChange={(value) =>
                          setFormData((current) => ({ ...current, transferType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="movement">Harakatlanish</SelectItem>
                          <SelectItem value="exchange">Almashinuv</SelectItem>
                          <SelectItem value="return">Qaytarish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Izoh</Label>
                    <Input
                      placeholder="Transfer haqida qisqa eslatma..."
                      value={formData.note}
                      onChange={(e) =>
                        setFormData((current) => ({ ...current, note: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button
                      onClick={handleCreateTransfer}
                      disabled={createTransferMutation.isPending || stageTransferMutation.isPending}
                    >
                      {(createTransferMutation.isPending || stageTransferMutation.isPending)
                        ? "Saqlanmoqda..."
                        : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="card-elegant">
          <CardHeader>
            <CardTitle>Transfer tarixi</CardTitle>
            <CardDescription>{visibleTransfers.length} ta transfer ko'rinmoqda</CardDescription>
          </CardHeader>
          <CardContent>
            {!visibleTransfers.length ? (
              <div className="py-12 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Transferlar topilmadi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleTransfers.map((transfer) => {
                  // Yangi tartib: Sender → Receiver → Head
                  let actionButton: React.ReactNode = null;
                  const isRejected = transfer.workflowStatus === "rejected" || transfer.status === "rejected";

                  if (!isRejected && transfer.workflowStatus !== "completed") {
                    if (
                      !transfer.senderConfirmedBy &&
                      (user?.role === "admin" || (user?.role === "agranom" && user.locationId === transfer.fromLocationId))
                    ) {
                      // 1-qadam: Jo'natuvchi tasdiqlaydi
                      actionButton = (
                        <Button size="sm" onClick={() => confirmSenderMutation.mutate(transfer.id)} disabled={confirmSenderMutation.isPending}>
                          Jo'natishni tasdiqlash
                        </Button>
                      );
                    } else if (
                      transfer.senderConfirmedBy && !transfer.receiverConfirmedBy &&
                      (user?.role === "admin" || (user?.role === "agranom" && user.locationId === transfer.toLocationId))
                    ) {
                      // 2-qadam: Qabul qiluvchi tasdiqlaydi
                      actionButton = (
                        <Button size="sm" onClick={() => confirmReceiverMutation.mutate(transfer.id)} disabled={confirmReceiverMutation.isPending}>
                          Qabulni tasdiqlash
                        </Button>
                      );
                    } else if (
                      transfer.receiverConfirmedBy && !transfer.headConfirmedBy &&
                      (user?.role === "admin" || user?.role === "bosh_agranom")
                    ) {
                      // 3-qadam: Bosh agronom tasdiqlaydi (so'nggi)
                      actionButton = (
                        <Button size="sm" onClick={() => confirmHeadMutation.mutate(transfer.id)} disabled={confirmHeadMutation.isPending}>
                          Bosh agronom tasdiqlashi
                        </Button>
                      );
                    }
                  }

                  return (
                    <div
                      key={transfer.id}
                      className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            {String(
                              transfer.batchCode ||
                                batchMap.get(transfer.batchId) ||
                                `Partiya #${transfer.batchId}`
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {transfer.quantity} ta ko'chat
                          </p>
                          {(transfer.seedlingTypeName || transfer.varietyName || transfer.rootstockTypeName) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[transfer.seedlingTypeName, transfer.varietyName, transfer.rootstockTypeName]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Qaysi joydan</p>
                            <p className="font-medium text-foreground">
                              {String(
                                transfer.fromLocationName ||
                                  locationMap.get(transfer.fromLocationId) ||
                                  `#${transfer.fromLocationId}`
                              )}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-accent" />
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">Qaysi joyga</p>
                            <p className="font-medium text-foreground">
                              {String(
                                transfer.toLocationName ||
                                  locationMap.get(transfer.toLocationId) ||
                                  `#${transfer.toLocationId}`
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                            {transferTypeLabel[transfer.transferType as keyof typeof transferTypeLabel]}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            transfer.workflowStatus === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : "bg-muted text-foreground"
                          }`}>
                            {transfer.workflowStatus
                              ? workflowStatusLabel[transfer.workflowStatus as keyof typeof workflowStatusLabel]
                              : "Jarayon davom etmoqda"}
                          </span>
                          {transfer.workflowStatus === "completed" && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-100">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Yakunlandi
                            </span>
                          )}
                          {transfer.workflowStatus === "rejected" && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Rad etildi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Yangi tartib: 1-Jo'natuvchi, 2-Qabul qiluvchi, 3-Bosh agronom */}
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <div className={`rounded-xl px-3 py-2 ${transfer.senderConfirmedBy ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40"}`}>
                          <p className="text-xs text-muted-foreground">1. Jo'natuvchi</p>
                          <p className={`font-medium ${transfer.senderConfirmedBy ? "text-green-700" : "text-foreground"}`}>
                            {transfer.senderConfirmedBy ? "✓ Tasdiqlangan" : "Kutilmoqda"}
                          </p>
                          {transfer.senderConfirmedByName && (
                            <p className="text-[10px] text-muted-foreground">{transfer.senderConfirmedByName}</p>
                          )}
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${transfer.receiverConfirmedBy ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40"}`}>
                          <p className="text-xs text-muted-foreground">2. Qabul qiluvchi</p>
                          <p className={`font-medium ${transfer.receiverConfirmedBy ? "text-green-700" : "text-foreground"}`}>
                            {transfer.receiverConfirmedBy ? "✓ Tasdiqlangan" : "Kutilmoqda"}
                          </p>
                          {transfer.receiverConfirmedByName && (
                            <p className="text-[10px] text-muted-foreground">{transfer.receiverConfirmedByName}</p>
                          )}
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${transfer.headConfirmedBy ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40"}`}>
                          <p className="text-xs text-muted-foreground">3. Bosh agronom</p>
                          <p className={`font-medium ${transfer.headConfirmedBy ? "text-green-700" : "text-foreground"}`}>
                            {transfer.headConfirmedBy ? "✓ Tasdiqlangan" : "Kutilmoqda"}
                          </p>
                          {transfer.headConfirmedByName && (
                            <p className="text-[10px] text-muted-foreground">{transfer.headConfirmedByName}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {transfer.workflowStatus === "completed" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleTransferReceipt(transfer, "download")}
                            >
                              <Download className="h-4 w-4" />
                              Chekni yuklash
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleTransferReceipt(transfer, "print")}
                            >
                              <Printer className="h-4 w-4" />
                              Chekni chiqarish
                            </Button>
                          </>
                        ) : null}
                        {actionButton}
                        {/* Rad etish tugmasi (admin yoki bosh_agranom) */}
                        {(user?.role === "admin" || user?.role === "bosh_agranom") &&
                          transfer.workflowStatus !== "completed" &&
                          transfer.workflowStatus !== "rejected" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => { setRejectTransferId(transfer.id); setRejectReason(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rad etish
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teplitsa bosqich transferlari */}
        {(ghTransfers && ghTransfers.length > 0) && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle>Bosqich transferlari (teplitsa→teplitsa)</CardTitle>
              <CardDescription>{ghTransfers.length} ta bosqich transferi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ghTransfers.map((gt) => {
                  let actionBtn: React.ReactNode = null;
                  if ((user?.role === "admin" || user?.role === "bosh_agranom") && !gt.headConfirmedBy) {
                    actionBtn = (
                      <Button size="sm" onClick={() => confirmGHHeadMutation.mutate(gt.id)} disabled={confirmGHHeadMutation.isPending}>
                        Bosh agronom tasdiqlashi
                      </Button>
                    );
                  } else if (
                    gt.headConfirmedBy && !gt.receiverConfirmedBy &&
                    (user?.role === "admin" || user?.role === "bosh_agranom" ||
                      (user?.role === "agranom" && user.locationId === gt.toLocationId))
                  ) {
                    actionBtn = (
                      <Button size="sm" onClick={() => confirmGHReceiverMutation.mutate(gt.id)} disabled={confirmGHReceiverMutation.isPending}>
                        Qabulni tasdiqlash
                      </Button>
                    );
                  }

                  return (
                    <div key={gt.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{gt.transferCode}</p>
                          <p className="text-sm text-muted-foreground">{gt.quantity} ta ko'chat</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {STAGE_LABELS[gt.fromStage] || gt.fromStage} → {STAGE_LABELS[gt.toStage] || gt.toStage}
                            {gt.rootstockTypeName ? ` · ${gt.rootstockTypeName}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Qaysi joydan</p>
                            <p className="font-medium text-foreground">{gt.fromLocationName || `#${gt.fromLocationId}`}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-accent" />
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">Qaysi joyga</p>
                            <p className="font-medium text-foreground">{gt.toLocationName || `#${gt.toLocationId}`}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                            Bosqich transferi
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                            {workflowStatusLabel[gt.status as keyof typeof workflowStatusLabel] || gt.status}
                          </span>
                          {gt.receiverConfirmedBy && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-100">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Yakunlandi
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Jo'natuvchi agronom</p>
                          <p className="font-medium text-foreground">Tasdiqlangan</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Bosh agronom</p>
                          <p className="font-medium text-foreground">{gt.headConfirmedBy ? "Tasdiqlangan" : "Kutilmoqda"}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Qabul qiluvchi agronom</p>
                          <p className="font-medium text-foreground">{gt.receiverConfirmedBy ? "Tasdiqlangan" : "Kutilmoqda"}</p>
                        </div>
                      </div>
                      {actionBtn && <div className="flex flex-wrap items-center gap-2">{actionBtn}</div>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Rad etish dialogi */}
      {rejectTransferId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setRejectTransferId(null); setRejectReason(""); }}}
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Transferni rad etish</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rad etilgandan so'ng inventar qaytariladi.
            </p>
            <div className="mt-4 space-y-2">
              <Label>Rad etish sababi (ixtiyoriy)</Label>
              <Input
                placeholder="Masalan: miqdori noto'g'ri, ma'lumot xato..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setRejectTransferId(null); setRejectReason(""); }}>
                Bekor qilish
              </Button>
              <Button
                variant="destructive"
                disabled={rejectTransferMutation.isPending}
                onClick={() => rejectTransferMutation.mutate({ transferId: rejectTransferId, reason: rejectReason || undefined })}
              >
                {rejectTransferMutation.isPending ? "Rad etilmoqda..." : "Rad etish"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

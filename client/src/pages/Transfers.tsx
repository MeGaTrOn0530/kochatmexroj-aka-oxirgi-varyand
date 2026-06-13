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
import { ArrowRight, CheckCircle2, Download, Plus, Printer, TrendingUp } from "lucide-react";
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
  pending_head: "Bosh agronom tasdig'i kutilmoqda",
  pending_receiver: "Qabul qiluvchi tasdig'i kutilmoqda",
  completed: "Yakunlandi",
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

export default function TransfersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
  });

  useEffect(() => {
    if (agranomFromLocationId) {
      setFormData((current) => ({ ...current, fromLocationId: agranomFromLocationId, batchId: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agranomFromLocationId]);

  const { data: transfers } = trpc.transfers.getAll.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const { data: locations } = trpc.locations.getAllDestinations.useQuery();

  const invalidateTransfers = async () => {
    await utils.transfers.getAll.invalidate();
  };

  const createTransferMutation = trpc.transfers.createTransfer.useMutation({
    onSuccess: async () => {
      toast.success("Transfer yaratildi");
      setFormData({
        batchId: "",
        fromLocationId: agranomFromLocationId,
        toLocationId: "",
        quantity: "",
        transferType: "movement",
        note: "",
      });
      setIsDialogOpen(false);
      await invalidateTransfers();
    },
    onError: (error) => {
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
      toast.success("Qabul tasdiqlandi");
      await invalidateTransfers();
    },
    onError: (error) => {
      toast.error(error.message || "Qabulni tasdiqlab bo'lmadi");
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
    if (
      !formData.batchId ||
      !formData.fromLocationId ||
      !formData.toLocationId ||
      !formData.quantity
    ) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }

    if (formData.fromLocationId === formData.toLocationId) {
      toast.error("Jo'natish va qabul lokatsiyasi bir xil bo'lmasligi kerak");
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi Ko'chat Transferi</DialogTitle>
                  <DialogDescription>
                    {user?.role === "agranom"
                      ? "Transfer so'rovi yaratiladi va bosh agronom tasdiqlashidan so'ng amalga oshiriladi."
                      : "Ko'chatlarni lokatsiyalar orasida transfer qilish."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                            {batch.batchNumber} · {locationMap.get(batch.locationId) || batch.locationId}
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
                          <span className="font-medium text-green-600">{selectedBatch.quantityAvailable ?? selectedBatch.healthyQuantity}</span>
                        </div>
                      </div>
                    )}
                  </div>
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
                        {locations
                          ?.filter((location) => location.id.toString() !== formData.fromLocationId)
                          .map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                      disabled={createTransferMutation.isPending}
                    >
                      {createTransferMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
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
                  let actionButton: React.ReactNode = null;

                  if (
                    (user?.role === "admin" ||
                      (user?.role === "agranom" && user.locationId === transfer.fromLocationId)) &&
                    !transfer.senderConfirmedBy
                  ) {
                    actionButton = (
                      <Button
                        size="sm"
                        onClick={() => confirmSenderMutation.mutate(transfer.id)}
                        disabled={confirmSenderMutation.isPending}
                      >
                        Jo'natishni tasdiqlash
                      </Button>
                    );
                  } else if (
                    (user?.role === "admin" || user?.role === "bosh_agranom") &&
                    transfer.senderConfirmedBy &&
                    !transfer.headConfirmedBy
                  ) {
                    actionButton = (
                      <Button
                        size="sm"
                        onClick={() => confirmHeadMutation.mutate(transfer.id)}
                        disabled={confirmHeadMutation.isPending}
                      >
                        Bosh agronom tasdiqlashi
                      </Button>
                    );
                  } else if (
                    (user?.role === "admin" ||
                      (user?.role === "agranom" && user.locationId === transfer.toLocationId)) &&
                    transfer.headConfirmedBy &&
                    !transfer.receiverConfirmedBy
                  ) {
                    actionButton = (
                      <Button
                        size="sm"
                        onClick={() => confirmReceiverMutation.mutate(transfer.id)}
                        disabled={confirmReceiverMutation.isPending}
                      >
                        Qabulni tasdiqlash
                      </Button>
                    );
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
                          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                            {transfer.workflowStatus
                              ? workflowStatusLabel[
                                  transfer.workflowStatus as keyof typeof workflowStatusLabel
                                ]
                              : "Jarayon davom etmoqda"}
                          </span>
                          {transfer.receiverConfirmedBy && (
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
                          <p className="font-medium text-foreground">
                            {transfer.senderConfirmedBy ? "Tasdiqlangan" : "Kutilmoqda"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Bosh agronom</p>
                          <p className="font-medium text-foreground">
                            {transfer.headConfirmedBy ? "Tasdiqlangan" : "Kutilmoqda"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Qabul qiluvchi agronom</p>
                          <p className="font-medium text-foreground">
                            {transfer.receiverConfirmedBy ? "Tasdiqlangan" : "Kutilmoqda"}
                          </p>
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
                        {actionButton ? actionButton : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

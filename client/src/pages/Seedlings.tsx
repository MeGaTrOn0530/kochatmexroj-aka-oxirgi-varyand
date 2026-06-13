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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock3, HelpCircle, Leaf, Pencil, Plus, Printer, Trash2, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { printBatchReceipt } from "@/lib/xprinter-bluetooth";
import SeedlingUnitsDialog from "@/components/SeedlingUnitsDialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const roleMeta = {
  admin: {
    title: "Ko'chat partiyalari",
    description: "Barcha obyektlardagi partiyalar, nuqsonli holatlar va tasdiqlarni umumiy nazorat qiling.",
  },
  bosh_agranom: {
    title: "Tasdiqlar va partiyalar",
    description: "Agranomlar kiritgan bosqichlar, nuqsonli holatlar va tasdiqlarni ko'rib chiqing.",
  },
  agranom: {
    title: "Ko'chat partiyalari",
    description: "Partiyalarni ko'rish, bosqichlarni yangilash va nuqsonlilarni qayd etish.",
  },
  bugalter: {
    title: "Partiyalar reyestri",
    description: "Transfer va operatsiyalar uchun partiyalar tarixini kuzating.",
  },
} as const;

const stageLabel = {
  cassette: "Kasetada",
  sown: "Tuvakda",
  grafting: "Payvantlash",
  grafted: "Payvantlangan",
  ready: "Ko'chat (tayyor)",
} as const;

type BatchStatus = keyof typeof stageLabel;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

function formatCount(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(Number(value || 0));
}

function getDateTimeLocalValue(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}


export default function SeedlingsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [historyBatchId, setHistoryBatchId] = useState<number | null>(null);
  const [unitsBatch, setUnitsBatch] = useState<{ batchId: number; batchNumber: string; qrPayload: string } | null>(null);
  const [stageFiles, setStageFiles] = useState<File[]>([]);
  // Hisobdan chiqarish
  const [writeOffBatch, setWriteOffBatch] = useState<any | null>(null);
  const [writeOffForm, setWriteOffForm] = useState({ quantity: "", note: "" });
  const [showWriteOffHistory, setShowWriteOffHistory] = useState(false);
  // Admin: batch tahrirlash va o'chirish uchun
  const [adminEditBatch, setAdminEditBatch] = useState<any | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [adminEditForm, setAdminEditForm] = useState({
    seedlingTypeId: "",
    varietyId: "",
    rootstockTypeId: "none",
    notes: "",
    batchCode: "",
  });
  const [createForm, setCreateForm] = useState({
    batchNumber: "",
    seedlingTypeId: "",
    varietyId: "",
    rootstockTypeId: "none",
    labelCodeType: "qr",
    quantity: "",
    locationId: "",
    notes: "",
    receivedAt: getDateTimeLocalValue(),
  });
  const [stageForm, setStageForm] = useState({
    status: "sown" as BatchStatus,
    defectiveQuantity: "0",
    failedGraftQuantity: "0",
    note: "",
    stageDate: getDateTimeLocalValue(),
    // Nav/tur yangilash (teplitsada bosqich o'zgartirish vaqtida aniqlanishi mumkin)
    updateVariety: false,
    seedlingTypeId: "",
    varietyId: "",
    rootstockTypeId: "",
  });
  // Tayyor ko'chatlar komponenti uchun faqat bir marta e'lon qilinadi
  // ...existing code...

  const currentRole = (user?.role || "agranom") as keyof typeof roleMeta;

  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: transfers } = trpc.transfers.getAll.useQuery();
  const { data: writeOffs } = trpc.seedlings.getWriteOffs.useQuery();

  // Foydalanuvchi lokatsiyasi
  const myLocation = (locations || []).find((l: any) => l.id === user?.locationId);
  const isSourceLocation = Boolean(myLocation?.isSource);

  // Jomboydan chiqgan transferlar (hosib kitob)
  const outgoingTransfers = (transfers || []).filter(
    (t: any) => t.fromLocationId === user?.locationId
  );

  // Faqat manba (Jomboy) agranomi partiya yarata oladi
  const canCreateBatch = user?.role === "agranom" && isSourceLocation;
  // Teplitsa agranomi batch bosqichini o'zgartirmaydi — greenhouse stage system ishlatadi
  const canUpdateStage =
    user?.role === "admin" ||
    user?.role === "bosh_agranom";
  const canApproveBatch = ["admin", "bosh_agranom"].includes(user?.role || "");
  const canAdminEdit = user?.role === "admin";
  const canWriteOff = ["admin", "bosh_agranom"].includes(user?.role || "") ||
    (user?.role === "agranom" && isSourceLocation);
  const { data: seedlingTypes } = trpc.catalog.getSeedlingTypes.useQuery();
  const { data: fruitVarieties } = trpc.catalog.getFruitVarieties.useQuery();
  const { data: rootstockTypes } = trpc.catalog.getRootstockTypes.useQuery();
  const { data: historyData, isFetching: isHistoryLoading } = trpc.seedlings.getHistory.useQuery(
    historyBatchId ?? 0,
    {
      enabled: historyBatchId !== null,
    }
  );

  const seedlingTypeMap = useMemo(
    () => new Map((seedlingTypes || []).map((type: any) => [type.id, type.name])),
    [seedlingTypes]
  );
  const locationMap = useMemo(
    () => new Map((locations || []).map((location: any) => [location.id, location.name])),
    [locations]
  );
  const filteredVarieties = useMemo(() => {
    if (!fruitVarieties?.length) {
      return [];
    }

    if (!createForm.seedlingTypeId) {
      return fruitVarieties;
    }

    return fruitVarieties.filter(
      (variety: any) => String(variety.seedlingTypeId) === String(createForm.seedlingTypeId)
    );
  }, [createForm.seedlingTypeId, fruitVarieties]);
  const availableCreateLocations = useMemo(() => {
    if (!locations) {
      return [];
    }

    if (user?.role === "agranom") {
      return locations.filter((location) => location.id === user.locationId);
    }

    return locations;
  }, [locations, user?.locationId, user?.role]);

  const batchesForView = useMemo(() => {
    if (!batches) {
      return [];
    }

    if (user?.role === "agranom") {
      return batches.filter((batch) => batch.locationId === user.locationId);
    }

    return batches;
  }, [batches, user?.locationId, user?.role]);

  const sourceLocationsSet = useMemo(
    () => new Set((locations || []).filter((l: any) => l.isSource).map((l: any) => l.id)),
    [locations]
  );

  const editingBatch = useMemo(
    () => batchesForView.find((batch) => (batch.inventoryId ?? batch.id) === editingBatchId) || null,
    [batchesForView, editingBatchId]
  );

  const stagePreviewUrls = useMemo(
    () => stageFiles.map((file) => URL.createObjectURL(file)),
    [stageFiles]
  );

  useEffect(() => {
    return () => {
      for (const preview of stagePreviewUrls) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [stagePreviewUrls]);


  useEffect(() => {
    if (createForm.locationId || !user?.locationId) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      locationId: user.locationId ? user.locationId.toString() : "",
    }));
  }, [createForm.locationId, user?.locationId]);

  useEffect(() => {
    setCreateForm((current) => {
      if (!current.varietyId) return current;
      const hasSelectedVariety = filteredVarieties.some(
        (variety: any) => String(variety.id) === String(current.varietyId)
      );
      if (hasSelectedVariety) return current;
      return { ...current, varietyId: "" };
    });
  }, [filteredVarieties]);

  const createBatchMutation = trpc.seedlings.createBatch.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chat partiyasi yaratildi");
      setCreateForm({
        batchNumber: "",
        seedlingTypeId: "",
        varietyId: "",
        rootstockTypeId: "none",
        labelCodeType: "qr",
        quantity: "",
        locationId: "",
        notes: "",
        receivedAt: getDateTimeLocalValue(),
      });
      setIsCreateDialogOpen(false);
      await utils.seedlings.getBatches.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Partiya yaratilmadi");
    },
  });

  const updateBatchStatusMutation = trpc.seedlings.updateBatchStatus.useMutation({
    onSuccess: async () => {
      toast.success("Bosqich yangilandi");
      setEditingBatchId(null);
      setStageFiles([]);
      setStageForm({
        status: "sown",
        defectiveQuantity: "0",
        failedGraftQuantity: "0",
        note: "",
        stageDate: getDateTimeLocalValue(),
        updateVariety: false,
        seedlingTypeId: "",
        varietyId: "",
        rootstockTypeId: "",
      });
      await utils.seedlings.getBatches.invalidate();
      if (historyBatchId) {
        await utils.seedlings.getHistory.invalidate(historyBatchId);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Bosqich yangilanmadi");
    },
  });

  const deleteBatchMutation = trpc.seedlings.deleteBatch.useMutation({
    onSuccess: async () => {
      toast.success("Partiya o'chirildi");
      setDeletingBatchId(null);
      await utils.seedlings.getBatches.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "O'chirib bo'lmadi");
    },
  });

  const editBatchMutation = trpc.seedlings.editBatch.useMutation({
    onSuccess: async (_data, _vars, context: any) => {
      if (!context?.silent) toast.success("Partiya yangilandi");
      setAdminEditBatch(null);
      await utils.seedlings.getBatches.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Yangilab bo'lmadi");
    },
  });

  const writeOffMutation = trpc.seedlings.writeOff.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chatlar hisobdan chiqarildi");
      setWriteOffBatch(null);
      setWriteOffForm({ quantity: "", note: "" });
      await utils.seedlings.getBatches.invalidate();
      await utils.seedlings.getWriteOffs.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Hisobdan chiqarib bo'lmadi");
    },
  });

  const approveBatchMutation = trpc.seedlings.approveBatch.useMutation({
    onSuccess: async () => {
      toast.success("Partiya tasdiqlandi");
      await utils.seedlings.getBatches.invalidate();
      if (historyBatchId) {
        await utils.seedlings.getHistory.invalidate(historyBatchId);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Tasdiqlab bo'lmadi");
    },
  });

  const awaitingApprovalCount = batchesForView.filter((batch) => Boolean(batch.pendingHistoryId)).length;
  const totalDefective = batchesForView.reduce((total, batch) => total + batch.defectiveQuantity, 0);

  const handleCreateBatch = () => {
    if (!createForm.batchNumber || !createForm.quantity || !createForm.locationId) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }

    createBatchMutation.mutate({
      batchNumber: createForm.batchNumber.trim(),
      seedlingTypeId: createForm.seedlingTypeId ? Number(createForm.seedlingTypeId) : undefined,
      varietyId: createForm.varietyId ? Number(createForm.varietyId) : undefined,
      rootstockTypeId:
        createForm.rootstockTypeId && createForm.rootstockTypeId !== "none"
          ? Number(createForm.rootstockTypeId)
          : undefined,
      labelCodeType: createForm.labelCodeType,
      quantity: Number(createForm.quantity),
      locationId: Number(createForm.locationId),
      receivedAt: createForm.receivedAt ? new Date(createForm.receivedAt) : new Date(),
      receivedDate: createForm.receivedAt ? new Date(createForm.receivedAt) : new Date(),
      notes: createForm.notes.trim() || undefined,
    });
  };

  const handleOpenStageDialog = (inventoryId: number) => {
    const batch = batchesForView.find((item) => (item.inventoryId ?? item.id) === inventoryId);
    if (!batch) {
      return;
    }

    setStageForm({
      status: batch.status as BatchStatus,
      defectiveQuantity: "0",
      failedGraftQuantity: "0",
      note: "",
      stageDate: getDateTimeLocalValue(),
      updateVariety: false,
      seedlingTypeId: String(batch.seedlingTypeId || ""),
      varietyId: String(batch.varietyId || ""),
      rootstockTypeId: batch.rootstockTypeId ? String(batch.rootstockTypeId) : "",
    });
    setStageFiles([]);
    setEditingBatchId(inventoryId);
  };

  const handleUpdateStage = async () => {
    if (!editingBatchId) {
      return;
    }

    if (Number(stageForm.defectiveQuantity) > 0 && stageFiles.length === 0) {
      toast.error("Nuqsonli miqdor kiritilganda kamida 1 ta rasm yuklash majburiy");
      return;
    }

    try {
      const defectiveImages = await Promise.all(
        stageFiles.map(async (file) => ({
          name: file.name,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );

      // Bosqich yangilash
      await updateBatchStatusMutation.mutateAsync({
        batchId: editingBatch.batchId || editingBatch.id,
        status: stageForm.status,
        fromStage: editingBatch.status,
        defectiveQuantity: Number(stageForm.defectiveQuantity || 0),
        failedGraftQuantity: Number(stageForm.failedGraftQuantity || 0),
        defectiveImages,
        note: stageForm.note.trim() || undefined,
        stageDate: stageForm.stageDate ? new Date(stageForm.stageDate) : new Date(),
      });

      // Nav/tur yangilash kerak bo'lsa (silent — alohida toast chiqmaydi)
      if (stageForm.updateVariety && (stageForm.seedlingTypeId || stageForm.varietyId || stageForm.rootstockTypeId)) {
        try {
          await editBatchMutation.mutateAsync({
            batchId: editingBatch.batchId || editingBatch.id,
            seedlingTypeId: stageForm.seedlingTypeId ? Number(stageForm.seedlingTypeId) : undefined,
            varietyId: stageForm.varietyId ? Number(stageForm.varietyId) : undefined,
            rootstockTypeId: stageForm.rootstockTypeId ? Number(stageForm.rootstockTypeId) : undefined,
          });
        } catch (_) {
          // bosqich yangilandi, nav yangilanmadi — foydalanuvchi ko'radi
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rasmlar yuklanmadi");
    }
  };

  const handleCopyCode = async (value: string, label: string) => {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      toast.error(`${label} topilmadi`);
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedValue);
      toast.success(`${label} nusxalandi`);
    } catch {
      toast.error(`${label} ni nusxalab bo'lmadi`);
    }
  };

  return (
    <>
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Leaf className="h-6 w-6 text-accent" />
              {roleMeta[currentRole].title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              {roleMeta[currentRole].description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{batchesForView.length}</div>
              <div className="text-[10px] text-muted-foreground">Partiya</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{awaitingApprovalCount}</div>
              <div className="text-[10px] text-muted-foreground">Tasdiq</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{totalDefective}</div>
              <div className="text-[10px] text-muted-foreground">Nuqsonli</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            💡 Turi noma'lum bo'lsa <span className="font-semibold text-foreground">Aniqlanmagan</span> tanlang. Har bosqichda nuqsonli son va rasm kiritiladi.
          </div>
          {canCreateBatch && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Yangi partiya
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Yangi Ko'chat Partiyasi</DialogTitle>
                  <DialogDescription>
                    Yangi ko'chat partiyasini ro'yxatga oling va boshlang'ich izohini kiriting.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="batchNumber">Partiya raqami</Label>
                      <Input
                        id="batchNumber"
                        placeholder="KO-2026-001"
                        value={createForm.batchNumber}
                        onChange={(e) =>
                          setCreateForm((current) => ({ ...current, batchNumber: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receivedAt">Kirim vaqti</Label>
                      <Input
                        id="receivedAt"
                        type="datetime-local"
                        value={createForm.receivedAt}
                        onChange={(e) =>
                          setCreateForm((current) => ({ ...current, receivedAt: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="seedlingType">Ko'chat turi</Label>
                      <Select
                        value={createForm.seedlingTypeId || "none"}
                        onValueChange={(value) =>
                          setCreateForm((current) => ({ ...current, seedlingTypeId: value === "none" ? "" : value, varietyId: "" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlanmagan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tanlanmagan</SelectItem>
                          {seedlingTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="varietyId">Ko'chat navi</Label>
                      <Select
                        value={createForm.varietyId || "none"}
                        onValueChange={(value) =>
                          setCreateForm((current) => ({ ...current, varietyId: value === "none" ? "" : value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlanmagan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tanlanmagan</SelectItem>
                          {filteredVarieties.map((variety: any) => (
                            <SelectItem key={variety.id} value={variety.id.toString()}>
                              {variety.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootstockTypeId">Payvandtag turi</Label>
                      <Select
                        value={createForm.rootstockTypeId}
                        onValueChange={(value) =>
                          setCreateForm((current) => ({ ...current, rootstockTypeId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Payvandtagni tanlang..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tanlanmagan</SelectItem>
                          {(rootstockTypes || []).map((type: any) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Miqdori</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="1000"
                        value={createForm.quantity}
                        onChange={(e) =>
                          setCreateForm((current) => ({ ...current, quantity: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Lokatsiya</Label>
                    <Select
                      value={createForm.locationId}
                      disabled={user?.role === "agranom"}
                      onValueChange={(value) =>
                        setCreateForm((current) => ({ ...current, locationId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCreateLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id.toString()}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {user?.role === "agranom" && (
                      <p className="text-xs text-muted-foreground">
                        Sizga biriktirilgan obyekt avtomatik tanlanadi.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-notes">Izoh</Label>
                    <Textarea
                      id="create-notes"
                      placeholder="Masalan: birinchi kirim, meva turi hali aniqlanmagan..."
                      value={createForm.notes}
                      onChange={(e) =>
                        setCreateForm((current) => ({ ...current, notes: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button onClick={handleCreateBatch} disabled={createBatchMutation.isPending}>
                      {createBatchMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!batchesForView.length ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 py-16 text-muted-foreground">
              <Leaf className="mb-3 h-10 w-10 opacity-30" />
              <p>Ko'chat partiyalari topilmadi</p>
            </div>
          ) : (
            batchesForView.map((batch) => {
              const typeName =
                seedlingTypeMap.get(batch.seedlingTypeId) ||
                batch.seedlingTypeName ||
                "Aniqlanmagan";
              const varietyName = batch.varietyName || "Aniqlanmagan nav";
              const rootstockName = batch.rootstockTypeName || null;
              const locationName =
                locationMap.get(batch.locationId) || `Lokatsiya #${batch.locationId}`;
              const healthyCount = batch.quantity - batch.defectiveQuantity;
              const receivedDateLabel = batch.receivedDate
                ? new Date(batch.receivedDate).toLocaleDateString("uz-UZ")
                : batch.receivedAt
                  ? new Date(batch.receivedAt).toLocaleDateString("uz-UZ")
                  : "—";

              const stageBgClass =
                batch.status === "ready"
                  ? "bg-green-100 text-green-800 border-green-200"
                  : batch.status === "cassette" || batch.status === "sown"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : "bg-blue-100 text-blue-800 border-blue-200";

              const pendingApproval = Boolean(batch.pendingHistoryId);

              // 20-kun muddati hisoblash (faqat manba lokatsiyasidagi partiyalar uchun)
              const batchCreatedAt = batch.receivedAt || batch.receivedDate;
              const isSourceBatch = sourceLocationsSet.has(batch.locationId) && !!batchCreatedAt;
              const daysElapsed = isSourceBatch
                ? Math.floor((Date.now() - new Date(batchCreatedAt!).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const deadlineState =
                daysElapsed === null
                  ? null
                  : daysElapsed >= 21
                    ? "overdue"
                    : daysElapsed === 20
                      ? "danger"
                      : daysElapsed === 19
                        ? "warning"
                        : null;

              return (
                <div
                  key={`${batch.id}-${batch.inventoryId || "inv"}`}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-background shadow-sm transition-shadow hover:shadow-md ${
                    deadlineState === "overdue"
                      ? "border-red-400"
                      : deadlineState === "danger"
                        ? "border-red-300"
                        : deadlineState === "warning"
                          ? "border-amber-300"
                          : "border-border/60"
                  }`}
                >
                  {/* Top strip — stage color / deadline indicator */}
                  <div
                    className={`h-1.5 w-full ${
                      deadlineState === "overdue"
                        ? "bg-red-500"
                        : deadlineState === "danger"
                          ? "bg-red-400"
                          : deadlineState === "warning"
                            ? "bg-amber-400"
                            : batch.status === "ready"
                              ? "bg-green-400"
                              : batch.status === "cassette" || batch.status === "sown"
                                ? "bg-yellow-400"
                                : "bg-blue-400"
                    }`}
                  />

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-base font-bold leading-tight text-foreground">
                          {batch.batchNumber}
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{typeName}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground/70">
                          {varietyName}
                          {rootstockName ? ` · ${rootstockName}` : ""}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stageBgClass}`}
                      >
                        {stageLabel[batch.status as BatchStatus]}
                      </span>
                    </div>

                    {/* 20-kun muddati ko'rsatkichi */}
                    {deadlineState && (
                      <div
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          deadlineState === "overdue"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : deadlineState === "danger"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span
                          className={deadlineState === "overdue" ? "animate-bounce inline-flex items-center gap-1" : "inline-flex items-center gap-1"}
                        >
                          {deadlineState === "overdue"
                            ? `🔴 ${daysElapsed}-kun — Kechikmoqda!`
                            : deadlineState === "danger"
                              ? `🔴 20-kun — Muddati tugadi!`
                              : `⚠️ 19-kun — Ertaga muddati!`}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="opacity-60 hover:opacity-100">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs leading-relaxed">
                            Jomboy partiyalari yaratilgan kundan boshlab 20 kun ichida teplitsaga yetkazilishi kerak. 19-kun: ogohlantirish (sariq), 20-kun: muddati tugadi (qizil), 21-kun va undan keyin: kechikmoqda (qalqib animatsiya).
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-2.5">
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Jami</div>
                        <div className="mt-0.5 text-base font-bold text-foreground">
                          {formatCount(batch.quantity)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sog'lom</div>
                        <div className="mt-0.5 text-base font-bold text-green-600">
                          {formatCount(healthyCount)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nuqsonli</div>
                        <div className="mt-0.5 text-base font-bold text-red-500">
                          {formatCount(batch.defectiveQuantity)}
                        </div>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="opacity-60">📍</span> {locationName}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="opacity-60">📅</span> {receivedDateLabel}
                      </span>
                      {pendingApproval ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Tasdiq kutilmoqda
                        </span>
                      ) : batch.approvedBy ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          ✓ Tasdiqlangan
                        </span>
                      ) : null}
                    </div>

                    {batch.notes ? (
                      <div className="rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground line-clamp-2">
                        {batch.notes}
                      </div>
                    ) : null}

                    {/* Action buttons */}
                    <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1">
                      {/* QR Kod tugmasi — SeedlingUnitsDialog ochadi */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="col-span-full gap-1.5 border-accent/40 text-accent hover:bg-accent/5"
                        onClick={() =>
                          setUnitsBatch({
                            batchId: batch.batchId || batch.id,
                            batchNumber: batch.batchNumber,
                            qrPayload: batch.qrPayload || batch.batchNumber,
                          })
                        }
                      >
                        <Printer className="h-3.5 w-3.5" />
                        QR Kod / Ko'chat donalari
                      </Button>

                      {canUpdateStage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleOpenStageDialog(batch.inventoryId ?? batch.id)}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Bosqich
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 ${!canUpdateStage && !canAdminEdit ? "col-span-full" : ""}`}
                        onClick={() => setHistoryBatchId(batch.batchId || batch.id)}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Tarix
                      </Button>

                      {canAdminEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setAdminEditBatch(batch);
                            setAdminEditForm({
                              seedlingTypeId: String(batch.seedlingTypeId || ""),
                              varietyId: String(batch.varietyId || ""),
                              rootstockTypeId: batch.rootstockTypeId ? String(batch.rootstockTypeId) : "none",
                              notes: batch.notes || "",
                              batchCode: batch.batchNumber || "",
                            });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Tahrirlash
                        </Button>
                      )}

                      {canAdminEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingBatchId(batch.batchId || batch.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          O'chirish
                        </Button>
                      )}

                      {canWriteOff && (batch.quantityAvailable ?? (batch.quantity - batch.defectiveQuantity)) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="col-span-full gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                          onClick={() => {
                            setWriteOffBatch(batch);
                            setWriteOffForm({ quantity: "", note: "" });
                          }}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Hisobdan chiqarish
                        </Button>
                      )}

                      {canApproveBatch && pendingApproval && (
                        <Button
                          size="sm"
                          className="col-span-full gap-1.5 bg-green-600 text-white hover:bg-green-700"
                          onClick={() => approveBatchMutation.mutate(batch.pendingHistoryId)}
                          disabled={approveBatchMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Tasdiqlash
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Teplitsa agranomi uchun bosqich boshqaruvi haqida eslatma */}
        {user?.role === "agranom" && !isSourceLocation && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-semibold">Teplitsa bosqichlari</span> — Partiya bosqichini o'zgartirish shart emas.
            Bosqich harakatlarini boshqarish uchun{" "}
            <a href="/greenhouse-stages" className="underline font-semibold">Teplitsa bosqichlari</a> sahifasidan foydalaning.
          </div>
        )}

        {/* Jomboy: Chiqim daftari */}
        {user?.role === "agranom" && isSourceLocation && (outgoingTransfers.length > 0 || (writeOffs?.length ?? 0) > 0) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Chiqim daftari
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                onClick={() => setShowWriteOffHistory(true)}
              >
                <Clock3 className="h-3.5 w-3.5" />
                Hisobdan chiqarish tarixi
              </Button>
            </div>

            {/* Hisobdan chiqarish daftari — birinchi */}
            {(writeOffs?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 px-1">Hisobdan chiqarish daftari</p>
                <div className="overflow-hidden rounded-2xl border border-orange-200/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orange-200/60 bg-orange-50/40">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Partiya</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Nav</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Sabab</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Miqdor</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground">Holat</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {writeOffs!.map((w: any) => (
                        <tr key={w.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                            {w.batchCode || `#${w.batchId}`}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-foreground font-medium">
                            {w.varietyName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {w.note || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-700">
                            -{formatCount(w.quantity)} ta
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700">
                              Chiqarildi
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                            {w.date ? new Date(w.date).toLocaleDateString("uz-UZ") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jo'natilgan ko'chatlar — ikkinchi */}
            {outgoingTransfers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Jo'natilgan ko'chatlar</p>
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Partiya</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Qayerga</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Payvantek turi</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Miqdor</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground">Holat</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoingTransfers.map((t: any) => (
                        <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                            {t.batchCode || `#${t.batchId}`}
                          </td>
                          <td className="px-4 py-2.5 text-foreground">
                            {t.toLocationName || `Lokatsiya #${t.toLocationId}`}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-foreground font-medium">
                            {t.rootstockTypeName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">
                            {formatCount(t.quantity)} ta
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              t.workflowStatus === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {t.workflowStatus === "completed" ? "Qabul qilindi" :
                               t.workflowStatus === "pending_receiver" ? "Qabul kutilmoqda" :
                               t.workflowStatus === "pending_head" ? "Bosh agronom kutilmoqda" :
                               "Jo'natilmagan"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                            {t.transferDate ? new Date(t.transferDate).toLocaleDateString("uz-UZ") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog
          open={!!editingBatchId}
          onOpenChange={(open) => {
            if (!open) {
              setEditingBatchId(null);
              setStageFiles([]);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bosqichni yangilash</DialogTitle>
              <DialogDescription>
                {editingBatch?.batchNumber || "Tanlangan partiya"} uchun yangi bosqich, yangi nuqsonli son va rasmli dalilni kiriting.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              {editingBatch ? (
                <div className="grid gap-3 rounded-2xl bg-muted/25 p-4 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-background/80 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Partiya</div>
                    <div className="mt-1 font-semibold text-foreground">{editingBatch.batchNumber}</div>
                  </div>
                  <div className="rounded-xl bg-background/80 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Joriy bosqich</div>
                    <div className="mt-1 font-semibold text-foreground">
                      {stageLabel[editingBatch.status as BatchStatus]}
                    </div>
                  </div>
                  <div className="rounded-xl bg-background/80 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Hozirgi sog'lom qoldiq</div>
                    <div className="mt-1 font-semibold text-green-600">
                      {formatCount(editingBatch.healthyQuantity ?? editingBatch.quantity - editingBatch.defectiveQuantity)}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Yangi bosqich</Label>
                  <Select
                    value={stageForm.status}
                    onValueChange={(value) =>
                      setStageForm((current) => ({ ...current, status: value as BatchStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(stageLabel).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage-date">Yangilanish vaqti</Label>
                  <Input
                    id="stage-date"
                    type="datetime-local"
                    value={stageForm.stageDate}
                    onChange={(event) =>
                      setStageForm((current) => ({
                        ...current,
                        stageDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage-defective">Yangi nuqsonli miqdor</Label>
                <Input
                  id="stage-defective"
                  type="number"
                  value={stageForm.defectiveQuantity}
                  onChange={(event) =>
                    setStageForm((current) => ({
                      ...current,
                      defectiveQuantity: event.target.value,
                    }))
                  }
                />
              </div>

              {editingBatch?.status === "grafting" && stageForm.status === "grafted" && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <Label htmlFor="stage-failed-graft" className="text-amber-800">
                    Payvant olmagan (qaytariladigan) soni
                  </Label>
                  <p className="text-xs text-amber-700">
                    Bu miqdor payvantlash bosqichiga qaytariladi. Qolganlar payvantlangan bosqichiga o'tadi.
                  </p>
                  <Input
                    id="stage-failed-graft"
                    type="number"
                    min="0"
                    value={stageForm.failedGraftQuantity}
                    onChange={(event) =>
                      setStageForm((current) => ({
                        ...current,
                        failedGraftQuantity: event.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {/* Nav/tur yangilash — bosqich o'zgartirish vaqtida aniqlanishi mumkin */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={stageForm.updateVariety}
                    onChange={(e) => setStageForm((f) => ({ ...f, updateVariety: e.target.checked }))}
                  />
                  <span className="text-sm font-medium text-blue-800">
                    Ko'chat turi va navini yangilash (ixtiyoriy)
                  </span>
                </label>
                {stageForm.updateVariety && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ko'chat turi</Label>
                      <Select
                        value={stageForm.seedlingTypeId}
                        onValueChange={(v) => setStageForm((f) => ({ ...f, seedlingTypeId: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                        <SelectContent>
                          {(seedlingTypes || []).map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nav</Label>
                      <Select
                        value={stageForm.varietyId}
                        onValueChange={(v) => setStageForm((f) => ({ ...f, varietyId: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                        <SelectContent>
                          {(fruitVarieties || [])
                            .filter((v: any) => !stageForm.seedlingTypeId || String(v.seedlingTypeId) === stageForm.seedlingTypeId)
                            .map((v: any) => (
                              <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Payvandtag</Label>
                      <Select
                        value={stageForm.rootstockTypeId || "none"}
                        onValueChange={(v) => setStageForm((f) => ({ ...f, rootstockTypeId: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tanlanmagan</SelectItem>
                          {(rootstockTypes || []).map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage-note">Izoh</Label>
                <Textarea
                  id="stage-note"
                  placeholder="Nuqson sababi, bosqich izohi yoki kuzatuv..."
                  value={stageForm.note}
                  onChange={(event) =>
                    setStageForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage-images">
                  Nuqsonli rasmlar
                  {Number(stageForm.defectiveQuantity) > 0 && (
                    <span className="ml-1 text-red-500">*majburiy</span>
                  )}
                </Label>
                <Input
                  id="stage-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setStageFiles(Array.from(event.target.files || []))}
                />
                {stageFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {stagePreviewUrls.map((preview, index) => (
                      <div key={preview} className="overflow-hidden rounded-2xl border border-border/70">
                        <img src={preview} alt={`Nuqson preview ${index + 1}`} className="h-28 w-full object-cover" />
                        <div className="truncate px-3 py-2 text-xs text-muted-foreground">
                          {stageFiles[index]?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                <Button variant="outline" onClick={() => setEditingBatchId(null)}>
                  Bekor qilish
                </Button>
                <Button onClick={handleUpdateStage} disabled={updateBatchStatusMutation.isPending}>
                  {updateBatchStatusMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!historyBatchId} onOpenChange={(open) => !open && setHistoryBatchId(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Tarix va nuqsonlar</DialogTitle>
              <DialogDescription>
                Bosqichlar bo'yicha o'zgarishlar, tasdiqlar va rasmli nuqsonli yozuvlar.
              </DialogDescription>
            </DialogHeader>
            {isHistoryLoading ? (
              <div className="py-8 text-sm text-muted-foreground">Tarix yuklanmoqda...</div>
            ) : !historyData ? (
              <div className="py-8 text-sm text-muted-foreground">Tarix topilmadi.</div>
            ) : (
              <div className="space-y-6">
                <Card className="card-elegant">
                  <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-muted-foreground">Partiya</div>
                      <div className="font-semibold text-foreground">{historyData.batch.batchNumber}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Joriy bosqich</div>
                      <div className="font-semibold text-foreground">
                        {stageLabel[historyData.batch.status as BatchStatus]}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Jami nuqsonli</div>
                      <div className="font-semibold text-red-600">{historyData.batch.defectiveQuantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Tasdiq</div>
                      <div className="font-semibold text-foreground">
                        {historyData.batch.approvedBy ? "Tasdiqlangan" : "Tasdiq kutilmoqda"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Bosqich tarixi</h3>
                  {!historyData.history.length ? (
                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                      Hali tarix yozuvi yo'q.
                    </div>
                  ) : (
                    historyData.history.map((item) => {
                      const images = Array.isArray(item.imagePaths) ? item.imagePaths : [];

                      return (
                        <Card key={item.id} className="card-elegant">
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-sm text-muted-foreground">
                                  {item.fromStage ? stageLabel[item.fromStage as BatchStatus] : "Birinchi kirim"}{" "}
                                  -&gt; {stageLabel[item.toStage as BatchStatus]}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Sana: {new Date(item.stageDate).toLocaleString("uz-UZ")}
                                </div>
                              </div>
                              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                                {item.approvedBy ? "Tasdiqlangan" : "Tasdiq kutilmoqda"}
                              </span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Amalni bajargan</div>
                                <div className="text-sm font-semibold text-foreground">{item.createdByName || "-"}</div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Tasdiqlagan</div>
                                <div className="text-sm font-semibold text-foreground">
                                  {item.approvedByName || (item.approvedBy ? "System" : "-")}
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Miqdor</div>
                                <div className="text-lg font-semibold text-foreground">{item.quantity}</div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Yangi nuqsonli</div>
                                <div className="text-lg font-semibold text-red-600">{formatCount(item.defectiveQuantity)}</div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Rasm</div>
                                <div className="text-lg font-semibold text-foreground">{images.length} ta</div>
                              </div>
                            </div>
                            {item.note && (
                              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                                {item.note}
                              </div>
                            )}
                            {images.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {images.map((image) => (
                                  <a
                                    key={image}
                                    href={image}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="overflow-hidden rounded-2xl border border-border/70"
                                  >
                                    <img src={image} alt="Nuqsonli ko'chat" className="h-28 w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Nuqsonli yozuvlar</h3>
                  {!historyData.defects.length ? (
                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                      Hali nuqsonli yozuv mavjud emas.
                    </div>
                  ) : (
                    historyData.defects.map((defect) => {
                      const images = Array.isArray(defect.imagePaths) ? defect.imagePaths : [];

                      return (
                        <Card key={defect.id} className="card-elegant">
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-foreground">
                                  {defect.quantity} ta nuqsonli
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(defect.createdAt).toLocaleString("uz-UZ")}
                                </div>
                              </div>
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                Defect report
                              </span>
                            </div>
                            {defect.description && (
                              <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                                {defect.description}
                              </div>
                            )}
                            {images.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {images.map((image) => (
                                  <a
                                    key={image}
                                    href={image}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="overflow-hidden rounded-2xl border border-border/70"
                                  >
                                    <img src={image} alt="Nuqson report rasmi" className="h-28 w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>

    {unitsBatch && (
      <SeedlingUnitsDialog
        batchId={unitsBatch.batchId}
        batchNumber={unitsBatch.batchNumber}
        batchQrPayload={unitsBatch.qrPayload}
        onClose={() => setUnitsBatch(null)}
      />
    )}

    {/* Admin: Partiyani tahrirlash dialogi */}
    <Dialog open={!!adminEditBatch} onOpenChange={(open) => !open && setAdminEditBatch(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Partiyani tahrirlash</DialogTitle>
          <DialogDescription>
            {adminEditBatch?.batchNumber} — nav, tur, payvandtag yoki eslatmani o'zgartiring.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Ko'chat turi</Label>
            <Select
              value={adminEditForm.seedlingTypeId}
              onValueChange={(v) => setAdminEditForm((f) => ({ ...f, seedlingTypeId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
              <SelectContent>
                {(seedlingTypes || []).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ko'chat navi</Label>
            <Select
              value={adminEditForm.varietyId}
              onValueChange={(v) => setAdminEditForm((f) => ({ ...f, varietyId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Navni tanlang..." /></SelectTrigger>
              <SelectContent>
                {(fruitVarieties || []).map((v: any) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payvandtag turi</Label>
            <Select
              value={adminEditForm.rootstockTypeId}
              onValueChange={(v) => setAdminEditForm((f) => ({ ...f, rootstockTypeId: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanlanmagan</SelectItem>
                {(rootstockTypes || []).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Partiya raqami</Label>
            <Input
              value={adminEditForm.batchCode}
              onChange={(e) => setAdminEditForm((f) => ({ ...f, batchCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Izoh</Label>
            <Textarea
              value={adminEditForm.notes}
              onChange={(e) => setAdminEditForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setAdminEditBatch(null)}>Bekor qilish</Button>
            <Button
              disabled={editBatchMutation.isPending}
              onClick={() => {
                if (!adminEditBatch) return;
                editBatchMutation.mutate({
                  batchId: adminEditBatch.batchId || adminEditBatch.id,
                  seedlingTypeId: adminEditForm.seedlingTypeId ? Number(adminEditForm.seedlingTypeId) : undefined,
                  varietyId: adminEditForm.varietyId ? Number(adminEditForm.varietyId) : undefined,
                  rootstockTypeId: adminEditForm.rootstockTypeId !== "none" ? Number(adminEditForm.rootstockTypeId) : undefined,
                  notes: adminEditForm.notes,
                  batchCode: adminEditForm.batchCode,
                });
              }}
            >
              {editBatchMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Hisobdan chiqarish dialogi */}
    {/* Hisobdan chiqarish tarixi dialogi */}
    <Dialog open={showWriteOffHistory} onOpenChange={setShowWriteOffHistory}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <Clock3 className="h-5 w-5" />
            Hisobdan chiqarish tarixi
          </DialogTitle>
          <DialogDescription>
            Joriy lokatsiyadan hisobdan chiqarilgan barcha ko'chatlar ro'yxati.
          </DialogDescription>
        </DialogHeader>
        {(writeOffs?.length ?? 0) === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Hozircha hisobdan chiqarish mavjud emas.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-orange-200/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-200/60 bg-orange-50/40">
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Partiya</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Nav</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Sabab</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Miqdor</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Sana</th>
                </tr>
              </thead>
              <tbody>
                {writeOffs!.map((w: any) => (
                  <tr key={w.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                      {w.batchCode || `#${w.batchId}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground font-medium">
                      {w.varietyName || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {w.note || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-orange-700">
                      -{formatCount(w.quantity)} ta
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {w.date ? new Date(w.date).toLocaleDateString("uz-UZ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={() => setShowWriteOffHistory(false)}>Yopish</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!writeOffBatch} onOpenChange={(open) => { if (!open) { setWriteOffBatch(null); setWriteOffForm({ quantity: "", note: "" }); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            Hisobdan chiqarish
          </DialogTitle>
          <DialogDescription>
            {writeOffBatch?.batchNumber} — qurib qolgan yoki yo'qolgan ko'chatlar sonini kiriting.
            Mavjud qoldiq: <span className="font-semibold text-foreground">{writeOffBatch?.quantityAvailable ?? (writeOffBatch ? writeOffBatch.quantity - writeOffBatch.defectiveQuantity : 0)} ta</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="write-off-qty">Chiqariladigan miqdor</Label>
            <Input
              id="write-off-qty"
              type="number"
              min="1"
              max={writeOffBatch?.quantityAvailable ?? undefined}
              placeholder="Masalan: 88"
              value={writeOffForm.quantity}
              onChange={(e) => setWriteOffForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="write-off-note">Sabab (ixtiyoriy)</Label>
            <Textarea
              id="write-off-note"
              placeholder="Masalan: qurib qoldi, kasallik..."
              value={writeOffForm.note}
              onChange={(e) => setWriteOffForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={() => setWriteOffBatch(null)}>Bekor qilish</Button>
          <Button
            className="bg-orange-600 text-white hover:bg-orange-700"
            disabled={writeOffMutation.isPending || !writeOffForm.quantity || Number(writeOffForm.quantity) <= 0}
            onClick={() => {
              if (!writeOffBatch) return;
              const inventoryId = writeOffBatch.inventoryId;
              if (!inventoryId) {
                toast.error("Inventar ID topilmadi. Sahifani yangilang.");
                return;
              }
              writeOffMutation.mutate({
                inventoryId: Number(inventoryId),
                quantity: Number(writeOffForm.quantity),
                note: writeOffForm.note.trim() || undefined,
              });
            }}
          >
            {writeOffMutation.isPending ? "Saqlanmoqda..." : "Hisobdan chiqarish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Admin: Partiyani o'chirish tasdiqi */}
    <Dialog open={!!deletingBatchId} onOpenChange={(open) => !open && setDeletingBatchId(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-600">Partiyani o'chirish</DialogTitle>
          <DialogDescription>
            Bu amalni bekor qilib bo'lmaydi. Partiya va unga tegishli barcha ma'lumotlar o'chiriladi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setDeletingBatchId(null)}>Bekor qilish</Button>
          <Button
            variant="destructive"
            disabled={deleteBatchMutation.isPending}
            onClick={() => deletingBatchId && deleteBatchMutation.mutate(deletingBatchId)}
          >
            {deleteBatchMutation.isPending ? "O'chirilmoqda..." : "Ha, o'chirilsin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}

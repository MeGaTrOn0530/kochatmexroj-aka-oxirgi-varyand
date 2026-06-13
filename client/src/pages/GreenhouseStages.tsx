import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BarChart3,
  Leaf,
  ListTodo,
  Plus,
  Sprout,
  TreePine,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  cassette: "Kasetada",
  grafting: "payvantlanmagan",
  grafted: "Payvantlangan",
  ready: "Tayyor",
};

const STAGE_ICONS: Record<string, typeof Leaf> = {
  cassette: Sprout,
  grafting: Leaf,
  grafted: TreePine,
  ready: BarChart3,
};

const STAGE_COLORS: Record<string, string> = {
  cassette: "bg-yellow-50 border-yellow-200 text-yellow-800",
  grafting: "bg-blue-50 border-blue-200 text-blue-800",
  grafted: "bg-green-50 border-green-200 text-green-800",
  ready: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

const STAGE_NUM_COLORS: Record<string, string> = {
  cassette: "text-yellow-700",
  grafting: "text-blue-700",
  grafted: "text-green-700",
  ready: "text-emerald-700",
};

const STAGES = ["cassette", "grafting", "grafted", "ready"];

function formatN(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(n);
}

function StageCard({
  stage,
  quantity,
}: {
  stage: string;
  quantity: number;
}) {
  const Icon = STAGE_ICONS[stage] || Leaf;
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-2xl border p-4 ${STAGE_COLORS[stage] || "bg-muted border-border"}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {STAGE_LABELS[stage] || stage}
        </span>
      </div>
      <div className={`text-3xl font-bold ${STAGE_NUM_COLORS[stage] || ""}`}>
        {formatN(quantity)}
      </div>
      <div className="text-[10px] opacity-60">ta ko'chat</div>
    </div>
  );
}

export default function GreenhouseStages() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [navDetailStage, setNavDetailStage] = useState<string | null>(null);

  const [moveForm, setMoveForm] = useState({
    fromStage: "cassette",
    toStage: "grafting",
    quantity: "",
    failedQuantity: "",
    defectQuantity: "",
    defectNotes: "",
    actionDate: new Date().toISOString().slice(0, 10),
    notes: "",
    seedlingTypeId: "",
    varietyId: "",
    rootstockTypeId: "",
    fromRootstockTypeId: "",
  });
  const [logSortByNav, setLogSortByNav] = useState(false);
  const [showDefectLog, setShowDefectLog] = useState(false);

  const [receiveForm, setReceiveForm] = useState({
    quantity: "",
    notes: "",
  });

  const { data: summary, isFetching: summaryLoading } = trpc.greenhouse.getSummary.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: seedlingTypes } = trpc.catalog.getSeedlingTypes.useQuery();
  const { data: fruitVarieties } = trpc.catalog.getFruitVarieties.useQuery();
  const { data: rootstockTypes } = trpc.catalog.getRootstockTypes.useQuery();

  const activeLocationId =
    selectedLocationId ||
    (user?.role === "agranom" ? user.locationId : null);

  const { data: varietyStock } = trpc.greenhouse.getVarietyStock.useQuery(
    activeLocationId as number,
    { enabled: !!activeLocationId }
  );

  const { data: defectLog } = trpc.greenhouse.getDefectLog.useQuery(
    activeLocationId as number,
    { enabled: !!activeLocationId }
  );

  const { data: detail } = trpc.greenhouse.getOne.useQuery(
    activeLocationId as number,
    { enabled: !!activeLocationId }
  );

  const { data: log } = trpc.greenhouse.getLog.useQuery(
    activeLocationId as number,
    { enabled: !!activeLocationId }
  );

  const moveMutation = trpc.greenhouse.move.useMutation({
    onSuccess: async (data: any) => {
      toast.success("Bosqich almashtirildi");
      setIsMoveDialogOpen(false);
      setMoveForm({
        fromStage: "cassette",
        toStage: "grafting",
        quantity: "",
        failedQuantity: "",
        defectQuantity: "",
        defectNotes: "",
        actionDate: new Date().toISOString().slice(0, 10),
        notes: "",
        seedlingTypeId: "",
        varietyId: "",
        rootstockTypeId: "",
        fromRootstockTypeId: "",
      });
      await utils.greenhouse.getSummary.invalidate();
      if (activeLocationId) {
        await utils.greenhouse.getOne.invalidate(activeLocationId);
        await utils.greenhouse.getLog.invalidate(activeLocationId);
        await utils.greenhouse.getDefectLog.invalidate(activeLocationId);
        await utils.greenhouse.getVarietyStock.invalidate(activeLocationId);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Bosqich almashtirib bo'lmadi");
    },
  });

  const receiveMutation = trpc.greenhouse.receive.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chatlar qabul qilindi");
      setIsReceiveDialogOpen(false);
      setReceiveForm({ quantity: "", notes: "" });
      await utils.greenhouse.getSummary.invalidate();
      if (activeLocationId) {
        await utils.greenhouse.getOne.invalidate(activeLocationId);
        await utils.greenhouse.getLog.invalidate(activeLocationId);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Qabul qilib bo'lmadi");
    },
  });

  const deleteLogMutation = trpc.greenhouse.deleteLog.useMutation({
    onSuccess: async () => {
      toast.success("Jurnal yozuvi bekor qilindi");
      await utils.greenhouse.getSummary.invalidate();
      if (activeLocationId) {
        await utils.greenhouse.getOne.invalidate(activeLocationId);
        await utils.greenhouse.getLog.invalidate(activeLocationId);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "O'chirib bo'lmadi");
    },
  });

  const canMove = ["admin", "bosh_agranom", "agranom"].includes(user?.role || "");
  const canDeleteLog = user?.role === "admin";

  const activeLocation = detail?.location;
  const stock = detail?.stock;

  const isGraftingToGrafted = moveForm.fromStage === "grafting" && moveForm.toStage === "grafted";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <TreePine className="h-8 w-8 text-green-600" />
            Teplitsa bosqichlari
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Har bir teplitsada qaysi bosqichda nechta ko'chat borligi va harakatlar tarixi.
            Jomboydan o'tkazilgan ko'chatlar avtomatik "Kasetada" bosqichida ko'rinadi.
          </p>
        </div>

        {/* Teplitsa tanlash (admin/bosh_agranom uchun) */}
        {user?.role !== "agranom" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Teplitsa:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!selectedLocationId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLocationId(null)}
              >
                Barchasi
              </Button>
              {(locations || []).map((loc: any) => (
                <Button
                  key={loc.id}
                  variant={selectedLocationId === loc.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLocationId(loc.id)}
                >
                  {loc.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Umumiy ko'rinish (tanlash yo'q bo'lganda) */}
        {!activeLocationId && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Barcha teplitsalar holati</h2>
            {summaryLoading ? (
              <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>
            ) : !(summary || []).length ? (
              <div className="rounded-2xl border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
                Hozircha ma'lumot yo'q. Jomboydan transfer amalga oshirib ko'chatlar kiriting.
              </div>
            ) : (
              <div className="space-y-4">
                {(summary || []).map((loc: any) => (
                  <div
                    key={loc.locationId}
                    className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-foreground">{loc.locationName}</h3>
                      <span className="text-xs text-muted-foreground">Jami: {formatN(loc.total)} ta</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {STAGES.map((stage) => (
                        <div
                          key={stage}
                          className={`rounded-xl border px-3 py-2 ${STAGE_COLORS[stage]}`}
                        >
                          <div className="text-[10px] font-semibold uppercase opacity-70">
                            {STAGE_LABELS[stage]}
                          </div>
                          <div className={`text-xl font-bold ${STAGE_NUM_COLORS[stage]}`}>
                            {formatN(loc[stage] || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLocationId(loc.locationId)}
                      >
                        Batafsil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bitta teplitsa ko'rinishi */}
        {activeLocationId && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {activeLocation?.name || `Teplitsa #${activeLocationId}`}
              </h2>
              {canMove && (
                <div className="flex gap-2">
                  {(user?.role === "admin" || user?.role === "bosh_agranom") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setIsReceiveDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Qo'lda kirim
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsMoveDialogOpen(true)}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Bosqich o'zgartirish
                  </Button>
                </div>
              )}
            </div>

            {/* 4 bosqich kartasi — bosganda nav breakdown ko'rsatiladi */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className="text-left"
                  onClick={() => setNavDetailStage(stage)}
                >
                  <StageCard
                    stage={stage}
                    quantity={stock?.[stage as keyof typeof stock] || 0}
                  />
                </button>
              ))}
            </div>

            {/* Jami */}
            <div className="rounded-xl bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
              Jami teplitsada: <span className="font-bold text-foreground">{formatN(stock?.total || 0)}</span> ta ko'chat
            </div>

            {/* Harakatlar tarixi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <ListTodo className="h-4 w-4 text-accent" />
                  Harakatlar tarixi
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowDefectLog(true)}
                  >
                    Nobut tarixi
                    {(defectLog || []).length > 0 && (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        {(defectLog || []).length}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={logSortByNav ? "border-green-400 text-green-700" : ""}
                    onClick={() => setLogSortByNav((v) => !v)}
                  >
                    Nav bo'yicha {logSortByNav ? "↑ faol" : "saralash"}
                  </Button>
                </div>
              </div>
              {!(log || []).length ? (
                <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                  Hali harakat kiritilmagan.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Sana</th>
                        <th className="px-4 py-2.5 text-left">Harakat</th>
                        <th className="px-4 py-2.5 text-left">Nav</th>
                        <th className="px-4 py-2.5 text-right">Miqdor</th>
                        <th className="px-4 py-2.5 text-left">Izoh</th>
                        <th className="px-4 py-2.5 text-left">Kim</th>
                        {canDeleteLog && <th className="px-4 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(logSortByNav
                        ? [...(log || [])].sort((a: any, b: any) =>
                            (a.varietyName || "").localeCompare(b.varietyName || "", "uz")
                          )
                        : (log || [])
                      ).map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {entry.actionDate
                              ? new Date(entry.actionDate).toLocaleDateString("uz-UZ")
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {entry.fromStage ? (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[entry.fromStage]}`}
                                >
                                  {STAGE_LABELS[entry.fromStage] || entry.fromStage}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[entry.toStage]}`}
                                >
                                  {STAGE_LABELS[entry.toStage] || entry.toStage}
                                </span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <Plus className="h-3 w-3 text-green-600" />
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[entry.toStage]}`}
                                >
                                  {STAGE_LABELS[entry.toStage] || entry.toStage}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Kirim</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-foreground">
                            {entry.varietyName
                              ? <span className="font-medium">{entry.varietyName}</span>
                              : <span className="text-muted-foreground">—</span>}
                            {entry.rootstockTypeName && (
                              <span className="ml-1 text-muted-foreground">/ {entry.rootstockTypeName}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">
                            {formatN(entry.quantity)}
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground text-xs">
                            {entry.notes || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {entry.createdByName || "—"}
                          </td>
                          {canDeleteLog && (
                            <td className="px-4 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-500 hover:text-red-700"
                                onClick={() =>
                                  deleteLogMutation.mutate({
                                    locationId: activeLocationId,
                                    logId: entry.id,
                                  })
                                }
                              >
                                Bekor
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav bo'yicha batafsil dialog */}
      <Dialog open={!!navDetailStage} onOpenChange={(o) => { if (!o) setNavDetailStage(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-green-600" />
              {navDetailStage ? STAGE_LABELS[navDetailStage] : ""} — nav bo'yicha
            </DialogTitle>
            <DialogDescription>
              Ushbu bosqichdagi ko'chatlar nav (tur) bo'yicha taqsimoti.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const rows = (varietyStock || []).filter((r: any) => r.stage === navDetailStage && r.quantity > 0);
            const actualQty = navDetailStage ? (stock?.[navDetailStage as keyof typeof stock] as number || 0) : 0;
            if (rows.length === 0) {
              return (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {actualQty > 0
                    ? `${STAGE_LABELS[navDetailStage!]} bosqichida ${formatN(actualQty)} ta ko'chat bor, lekin nav aniqlanmagan. Bosqich o'zgartirishda nav tanlang.`
                    : "Nav ma'lumoti mavjud emas. Bosqich o'zgartirishda nav tanlang."}
                </div>
              );
            }
            // logdagi yig'indi actual stock dan katta bo'lsa, proporsional ko'rsatamiz
            const varTotal = rows.reduce((s: number, r: any) => s + r.quantity, 0);
            const scale = varTotal > 0 && actualQty > 0 ? actualQty / varTotal : 1;
            const displayQty = (q: number) => Math.round(q * scale);
            return (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Nav</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Ko'chat turi</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Payvand turi</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Miqdor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {r.varietyName || <span className="text-muted-foreground italic">Aniqlanmagan</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {r.seedlingTypeName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {r.rootstockTypeName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">
                            {formatN(displayQty(r.quantity))} ta
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/60 bg-muted/20">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Jami</td>
                        <td className="px-4 py-2.5 text-right font-bold text-foreground">{formatN(actualQty)} ta</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setNavDetailStage(null)}>Yopish</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bosqich o'zgartirish dialogi */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bosqich o'zgartirish</DialogTitle>
            <DialogDescription>
              Ko'chatlar bir bosqichdan ikkinchisiga o'tkazildi. Miqdor va sana kiriting.
            </DialogDescription>
          </DialogHeader>

          {/* Joriy holat */}
          {stock && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-4">
              {STAGES.map((s) => (
                <div key={s} className="text-center">
                  <div className="text-[10px] text-muted-foreground">{STAGE_LABELS[s]}</div>
                  <div className={`text-lg font-bold ${STAGE_NUM_COLORS[s]}`}>
                    {formatN(stock[s as keyof typeof stock] || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Qayerdan</Label>
                <Select
                  value={moveForm.fromStage}
                  onValueChange={(v) =>
                    setMoveForm((f) => ({ ...f, fromStage: v, toStage: v === f.toStage ? STAGES[(STAGES.indexOf(v) + 1) % 4] : f.toStage }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qayerga</Label>
                <Select
                  value={moveForm.toStage}
                  onValueChange={(v) => setMoveForm((f) => ({ ...f, toStage: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.filter((s) => s !== moveForm.fromStage).map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Miqdor *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Nechta o'tkazildi"
                  value={moveForm.quantity}
                  onChange={(e) => setMoveForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input
                  type="date"
                  value={moveForm.actionDate}
                  onChange={(e) => setMoveForm((f) => ({ ...f, actionDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Joriy bosqichdagi navlar — barcha o'tishlarda ko'rinadi */}
            {(() => {
              const stageVars = (varietyStock || []).filter((r: any) => r.stage === moveForm.fromStage && r.quantity > 0);
              if (!stageVars.length) return null;
              const stageTotal = (stock?.[moveForm.fromStage as keyof typeof stock] as number) || 0;
              const sVarTotal = stageVars.reduce((s: number, r: any) => s + r.quantity, 0);
              const sScale = sVarTotal > 0 && stageTotal > 0 ? stageTotal / sVarTotal : 1;
              return (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-yellow-800">
                    {STAGE_LABELS[moveForm.fromStage]}da mavjud — jami {formatN(stageTotal)} ta (nav tanlash uchun bosing):
                  </p>
                  <div className="space-y-1">
                    {stageVars.map((r: any, i: number) => {
                      const fromIsRootstockOnly = ["cassette", "grafting"].includes(moveForm.fromStage);
                      const isSelected = fromIsRootstockOnly
                        ? moveForm.fromRootstockTypeId === String(r.rootstockTypeId)
                        : (moveForm.fromRootstockTypeId === String(r.rootstockTypeId) &&
                           String(moveForm.varietyId) === String(r.varietyId) &&
                           String(moveForm.seedlingTypeId) === String(r.seedlingTypeId));
                      return (
                      <button
                        key={i}
                        type="button"
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs border transition-colors ${
                          isSelected
                            ? "border-yellow-400 bg-yellow-100"
                            : "border-border/60 bg-background hover:bg-yellow-50"
                        }`}
                        onClick={() => setMoveForm((f) => {
                          const isRootstockOnly = ["cassette", "grafting"].includes(f.fromStage);
                          return {
                            ...f,
                            fromRootstockTypeId: r.rootstockTypeId ? String(r.rootstockTypeId) : "",
                            rootstockTypeId: r.rootstockTypeId ? String(r.rootstockTypeId) : f.rootstockTypeId,
                            ...(isRootstockOnly ? {} : {
                              varietyId: r.varietyId ? String(r.varietyId) : "",
                              seedlingTypeId: r.seedlingTypeId ? String(r.seedlingTypeId) : "",
                            }),
                          };
                        })}
                      >
                        <span className="font-medium">
                          {r.varietyName || "Aniqlanmagan nav"}
                          {r.seedlingTypeName ? ` · ${r.seedlingTypeName}` : ""}
                          {r.rootstockTypeName ? ` / ${r.rootstockTypeName}` : ""}
                        </span>
                        <span className="font-bold text-yellow-800">{formatN(Math.round(r.quantity * sScale))} ta</span>
                      </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Katalog: Ko'chat turi, Nav, Payvand turi — cassette/grafting uchun (grafted/ready sariq paneldan to'ldiriladi) */}
            {!["grafted", "ready"].includes(moveForm.fromStage) && (
            <div className="rounded-xl border border-green-200 bg-green-50/40 p-3 space-y-3">
              <p className="text-xs font-semibold text-green-800">Ko'chat ma'lumotlari (ixtiyoriy)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ko'chat turi</Label>
                  <Select
                    value={moveForm.seedlingTypeId || "none"}
                    onValueChange={(v) => setMoveForm((f) => ({ ...f, seedlingTypeId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aniqlanmagan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aniqlanmagan</SelectItem>
                      {(seedlingTypes || []).map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nav</Label>
                  <Select
                    value={moveForm.varietyId || "none"}
                    onValueChange={(v) => setMoveForm((f) => ({ ...f, varietyId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aniqlanmagan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aniqlanmagan</SelectItem>
                      {(fruitVarieties || []).map((v: any) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payvand turi</Label>
                  <Select
                    value={moveForm.rootstockTypeId || "none"}
                    onValueChange={(v) => setMoveForm((f) => ({ ...f, rootstockTypeId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aniqlanmagan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aniqlanmagan</SelectItem>
                      {(rootstockTypes || []).map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            )}

            {/* Payvant olmagan (qaytariladigan) — faqat grafting→grafted */}
            {isGraftingToGrafted && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <Label className="text-amber-800">
                  Payvant olmagan (qaytariladigan) soni
                </Label>
                <p className="text-xs text-amber-700">
                  Bu miqdor <strong>KASETADA</strong> bosqichiga qaytariladi. Masalan: 1000 ta payvantlanmagan uchun olganda, 900 ta oldi, 100 ta olmadi → 100 ni kiriting.
                </p>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={moveForm.failedQuantity}
                  onChange={(e) => setMoveForm((f) => ({ ...f, failedQuantity: e.target.value }))}
                />
              </div>
            )}

            {/* Nobut bo'lganlar — ixtiyoriy, barcha o'tishlarda */}
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2">
              <Label className="text-red-800 text-sm">Nobut bo'lganlar (ixtiyoriy)</Label>
              <p className="text-xs text-red-700">
                Ushbu bosqichda nobut bo'lgan ko'chatlar soni. <strong>{STAGE_LABELS[moveForm.fromStage]}</strong> bosqichidan ayiriladi.
              </p>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={moveForm.defectQuantity}
                onChange={(e) => setMoveForm((f) => ({ ...f, defectQuantity: e.target.value }))}
              />
              {Number(moveForm.defectQuantity) > 0 && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs text-red-700">Nobut sababi (ixtiyoriy)</Label>
                  <Input
                    placeholder="Masalan: kasallik, sovuq urdi..."
                    value={moveForm.defectNotes}
                    onChange={(e) => setMoveForm((f) => ({ ...f, defectNotes: e.target.value }))}
                    className="border-red-200"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Izoh (ixtiyoriy)</Label>
              <Textarea
                placeholder="Masalan: bugun barcha kasetadagilar payvantlanmagan bosqichiga o'tkazildi..."
                value={moveForm.notes}
                onChange={(e) => setMoveForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Bekor qilish</Button>
              <Button
                disabled={moveMutation.isPending || !moveForm.quantity || !moveForm.fromStage || !moveForm.toStage}
                onClick={() => {
                  if (!activeLocationId) return;
                  moveMutation.mutate({
                    locationId: activeLocationId,
                    fromStage: moveForm.fromStage,
                    toStage: moveForm.toStage,
                    quantity: Number(moveForm.quantity),
                    failedQuantity: moveForm.failedQuantity ? Number(moveForm.failedQuantity) : 0,
                    defectQuantity: moveForm.defectQuantity ? Number(moveForm.defectQuantity) : 0,
                    defectNotes: moveForm.defectNotes || undefined,
                    actionDate: moveForm.actionDate,
                    notes: moveForm.notes || undefined,
                    seedlingTypeId: moveForm.seedlingTypeId ? Number(moveForm.seedlingTypeId) : undefined,
                    varietyId: moveForm.varietyId ? Number(moveForm.varietyId) : undefined,
                    rootstockTypeId: moveForm.rootstockTypeId ? Number(moveForm.rootstockTypeId) : undefined,
                  });
                }}
              >
                {moveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nobut tarixi dialogi */}
      <Dialog open={showDefectLog} onOpenChange={setShowDefectLog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              Nobut bo'lganlar tarixi
            </DialogTitle>
            <DialogDescription>
              Bosqich almashtirishda nobut deb qayd etilgan ko'chatlar.
            </DialogDescription>
          </DialogHeader>
          {!(defectLog || []).length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Hali nobut qayd etilmagan.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Sana</th>
                    <th className="px-3 py-2.5 text-left">Bosqich</th>
                    <th className="px-3 py-2.5 text-left">Nav</th>
                    <th className="px-3 py-2.5 text-right">Nobut</th>
                    <th className="px-3 py-2.5 text-left">Sabab</th>
                    <th className="px-3 py-2.5 text-left">Kim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(defectLog || []).map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-red-50/30">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {entry.actionDate
                          ? new Date(entry.actionDate).toLocaleDateString("uz-UZ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {entry.fromStage && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[entry.fromStage] || "bg-muted"}`}>
                            {STAGE_LABELS[entry.fromStage] || entry.fromStage}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {entry.varietyName
                          ? <span className="font-medium">{entry.varietyName}</span>
                          : <span className="text-muted-foreground">—</span>}
                        {entry.rootstockTypeName && (
                          <span className="ml-1 text-muted-foreground">/ {entry.rootstockTypeName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-red-600">
                        {formatN(entry.quantity)} ta
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px] truncate text-xs text-muted-foreground">
                        {entry.notes || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {entry.createdByName || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 bg-muted/20">
                    <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Jami nobut</td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-600">
                      {formatN((defectLog || []).reduce((s: number, e: any) => s + e.quantity, 0))} ta
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setShowDefectLog(false)}>Yopish</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Qo'lda kirim dialogi */}
      <Dialog open={isReceiveDialogOpen} onOpenChange={setIsReceiveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Qo'lda kirim (Kasetada)</DialogTitle>
            <DialogDescription>
              Jomboydan kelgan ko'chatlarni qo'lda qayd eting. Transferlar avtomatik kiritiladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Miqdor *</Label>
              <Input
                type="number"
                min="1"
                placeholder="Nechta keldi"
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Izoh (ixtiyoriy)</Label>
              <Input
                placeholder="Masalan: manual kirim, 05.06.2026..."
                value={receiveForm.notes}
                onChange={(e) => setReceiveForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setIsReceiveDialogOpen(false)}>Bekor qilish</Button>
              <Button
                disabled={receiveMutation.isPending || !receiveForm.quantity}
                onClick={() => {
                  if (!activeLocationId) return;
                  receiveMutation.mutate({
                    locationId: activeLocationId,
                    quantity: Number(receiveForm.quantity),
                    notes: receiveForm.notes || undefined,
                  });
                }}
              >
                {receiveMutation.isPending ? "Kiritilmoqda..." : "Kiritish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

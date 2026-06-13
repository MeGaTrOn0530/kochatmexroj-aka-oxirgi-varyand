import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const stageLabel: Record<string, string> = {
  cassette: "Kasetada",
  sown: "Tuvakda",
  grafting: "Payvantlash",
  grafted: "Payvantlangan",
  ready: "Ko'chat (tayyor)",
};

const stageColor: Record<string, string> = {
  cassette: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sown: "bg-orange-100 text-orange-700 border-orange-300",
  grafting: "bg-orange-100 text-orange-700 border-orange-300",
  grafted: "bg-blue-100 text-blue-700 border-blue-300",
  ready: "bg-green-100 text-green-700 border-green-300",
};

// QR ko'rsatish uchun kichik komponent
function UnitQrCell({ payload }: { payload: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 64,
      margin: 1,
      color: { dark: "#15331a", light: "#f7fbf4" },
    });
  }, [payload]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-border/60"
      width={64}
      height={64}
    />
  );
}

// Stiker sayfasi ko'rinishi
function StickerView({
  batchCode,
  batchQrPayload,
  units,
  onBack,
}: {
  batchCode: string;
  batchQrPayload: string;
  units: any[];
  onBack: () => void;
}) {
  const batchCanvasRef = useRef<HTMLCanvasElement>(null);
  const unitCanvases = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    if (batchQrPayload && batchCanvasRef.current) {
      QRCode.toCanvas(batchCanvasRef.current, batchQrPayload, {
        width: 120,
        margin: 1,
        color: { dark: "#15331a", light: "#ffffff" },
      });
    }
  }, [batchQrPayload]);

  useEffect(() => {
    for (const unit of units) {
      const canvas = unitCanvases.current.get(unit.id);
      if (canvas && unit.qrPayload) {
        QRCode.toCanvas(canvas, unit.qrPayload, {
          width: 96,
          margin: 1,
          color: { dark: "#15331a", light: "#ffffff" },
        });
      }
    }
  }, [units]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          ← Jadval ko'rinishi
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const batchDataUrl = await QRCode.toDataURL(batchQrPayload, {
              width: 200, margin: 1, color: { dark: "#15331a", light: "#ffffff" },
            });
            const unitQrs = await Promise.all(
              units.map(async (u) => ({
                unit: u,
                dataUrl: u.qrPayload
                  ? await QRCode.toDataURL(u.qrPayload, { width: 160, margin: 1, color: { dark: "#15331a", light: "#ffffff" } })
                  : "",
              }))
            );
            const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"/><title>Stikerlar</title>
<style>
@page{size:30mm 30mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff}
.page{width:30mm;height:30mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}
img{width:28mm;height:28mm;display:block}
</style></head><body>
<div class="page"><img src="${batchDataUrl}"/></div>
${unitQrs.map(({ dataUrl }) => `<div class="page"><img src="${dataUrl}"/></div>`).join("")}
</body></html>`;
            const win = window.open("", "_blank", "width=960,height=720");
            if (win) { win.document.write(html); win.document.close(); win.focus(); win.onafterprint = () => win.close(); setTimeout(() => win.print(), 300); }
          }}
          className="gap-2 border-green-600 text-green-700 hover:bg-green-50"
        >
          <span>🖨️</span> Donalar Ro'yxati
        </Button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Chop etish ma'lumoti:</span> Siz bu yerdagi stikerlarni printer
        orqali to'g'ridan-to'g'ri maxsus stiker qog'oziga chiqarib, har bir ko'chat tasmalariga yoki
        kasetasiga yopishtirishingiz mumkin.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4">
        {/* Umumiy partiya stikeri */}
        <div className="flex items-center justify-center rounded-2xl border-2 border-green-400 bg-white p-2 shadow-sm aspect-square">
          <canvas
            ref={batchCanvasRef}
            width={120}
            height={120}
            className="rounded-md"
          />
        </div>

        {/* Har bir dona */}
        {units.map((unit) => (
          <div
            key={unit.id}
            className="flex items-center justify-center rounded-2xl border border-border/70 bg-white p-2 shadow-sm aspect-square"
          >
            <canvas
              ref={(el) => {
                if (el) {
                  unitCanvases.current.set(unit.id, el);
                  if (unit.qrPayload) {
                    QRCode.toCanvas(el, unit.qrPayload, {
                      width: 96,
                      margin: 1,
                      color: { dark: "#000000", light: "#ffffff" },
                    });
                  }
                }
              }}
              width={96}
              height={96}
              className="rounded-md"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  batchId: number;
  batchNumber: string;
  batchQrPayload?: string;
  onClose: () => void;
};

export default function SeedlingUnitsDialog({ batchId, batchNumber, batchQrPayload, onClose }: Props) {
  const [view, setView] = useState<"table" | "stickers" | "xprint">("table");
  const [xprintMode, setXprintMode] = useState<"grouped" | "individual">("grouped");

  const { data, isLoading } = trpc.seedlings.getUnits.useQuery(batchId, {
    enabled: batchId > 0,
  });

  const units = data?.units || [];
  const batch = data?.batch;
  const healthyCount = batch
    ? batch.quantityAvailable
    : units.filter((u) => !u.isDefective).length;
  const qrPayload = batchQrPayload || batchNumber;

  const handleCopyUnitCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Kod nusxalandi");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Partiya: {batchNumber}
              </h2>
              <p className="text-sm text-muted-foreground">
                Ushbu partiyadagi alohida ko'chat donalari va ularga biriktirilgan stikerlar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "table" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setView("stickers")}
                  className="gap-2 border-green-600 text-green-700 hover:bg-green-50"
                >
                  🖨️ QR Stiker Chop Etish
                </Button>
                <Button
                  size="sm"
                  onClick={() => setView("xprint")}
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  🖨️ X-PRINT™
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              Yuklanmoqda...
            </div>
          ) : view === "stickers" ? (
            <StickerView
              batchCode={batchNumber}
              batchQrPayload={qrPayload}
              units={units}
              onBack={() => setView("table")}
            />
          ) : view === "xprint" ? (
            <XPrintView
              batchCode={batchNumber}
              batchQrPayload={qrPayload}
              units={units}
              mode={xprintMode}
              onModeChange={setXprintMode}
              onClose={() => setView("table")}
            />
          ) : (
            <>
              {/* Info kartochkalar */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoCard label="Partiya kodu" value={batchNumber} mono />
                <InfoCard
                  label="Eshik o'rni"
                  value={batch?.locationName || "—"}
                />
                <InfoCard
                  label="Tiriklar soni"
                  value={`${healthyCount} / ${batch?.initialQuantity ?? units.length} ta`}
                  valueClass="text-green-600"
                />
                <InfoCard
                  label="Yaratilgan sana"
                  value={
                    batch?.receivedDate
                      ? new Date(batch.receivedDate).toLocaleDateString("uz-UZ")
                      : batch?.createdAt
                        ? new Date(batch.createdAt).toLocaleDateString("uz-UZ")
                        : "—"
                  }
                />
              </div>

              {/* Jadval */}
              {units.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>Dona yozuvlari topilmadi</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          T/R
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          Dona Kodu (ID)
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          Faol Bosqich
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          Nuqson bormi?
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          QR
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                          Amal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((unit) => (
                        <tr
                          key={unit.id}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            #{unit.unitNumber}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">
                            {unit.unitCode}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${stageColor[unit.currentStage] || "bg-gray-100 text-gray-700 border-gray-300"}`}
                            >
                              {stageLabel[unit.currentStage] || unit.currentStage}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {unit.isDefective ? (
                              <span className="font-semibold text-red-600">✗ Nuqsonli</span>
                            ) : (
                              <span className="font-semibold text-green-600">✓ Barkamol</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <UnitQrCell payload={unit.qrPayload} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleCopyUnitCode(unit.unitCode)}
                              className="text-xs text-blue-600 underline hover:text-blue-800"
                            >
                              Skanerlash orqali bosqich uzatish
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-sm font-bold ${valueClass || "text-foreground"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

// X-PRINT™ dialog ko'rinishi
function XPrintView({
  batchCode,
  batchQrPayload,
  units,
  mode,
  onModeChange,
  onClose,
}: {
  batchCode: string;
  batchQrPayload: string;
  units: any[];
  mode: "grouped" | "individual";
  onModeChange: (m: "grouped" | "individual") => void;
  onClose: () => void;
}) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const unitPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(units.map((u) => u.id)));

  // mode o'zgarganda: guruppaviy → barchasini tanlash, donali → bo'sh
  useEffect(() => {
    if (mode === "grouped") {
      setSelectedIds(new Set(units.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [mode, units]);

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    QRCode.toCanvas(previewCanvasRef.current, batchQrPayload, {
      width: 140,
      margin: 1,
      color: { dark: "#15331a", light: "#ffffff" },
    });
  }, [batchQrPayload]);

  const toggleUnit = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(units.map((u) => u.id)));
  const clearAll = () => setSelectedIds(new Set());

  const [isPrinting, setIsPrinting] = useState(false);
  const printableUnits = mode === "grouped" ? units : units.filter((u) => selectedIds.has(u.id));
  const printCount = mode === "grouped" ? units.length : selectedIds.size;

  useEffect(() => {
    if (!unitPreviewCanvasRef.current || !printableUnits[0]?.qrPayload) return;
    QRCode.toCanvas(unitPreviewCanvasRef.current, printableUnits[0].qrPayload, {
      width: 60,
      margin: 1,
      color: { dark: "#15331a", light: "#ffffff" },
    });
  }, [printableUnits]);

  const handlePrint = async () => {
    if (printCount === 0) {
      toast.error("Chop etish uchun kamida 1 ta dona tanlang");
      return;
    }

    setIsPrinting(true);
    try {
      // Batch QR data URL
      const batchQrDataUrl = await QRCode.toDataURL(batchQrPayload, {
        width: 200, margin: 1,
        color: { dark: "#15331a", light: "#ffffff" },
      });

      // Har bir tanlangan dona uchun QR
      const unitQrs: { unit: any; dataUrl: string }[] = [];
      for (const unit of printableUnits) {
        if (unit.qrPayload) {
          const dataUrl = await QRCode.toDataURL(unit.qrPayload, {
            width: 160, margin: 1,
            color: { dark: "#15331a", light: "#ffffff" },
          });
          unitQrs.push({ unit, dataUrl });
        }
      }

      const stageLabels: Record<string, string> = {
        cassette: "Kasetada", sown: "Tuvakda",
        grafting: "Payvantlash", grafted: "Payvantlangan", ready: "Ko'chat",
      };

      // Har bir stiker alohida 40x30mm sahifa — faqat QR kod
      const batchStikerHtml = `
<div class="page">
  <img src="${batchQrDataUrl}" alt="Batch QR" class="qr" />
</div>`;

      const unitStikerHtml = unitQrs.map(({ unit, dataUrl }) => `
<div class="page">
  <img src="${dataUrl}" alt="${unit.unitCode}" class="qr" />
</div>`).join("");

      const html = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>QR Stikerlar — ${batchCode}</title>
  <style>
    @page {
      size: 30mm 30mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; }
    .page {
      width: 30mm;
      height: 30mm;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .qr {
      width: 28mm;
      height: 28mm;
      display: block;
    }
  </style>
</head>
<body>
  ${batchStikerHtml}
  ${unitStikerHtml}
</body>
</html>`;

      const win = window.open("", "_blank", "width=960,height=720");
      if (!win) {
        toast.error("Pop-up bloker ochishni oldini oldi. Brauzer sozlamalarini tekshiring.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.onafterprint = () => win.close();
      setTimeout(() => win.print(), 300);

      toast.success(`${printCount} ta stiker chop etishga yuborildi`);
    } catch (err) {
      toast.error("QR generatsiyada xatolik");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* X-PRINT header */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-blue-700">
              🖨️ X-PRINT™: QR VA MARKALAR CHOP ETISH TIZIMI
            </div>
            <div className="mt-1 text-xs text-blue-600">
              Partiya: <span className="font-mono font-bold">{batchCode}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chap panel */}
        <div className="space-y-4">
          {/* 1. Chop etish turi */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              1. Chop etish turini tanlang
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onModeChange("grouped")}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                  mode === "grouped"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-border/60 bg-background text-foreground hover:bg-muted"
                }`}
              >
                📦 Guruppaviy
                <br />
                <span className="text-xs opacity-80">(Hamkorlikda)</span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange("individual")}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                  mode === "individual"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-border/60 bg-background text-foreground hover:bg-muted"
                }`}
              >
                🌱 Donali
                <br />
                <span className="text-xs opacity-80">(Yakka / Erkin)</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {mode === "grouped"
                ? "Barcha donalar birga chiqariladi — bosh partiya QR kodi + barcha dona kodlari."
                : "Faqat tanlangan donalar chiqariladi. Ro'yxatdan keraklilarini belgilang."}
            </p>
          </div>

          {/* 2. Chop etiluvchi donalar ro'yxati */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {mode === "individual" ? "Donalarni tanlang" : "Chop etiluvchi donalar"}
              </div>
              {mode === "individual" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-blue-600 underline hover:text-blue-800"
                  >
                    Barchasini tanlash
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] text-red-500 underline hover:text-red-700"
                  >
                    Bekor qilish
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {units.map((unit) => {
                const isSelected = mode === "grouped" || selectedIds.has(unit.id);
                return (
                  <div
                    key={unit.id}
                    onClick={() => mode === "individual" && toggleUnit(unit.id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                      mode === "individual"
                        ? "cursor-pointer hover:bg-blue-50"
                        : "bg-background"
                    } ${isSelected && mode === "individual" ? "bg-blue-50 border border-blue-200" : "bg-background"}`}
                  >
                    {mode === "individual" && (
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-border/60 bg-background"
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5 4.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                    <span className="w-7 shrink-0 text-muted-foreground">#{unit.unitNumber}</span>
                    <span className="flex-1 font-mono font-semibold text-foreground truncate">{unit.unitCode}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageColor[unit.currentStage] || "bg-gray-100 text-gray-700 border-gray-300"}`}
                    >
                      {stageLabel[unit.currentStage] || unit.currentStage}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 border-t border-border/40 pt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Jami: {units.length} ta</span>
              <span className="font-semibold text-blue-600">
                Chop etiluvchi: {printCount} ta
              </span>
            </div>
          </div>
        </div>

        {/* O'ng panel — preview */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            2. Termo-kasseta / Stikerlar roligi simulyatori
          </div>
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 p-4">
            <div className="text-xs text-muted-foreground">Preview (40mm × 30mm)</div>
            {/* Bosh partiya stikeri preview — 40x30 nisbatida */}
            <div
              className="rounded-xl border-2 border-green-400 bg-white shadow-md flex flex-col items-center justify-center gap-0.5"
              style={{ width: "160px", height: "120px", padding: "6px 8px" }}
            >
              <div className="rounded-full bg-green-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                PARTIYA
              </div>
              <canvas
                ref={previewCanvasRef}
                width={72}
                height={72}
                className="rounded"
              />
              <div className="font-mono text-[8px] font-bold text-foreground text-center leading-tight" style={{ wordBreak: "break-all", maxWidth: "148px" }}>{batchCode}</div>
              <div className="text-[7px] text-muted-foreground">{units.length} dona</div>
            </div>

            {/* Birinchi tanlangan dona preview */}
            {printableUnits[0] ? (
              <div
                className="rounded-xl border border-border/60 bg-white shadow-sm flex flex-col items-center justify-center gap-0.5"
                style={{ width: "160px", height: "130px", padding: "5px 8px" }}
              >
                <div className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[9px] font-semibold text-amber-800">
                  {stageLabel[printableUnits[0].currentStage] || printableUnits[0].currentStage}
                </div>
                <canvas
                  ref={unitPreviewCanvasRef}
                  width={60}
                  height={60}
                  className="rounded"
                />
                <div className="font-mono text-[7px] font-bold text-foreground text-center leading-tight" style={{ wordBreak: "break-all", maxWidth: "148px" }}>
                  {printableUnits[0].unitCode}
                </div>
                {printableUnits.length > 1 && (
                  <div className="text-[7px] text-muted-foreground">... va yana {printableUnits.length - 1} ta</div>
                )}
              </div>
            ) : mode === "individual" ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-700" style={{ width: "160px" }}>
                Hech qanday dona tanlanmagan
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between border-t border-border/60 pt-4">
        <Button variant="outline" onClick={onClose}>
          Bekor Qilish
        </Button>
        <Button
          onClick={handlePrint}
          disabled={printCount === 0 || isPrinting}
          className="gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPrinting ? "⏳ QR tayyorlanmoqda..." : `🖨️ ${mode === "grouped" ? "Barcha Markalarni" : `${printCount} ta Markani`} Chop Etish`}
        </Button>
      </div>
    </div>
  );
}

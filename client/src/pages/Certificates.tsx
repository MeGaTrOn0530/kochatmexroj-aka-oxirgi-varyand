import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Medal, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("uz-UZ");
}

const certTypeLabel: Record<string, string> = {
  quality: "Sifat sertifikati",
  phyto: "Fitosanitar sertifikat",
  origin: "Kelib chiqish sertifikati",
  other: "Boshqa",
};

const emptyForm = {
  batchId: "", certType: "quality", issuedTo: "", issueDate: new Date().toISOString().slice(0, 10),
  expiryDate: "", quantity: "", notes: "",
};

export default function CertificatesPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: certs } = trpc.certificates.getAll.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();

  const addMutation = trpc.certificates.add.useMutation({
    onSuccess: async () => {
      toast.success("Sertifikat yaratildi");
      setShowForm(false); setForm(emptyForm);
      await utils.certificates.getAll.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = trpc.certificates.updateStatus.useMutation({
    onSuccess: async () => { await utils.certificates.getAll.invalidate(); },
  });

  const handlePrint = (cert: any) => {
    const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"/>
<title>Sertifikat ${cert.certificate_number}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; color: #1a1a1a; background: #fff; }
  .header { text-align: center; border-bottom: 3px double #2d6a4f; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 11pt; font-weight: bold; letter-spacing: 3px; color: #2d6a4f; text-transform: uppercase; }
  .title { font-size: 28pt; font-weight: bold; letter-spacing: 6px; margin: 10px 0 4px; text-transform: uppercase; }
  .subtitle { font-size: 12pt; color: #555; }
  .body { max-width: 480px; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; border-bottom: 1px solid #e0e0e0; padding: 8px 0; }
  .row-label { font-size: 11pt; color: #666; }
  .row-value { font-size: 11pt; font-weight: bold; text-align: right; }
  .cert-num { text-align: center; margin: 24px 0 8px; font-family: monospace; font-size: 10pt; color: #888; letter-spacing: 2px; }
  .footer { margin-top: 50px; display: flex; justify-content: space-around; }
  .sign { text-align: center; width: 180px; }
  .sign-line { border-bottom: 1.5px solid #333; margin-bottom: 6px; height: 36px; }
  .sign-label { font-size: 10pt; color: #666; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 100pt; color: rgba(45,106,79,0.04); font-weight: bold; z-index: -1; }
</style>
</head><body>
<div class="watermark">KOCHAT</div>
<div class="header">
  <div class="logo">Ko'chat Yetishtirish Platformasi</div>
  <div class="title">SERTIFIKAT</div>
  <div class="subtitle">${certTypeLabel[cert.cert_type] || cert.cert_type}</div>
</div>
<div class="body">
  <div class="row"><span class="row-label">Kimga berildi</span><span class="row-value">${cert.issued_to}</span></div>
  ${cert.seedling_type ? `<div class="row"><span class="row-label">Ko'chat turi</span><span class="row-value">${cert.seedling_type}</span></div>` : ""}
  ${cert.variety_name ? `<div class="row"><span class="row-label">Nav</span><span class="row-value">${cert.variety_name}</span></div>` : ""}
  <div class="row"><span class="row-label">Miqdori</span><span class="row-value">${cert.quantity} ta</span></div>
  ${cert.location_name ? `<div class="row"><span class="row-label">Lokatsiya</span><span class="row-value">${cert.location_name}</span></div>` : ""}
  <div class="row"><span class="row-label">Berilgan sana</span><span class="row-value">${formatDate(cert.issue_date)}</span></div>
  ${cert.expiry_date ? `<div class="row"><span class="row-label">Amal qilish muddati</span><span class="row-value">${formatDate(cert.expiry_date)}</span></div>` : ""}
  ${cert.notes ? `<div class="row"><span class="row-label">Izoh</span><span class="row-value">${cert.notes}</span></div>` : ""}
</div>
<div class="cert-num">№ ${cert.certificate_number}</div>
<div class="footer">
  <div class="sign"><div class="sign-line"></div><div class="sign-label">Sana / Date</div></div>
  <div class="sign"><div class="sign-line"></div><div class="sign-label">Imzo / Signature</div></div>
  <div class="sign"><div class="sign-line"></div><div class="sign-label">Muhr / Seal</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=750");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.onafterprint = () => w.close();
      setTimeout(() => w.print(), 350);
    }
  };

  const rows = certs || [];
  const activeCount = rows.filter((c: any) => c.status === "active").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Medal className="h-8 w-8 text-accent" />
            Sifat sertifikatlari
          </h1>
          <p className="mt-1 text-muted-foreground">Ko'chatlar uchun sifat, fitosanitar va kelib chiqish sertifikatlarini yarating va chop eting.</p>
        </div>

        {/* Stat */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Jami sertifikat", value: rows.length, color: "text-foreground" },
            { label: "Faol", value: activeCount, color: "text-green-600" },
            { label: "Muddati o'tgan", value: rows.length - activeCount, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="card-elegant">
              <CardContent className="pt-4 text-center">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button className="gap-2" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4" /> Yangi sertifikat yaratish
        </Button>

        {/* Forma */}
        {showForm && (
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="text-base">Yangi sertifikat</CardTitle>
              <CardDescription>Partiya yoki buyurtma uchun sertifikat yarating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Sertifikat turi</Label>
                  <Select value={form.certType} onValueChange={v => setForm(f => ({ ...f, certType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(certTypeLabel).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Partiya (ixtiyoriy)</Label>
                  <Select value={form.batchId} onValueChange={v => setForm(f => ({ ...f, batchId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bog'liq emas</SelectItem>
                      {(batches || []).map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.batchNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kimga berildi *</Label>
                  <Input value={form.issuedTo} onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Berilgan sana *</Label>
                  <Input type="date" value={form.issueDate}
                    onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Amal qilish muddati</Label>
                  <Input type="date" value={form.expiryDate}
                    onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Miqdori (ta)</Label>
                  <Input type="number" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Izoh</Label>
                <Textarea rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Bekor</Button>
                <Button
                  disabled={!form.issuedTo || !form.issueDate || addMutation.isPending}
                  onClick={() => addMutation.mutate({
                    batchId: form.batchId && form.batchId !== "none" ? Number(form.batchId) : undefined,
                    certType: form.certType, issuedTo: form.issuedTo,
                    issueDate: form.issueDate, expiryDate: form.expiryDate || undefined,
                    quantity: Number(form.quantity || 0), notes: form.notes || undefined,
                  })}>
                  Yaratish
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sertifikatlar grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c: any) => (
            <div key={c.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
              <div className={`h-1 w-full ${c.status === "active" ? "bg-accent" : "bg-red-300"}`} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-sm">{certTypeLabel[c.cert_type] || c.cert_type}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{c.issued_to}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}`}>
                    {c.status === "active" ? "Faol" : "Muddati o'tgan"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {c.seedling_type && (
                    <div className="rounded-lg bg-muted/30 px-2.5 py-2">
                      <div className="text-muted-foreground">Ko'chat turi</div>
                      <div className="font-semibold text-foreground mt-0.5">{c.seedling_type}</div>
                    </div>
                  )}
                  <div className="rounded-lg bg-muted/30 px-2.5 py-2">
                    <div className="text-muted-foreground">Miqdori</div>
                    <div className="font-semibold text-foreground mt-0.5">{c.quantity} ta</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-2.5 py-2">
                    <div className="text-muted-foreground">Berilgan</div>
                    <div className="font-semibold text-foreground mt-0.5">{formatDate(c.issue_date)}</div>
                  </div>
                  {c.expiry_date && (
                    <div className="rounded-lg bg-muted/30 px-2.5 py-2">
                      <div className="text-muted-foreground">Muddat</div>
                      <div className="font-semibold text-foreground mt-0.5">{formatDate(c.expiry_date)}</div>
                    </div>
                  )}
                </div>

                <div className="font-mono text-[10px] text-muted-foreground">№ {c.certificate_number}</div>

                <div className="mt-auto flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => handlePrint(c)}>
                    <Printer className="h-3.5 w-3.5" /> Chop etish
                  </Button>
                  {c.status === "active" && (
                    <Button size="sm" variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                      onClick={() => statusMutation.mutate({ id: c.id, status: "expired" })}>
                      Bekor
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!rows.length && (
          <div className="py-16 text-center">
            <Medal className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Sertifikatlar yo'q</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

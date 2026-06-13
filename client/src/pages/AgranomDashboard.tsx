import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Leaf, MapPin, TreePine, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const STAGE_LABELS: Record<string, string> = {
  cassette: "Kasetada",
  grafting: "Payvantlash",
  grafted: "Payvantlangan",
  ready: "Tayyor",
};

const STAGE_COLORS: Record<string, string> = {
  cassette: "text-yellow-600",
  grafting: "text-blue-600",
  grafted: "text-green-600",
  ready: "text-emerald-700",
};

export default function AgranomDashboard() {
  const { user } = useAuth();
  const { data: locations } = trpc.locations.getAll.useQuery();

  const myLocationData = (locations || []).find((l: any) => l.id === user?.locationId);
  const isJomboy = Boolean(myLocationData?.isSource);

  if (user?.role !== "agranom") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="card-elegant max-w-md">
            <CardHeader><CardTitle>Ruxsat Rad Etildi</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Bu sahifa faqat agronom uchun mavjud.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const myLocation = myLocationData;

  // Teplitsa uchun greenhouse stock
  const { data: ghDetail } = trpc.greenhouse.getOne.useQuery(
    user.locationId as number,
    { enabled: !isJomboy && !!user.locationId }
  );
  const stock = ghDetail?.stock;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            {isJomboy
              ? <Leaf className="h-8 w-8 text-accent" />
              : <TreePine className="h-8 w-8 text-green-600" />}
            {isJomboy ? "Jomboy — Ko'chat yetishtirish" : "Teplitsa boshqaruvi"}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {isJomboy
              ? "Partiya yaratish, bosqich yangilash, nuqsonlarni qayd etish va teplitsalarga transfer qilish."
              : "Jomboydan kelgan ko'chatlarni bosqichlarda boshqarish va tarix kuzatish."}
          </p>
          {myLocation && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{myLocation.name}</span>
              {isJomboy && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  JOMBOY / MANBA
                </span>
              )}
            </div>
          )}
        </div>


        {/* Teplitsa bosqichlari (faqat teplitsa uchun) */}
        {!isJomboy && stock && (
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Teplitsa bosqichlari (umumiy qoldiq)
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["cassette", "grafting", "grafted", "ready"].map((stage) => (
                <Card key={stage} className="card-elegant">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {STAGE_LABELS[stage]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${STAGE_COLORS[stage]}`}>
                      {(stock as any)[stage] || 0}
                    </div>
                    <p className="text-[10px] text-muted-foreground">ta ko'chat</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Havolalar */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="card-elegant">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Leaf className="h-5 w-5" />
              </div>
              <CardTitle>Ko'chat partiyalari</CardTitle>
              <CardDescription>
                {isJomboy
                  ? "Yangi partiya yaratish, bosqich yangilash va nuqson qayd etish."
                  : "Teplitsaga kelgan partiyalarni ko'rish va bosqich yangilash."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/seedlings" className="btn-primary block w-full text-center">Ochish</a>
            </CardContent>
          </Card>

          {!isJomboy && (
            <Card className="card-elegant">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <TreePine className="h-5 w-5" />
                </div>
                <CardTitle>Teplitsa bosqichlari</CardTitle>
                <CardDescription>Bosqich o'zgartirish va harakatlar jurnali.</CardDescription>
              </CardHeader>
              <CardContent>
                <a href="/greenhouse-stages" className="btn-primary block w-full text-center">Ochish</a>
              </CardContent>
            </Card>
          )}

          <Card className="card-elegant">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Truck className="h-5 w-5" />
              </div>
              <CardTitle>Transferlar</CardTitle>
              <CardDescription>
                {isJomboy
                  ? "Teplitsalarga ko'chat yuborish."
                  : "Jomboydan kelgan ko'chatlarni qabul qilish."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/transfers" className="btn-primary block w-full text-center">Ochish</a>
            </CardContent>
          </Card>
        </div>

        {!user.locationId && (
          <Card className="card-elegant border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-5 w-5" />
                Lokatsiya biriktirilmagan
              </CardTitle>
              <CardDescription className="text-amber-800">
                Admin bu agronomga Jomboy yoki teplitsa lokatsiyasini biriktirsa, panel avtomatik moslashadi.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

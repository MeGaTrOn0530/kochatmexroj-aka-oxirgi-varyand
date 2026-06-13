import { useAuth } from "@/_core/hooks/useAuth";
import { getDashboardPathByRole, getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import AppFooter from "@/components/AppFooter";
import { ArrowRight, Filter, Leaf, Send, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type CustomerProductCard = {
  id: number;
  name: string;
  description: string;
  price: number;
  imagePath: string | null;
  contactPhone: string;
  contactPhoneSecondary: string;
  contactNote: string;
};

type SortOption = "default" | "price_asc" | "price_desc" | "name_asc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Hammasi",
  price_asc: "Narxi ↑",
  price_desc: "Narxi ↓",
  name_asc: "Nomi (A-Z)",
};

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<CustomerProductCard | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceInit, setPriceInit] = useState(false);

  const dashboardPath = getDashboardPathByRole(user?.role);
  const { data: customerProducts } = trpc.customerProducts.getPublic.useQuery();
  const { data: publicConfig } = trpc.telegram.getPublicConfig.useQuery();
  const publicProducts = (customerProducts || []) as CustomerProductCard[];

  const botUsername = (publicConfig as any)?.botUsername as string | null | undefined;

  // Compute price bounds from products
  const [minPrice, maxPrice] = useMemo(() => {
    if (!publicProducts.length) return [0, 0];
    const prices = publicProducts.map(p => p.price || 0);
    return [Math.min(...prices), Math.max(...prices)];
  }, [publicProducts]);

  useEffect(() => {
    if (!priceInit && publicProducts.length) {
      setPriceRange([minPrice, maxPrice]);
      setPriceInit(true);
    }
  }, [minPrice, maxPrice, priceInit, publicProducts.length]);

  const filteredProducts = useMemo(() => {
    let list = [...publicProducts];
    // price filter
    list = list.filter(p => (p.price || 0) >= priceRange[0] && (p.price || 0) <= priceRange[1]);
    // sort
    if (sortBy === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [publicProducts, priceRange, sortBy]);

  useEffect(() => {
    if (!loading && user && dashboardPath !== "/") {
      setLocation(dashboardPath);
    }
  }, [dashboardPath, loading, setLocation, user]);

  useEffect(() => {
    setShowContactInfo(false);
  }, [selectedProduct?.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin">
          <Leaf className="h-12 w-12 text-accent" />
        </div>
      </div>
    );
  }

  if (user) return null;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("uz-UZ", { style: "currency", currency: "UZS", maximumFractionDigits: 0 }).format(price || 0);

  const toTelHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

  const isFiltered = sortBy !== "default" || priceRange[0] !== minPrice || priceRange[1] !== maxPrice;

  const resetFilters = () => {
    setSortBy("default");
    setPriceRange([minPrice, maxPrice]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,240,0.96))]">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">SAMARQAND QULUPNAY IMPEKS MChJ</p>
              <p className="text-xs text-muted-foreground">Ko'chat yetishtirish va sotish</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {botUsername && (
              <Button
                variant="outline"
                className="hidden gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 sm:flex dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                onClick={() => window.open(`https://t.me/${botUsername}`, "_blank")}
              >
                <Send className="h-4 w-4" />
                Bot orqali buyurtma
              </Button>
            )}
            <Button onClick={() => (window.location.href = getLoginUrl())} className="gap-2">
              Login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main ─────────────────────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 gap-0 px-4 py-6 sm:px-6 lg:gap-6">

        {/* Filter sidebar — desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-5 rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-accent" />
                Filtr
              </h2>
              {isFiltered && (
                <button onClick={resetFilters} className="text-xs text-accent hover:underline">
                  Tozalash
                </button>
              )}
            </div>

            {/* Sort */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saralash</p>
              <div className="space-y-1">
                {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      sortBy === opt
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            {maxPrice > minPrice && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Narx</p>
                <Slider
                  min={minPrice}
                  max={maxPrice}
                  step={Math.max(1, Math.floor((maxPrice - minPrice) / 100))}
                  value={priceRange}
                  onValueChange={v => setPriceRange(v as [number, number])}
                  className="mb-3"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Dan</p>
                    <Input
                      type="number"
                      value={priceRange[0]}
                      min={minPrice}
                      max={priceRange[1]}
                      onChange={e => setPriceRange([Math.max(minPrice, Number(e.target.value)), priceRange[1]])}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Gacha</p>
                    <Input
                      type="number"
                      value={priceRange[1]}
                      min={priceRange[0]}
                      max={maxPrice}
                      onChange={e => setPriceRange([priceRange[0], Math.min(maxPrice, Number(e.target.value))])}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {botUsername && (
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
              >
                <Send className="h-4 w-4 shrink-0" />
                Bot orqali buyurtma berish
              </a>
            )}
          </div>
        </aside>

        {/* Products */}
        <main className="min-w-0 flex-1">
          {/* Mobile filter bar */}
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setShowFilter(f => !f)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                showFilter ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtr
              {isFiltered && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
              ))}
            </select>
            {isFiltered && (
              <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Tozalash
              </button>
            )}
          </div>

          {/* Mobile filter panel */}
          {showFilter && (
            <div className="mb-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm lg:hidden">
              {maxPrice > minPrice && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Narx</p>
                  <Slider
                    min={minPrice}
                    max={maxPrice}
                    step={Math.max(1, Math.floor((maxPrice - minPrice) / 100))}
                    value={priceRange}
                    onValueChange={v => setPriceRange(v as [number, number])}
                    className="mb-3"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Dan: {formatPrice(priceRange[0])}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground text-right">Gacha: {formatPrice(priceRange[1])}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!filteredProducts.length ? (
            <Card className="card-elegant border-dashed border-border/70 bg-background/70">
              <CardContent className="py-10 text-center">
                <p className="font-medium text-foreground">
                  {publicProducts.length ? "Filtr bo'yicha mahsulot topilmadi" : "Hozircha sotuv kartalari joylanmagan"}
                </p>
                {publicProducts.length > 0 && (
                  <button onClick={resetFilters} className="mt-2 text-sm text-accent hover:underline">
                    Filtrni tozalash
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedProduct(product)}
                >
                  <Card className="card-elegant overflow-hidden border-border/70 bg-background/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                    <div className="relative h-56 bg-muted/20">
                      {product.imagePath ? (
                        <img src={product.imagePath} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          Rasm yo'q
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-accent shadow-sm">
                        {formatPrice(product.price)}
                      </div>
                    </div>
                    <CardHeader className="space-y-2 pb-3">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[2.5rem] text-sm">
                        {product.description || "Ko'chat bo'yicha qisqa izoh kiritilmagan."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="rounded-xl bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground">
                        Batafsil ko'rish →
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ─── Product detail dialog ────────────────────────────────────────────── */}
      <Dialog open={selectedProduct !== null} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          {selectedProduct ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedProduct.name}</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {formatPrice(selectedProduct.price)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="overflow-hidden rounded-3xl border border-border/70 bg-muted/20">
                  {selectedProduct.imagePath ? (
                    <img
                      src={selectedProduct.imagePath}
                      alt={selectedProduct.name}
                      className="h-full max-h-[70vh] w-full object-cover"
                    />
                  ) : (
                    <div className="flex min-h-[24rem] items-center justify-center text-muted-foreground">
                      Rasm yo'q
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <div className="rounded-3xl bg-muted/30 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ko'chat ma'lumoti</div>
                    <div className="mt-3 text-base leading-7 text-foreground">
                      {selectedProduct.description || "Bu ko'chat uchun izoh kiritilmagan."}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background p-5">
                    <div className="text-sm text-muted-foreground">Narxi</div>
                    <div className="mt-2 text-3xl font-bold text-accent">{formatPrice(selectedProduct.price)}</div>
                  </div>
                  <Button size="lg" className="gap-2" onClick={() => setShowContactInfo(true)}>
                    Buyurtma uchun bog'lanish
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {botUsername && (
                    <a
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      <Send className="h-4 w-4" />
                      Telegram bot orqali buyurtma berish
                    </a>
                  )}
                  {showContactInfo && (
                    <div className="rounded-3xl border border-accent/20 bg-accent/5 p-5">
                      <div className="text-sm font-semibold text-foreground">Bog'lanish uchun raqamlar</div>
                      <div className="mt-3 space-y-3 text-sm">
                        {selectedProduct.contactPhone ? (
                          <a
                            href={toTelHref(selectedProduct.contactPhone)}
                            className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/40"
                          >
                            <span>Asosiy raqam</span>
                            <span>{selectedProduct.contactPhone}</span>
                          </a>
                        ) : null}
                        {selectedProduct.contactPhoneSecondary ? (
                          <a
                            href={toTelHref(selectedProduct.contactPhoneSecondary)}
                            className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/40"
                          >
                            <span>Qo'shimcha raqam</span>
                            <span>{selectedProduct.contactPhoneSecondary}</span>
                          </a>
                        ) : null}
                        {selectedProduct.contactNote ? (
                          <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-muted-foreground">
                            {selectedProduct.contactNote}
                          </div>
                        ) : null}
                        {!selectedProduct.contactPhone && !selectedProduct.contactPhoneSecondary ? (
                          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-muted-foreground">
                            Admin hali bu karta uchun bog'lanish raqamini qoldirmagan.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AppFooter />
    </div>
  );
}

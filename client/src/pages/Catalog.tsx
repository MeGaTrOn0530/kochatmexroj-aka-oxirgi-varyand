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
import { useAuth } from "@/_core/hooks/useAuth";
import { Edit2, GitBranch, Layers3, Leaf, Plus, Sprout, X } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type EditableType = {
  id: number;
  name: string;
  description: string;
};

type EditableVariety = {
  id: number;
  seedlingTypeId: string;
  name: string;
  description: string;
};

type CatalogSection = "rootstock" | "seedlingType" | "variety";

export default function CatalogPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isRootstockDialogOpen, setIsRootstockDialogOpen] = useState(false);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isVarietyDialogOpen, setIsVarietyDialogOpen] = useState(false);
  const [activeCatalogSection, setActiveCatalogSection] = useState<CatalogSection | null>(null);
  const [editingRootstock, setEditingRootstock] = useState<EditableType | null>(null);
  const [editingType, setEditingType] = useState<EditableType | null>(null);
  const [editingVariety, setEditingVariety] = useState<EditableVariety | null>(null);
  const [rootstockForm, setRootstockForm] = useState({
    name: "",
    description: "",
  });
  const [typeForm, setTypeForm] = useState({
    name: "",
    description: "",
  });
  const [varietyForm, setVarietyForm] = useState({
    seedlingTypeId: "",
    name: "",
    description: "",
  });

  const { data: rootstockTypes } = trpc.catalog.getRootstockTypes.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: seedlingTypes } = trpc.catalog.getSeedlingTypes.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: varieties } = trpc.catalog.getFruitVarieties.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const invalidateCatalog = async () => {
    await Promise.all([
      utils.catalog.getRootstockTypes.invalidate(),
      utils.catalog.getSeedlingTypes.invalidate(),
      utils.catalog.getFruitVarieties.invalidate(),
    ]);
  };

  const createRootstockMutation = trpc.admin.createRootstockType.useMutation({
    onSuccess: async () => {
      toast.success("Payvand turi qo'shildi");
      setRootstockForm({ name: "", description: "" });
      setIsRootstockDialogOpen(false);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Payvand turi saqlanmadi");
    },
  });

  const updateRootstockMutation = trpc.admin.updateRootstockType.useMutation({
    onSuccess: async () => {
      toast.success("Payvand turi yangilandi");
      setEditingRootstock(null);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Payvand turi yangilanmadi");
    },
  });

  const deleteRootstockMutation = trpc.admin.deleteRootstockType.useMutation({
    onSuccess: async () => {
      toast.success("Payvand turi o'chirildi");
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Payvand turi o'chirilmadi");
    },
  });

  const createTypeMutation = trpc.admin.createSeedlingType.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chat turi qo'shildi");
      setTypeForm({ name: "", description: "" });
      setIsTypeDialogOpen(false);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Ko'chat turi saqlanmadi");
    },
  });

  const updateTypeMutation = trpc.admin.updateSeedlingType.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chat turi yangilandi");
      setEditingType(null);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Ko'chat turi yangilanmadi");
    },
  });

  const deleteTypeMutation = trpc.admin.deleteSeedlingType.useMutation({
    onSuccess: async () => {
      toast.success("Ko'chat turi o'chirildi");
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Ko'chat turi o'chirilmadi");
    },
  });

  const createVarietyMutation = trpc.admin.createFruitVariety.useMutation({
    onSuccess: async () => {
      toast.success("Nav qo'shildi");
      setVarietyForm({ seedlingTypeId: "", name: "", description: "" });
      setIsVarietyDialogOpen(false);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Nav saqlanmadi");
    },
  });

  const updateVarietyMutation = trpc.admin.updateFruitVariety.useMutation({
    onSuccess: async () => {
      toast.success("Nav yangilandi");
      setEditingVariety(null);
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Nav yangilanmadi");
    },
  });

  const deleteVarietyMutation = trpc.admin.deleteFruitVariety.useMutation({
    onSuccess: async () => {
      toast.success("Nav o'chirildi");
      await invalidateCatalog();
    },
    onError: (error) => {
      toast.error(error.message || "Nav o'chirilmadi");
    },
  });

  const typeNameById = useMemo(
    () => new Map((seedlingTypes || []).map((type) => [type.id, type.name])),
    [seedlingTypes]
  );

  const catalogSummary = useMemo(
    () => [
      {
        key: "rootstock" as CatalogSection,
        label: "Payvand turi",
        value: rootstockTypes?.length || 0,
        hint: "Rootstock katalogi",
        icon: GitBranch,
      },
      {
        key: "seedlingType" as CatalogSection,
        label: "Ko'chat turi",
        value: seedlingTypes?.length || 0,
        hint: "Asosiy mahsulot guruhlari",
        icon: Leaf,
      },
      {
        key: "variety" as CatalogSection,
        label: "Nav",
        value: varieties?.length || 0,
        hint: "Tur bo'yicha bog'langan nomlar",
        icon: Sprout,
      },
    ],
    [rootstockTypes?.length, seedlingTypes?.length, varieties?.length]
  );

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat Rad Etildi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Katalogni boshqarish uchun admin roli kerak.
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
              <Layers3 className="h-8 w-8 text-accent" />
              Katalog
            </h1>
            <p className="mt-1 text-muted-foreground">
              Ko'chat turlari va navlar bazasini boshqaring.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Dialog open={isRootstockDialogOpen} onOpenChange={setIsRootstockDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Payvand turi
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi payvand turi</DialogTitle>
                  <DialogDescription>
                    Payvandtag yoki rootstock nomini alohida katalogga qo'shing.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="rootstock-type-name">Nomi</Label>
                    <Input
                      id="rootstock-type-name"
                      placeholder="GARNEM"
                      value={rootstockForm.name}
                      onChange={(event) =>
                        setRootstockForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rootstock-type-description">Izoh</Label>
                    <Input
                      id="rootstock-type-description"
                      placeholder="Bodom va shaftoli uchun rootstock"
                      value={rootstockForm.description}
                      onChange={(event) =>
                        setRootstockForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsRootstockDialogOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button
                      onClick={() =>
                        createRootstockMutation.mutate({
                          name: rootstockForm.name.trim(),
                          description: rootstockForm.description.trim() || undefined,
                        })
                      }
                      disabled={createRootstockMutation.isPending || !rootstockForm.name.trim()}
                    >
                      {createRootstockMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Ko'chat turi
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi ko'chat turi</DialogTitle>
                  <DialogDescription>
                    Partiya yaratishda ko'rinadigan tur nomini qo'shing.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="seedling-type-name">Nomi</Label>
                    <Input
                      id="seedling-type-name"
                      placeholder="Pomidor ko'chati"
                      value={typeForm.name}
                      onChange={(event) =>
                        setTypeForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seedling-type-description">Izoh</Label>
                    <Input
                      id="seedling-type-description"
                      placeholder="Issiqxona va ochiq dala uchun"
                      value={typeForm.description}
                      onChange={(event) =>
                        setTypeForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button
                      onClick={() =>
                        createTypeMutation.mutate({
                          name: typeForm.name.trim(),
                          description: typeForm.description.trim() || undefined,
                        })
                      }
                      disabled={createTypeMutation.isPending || !typeForm.name.trim()}
                    >
                      {createTypeMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isVarietyDialogOpen} onOpenChange={setIsVarietyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Sprout className="h-4 w-4" />
                  Nav
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi nav</DialogTitle>
                  <DialogDescription>
                    Ko'chat turiga tegishli navni katalogga qo'shing.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Ko'chat turi</Label>
                    <Select
                      value={varietyForm.seedlingTypeId}
                      onValueChange={(value) =>
                        setVarietyForm((current) => ({
                          ...current,
                          seedlingTypeId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {seedlingTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="variety-name">Nav nomi</Label>
                    <Input
                      id="variety-name"
                      placeholder="Volgograd"
                      value={varietyForm.name}
                      onChange={(event) =>
                        setVarietyForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="variety-description">Izoh</Label>
                    <Input
                      id="variety-description"
                      placeholder="Eksportbop yoki erta pishar nav"
                      value={varietyForm.description}
                      onChange={(event) =>
                        setVarietyForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsVarietyDialogOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button
                      onClick={() =>
                        createVarietyMutation.mutate({
                          seedlingTypeId: Number(varietyForm.seedlingTypeId),
                          name: varietyForm.name.trim(),
                          description: varietyForm.description.trim() || undefined,
                        })
                      }
                      disabled={
                        createVarietyMutation.isPending ||
                        !varietyForm.seedlingTypeId ||
                        !varietyForm.name.trim()
                      }
                    >
                      {createVarietyMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {catalogSummary.map((item) => {
            const Icon = item.icon;
            const isActive = activeCatalogSection === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  setActiveCatalogSection((current) => (current === item.key ? null : item.key))
                }
                className="text-left"
              >
                <Card
                  className={`card-elegant border-border/70 bg-background/85 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg ${
                    isActive ? "border-accent/50 ring-2 ring-accent/15 shadow-lg" : ""
                  }`}
                >
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 text-3xl font-bold text-foreground">{item.value}</div>
                      <div className="text-sm text-muted-foreground">{item.hint}</div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {activeCatalogSection === null ? (
          <Card className="card-elegant border-dashed border-border/70 bg-background/70">
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Yuqoridagi kartalardan birini bosing.
                </p>
                <p className="text-sm text-muted-foreground">
                  Faqat tanlangan katalog bo'limi to'liq ochiladi.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-6">
          {activeCatalogSection === "rootstock" ? (
          <Card className="card-elegant overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(126,205,86,0.10),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,247,0.96))]">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-accent" />
                    Payvand turlari
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Rootstock va payvandtag turlarini shu bo'limdan boshqaring.
                  </CardDescription>
                </div>
                <span className="inline-flex min-w-[62px] items-center justify-center rounded-2xl border border-accent/20 bg-white/90 px-3 py-2 text-sm font-semibold text-accent shadow-sm">
                  {rootstockTypes?.length || 0} ta
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {!rootstockTypes?.length ? (
                <div className="rounded-[28px] border border-dashed border-border/70 bg-white/70 px-5 py-10 text-sm leading-6 text-muted-foreground shadow-sm">
                  Hozircha payvand turi qo'shilmagan. Yuqoridagi `Payvand turi` tugmasi orqali
                  birinchi yozuvni kiritsangiz shu yerda ko'rinadi.
                </div>
              ) : (
                rootstockTypes.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-[22px] border border-emerald-200/70 bg-white/95 px-4 py-3 shadow-[0_8px_22px_rgba(126,205,86,0.10)] transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_14px_30px_rgba(126,205,86,0.14)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <p className="truncate text-base font-semibold leading-5 text-foreground">
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                              Payvand turi
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              ID #{item.id}
                            </span>
                          </div>
                        </div>
                        <p className="truncate text-sm leading-5 text-muted-foreground">
                          {item.description || "Izoh kiritilmagan"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Dialog
                          open={editingRootstock?.id === item.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingRootstock(null);
                          }}
                          >
                            <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                              onClick={() =>
                                setEditingRootstock({
                                  id: item.id,
                                  name: item.name,
                                    description: item.description || "",
                                  })
                                }
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Payvand turini tahrirlash</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                  <Label>Nomi</Label>
                                  <Input
                                    value={editingRootstock?.name || ""}
                                    onChange={(event) =>
                                      setEditingRootstock((current) =>
                                        current ? { ...current, name: event.target.value } : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Izoh</Label>
                                  <Input
                                    value={editingRootstock?.description || ""}
                                    onChange={(event) =>
                                      setEditingRootstock((current) =>
                                        current
                                          ? { ...current, description: event.target.value }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex justify-end gap-3">
                                  <Button variant="outline" onClick={() => setEditingRootstock(null)}>
                                    Bekor qilish
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (!editingRootstock) return;
                                      updateRootstockMutation.mutate({
                                        id: editingRootstock.id,
                                        name: editingRootstock.name.trim(),
                                        description: editingRootstock.description.trim() || undefined,
                                      });
                                    }}
                                    disabled={
                                      updateRootstockMutation.isPending ||
                                      !editingRootstock?.name.trim()
                                    }
                                  >
                                    {updateRootstockMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-destructive shadow-sm transition-colors hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive"
                          onClick={() => {
                            if (!window.confirm(`"${item.name}" payvand turini o'chiraymi?`)) return;
                            deleteRootstockMutation.mutate({ id: item.id });
                          }}
                          disabled={deleteRootstockMutation.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          ) : null}

          {activeCatalogSection === "seedlingType" ? (
          <Card className="card-elegant overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.10),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,247,0.96))]">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-accent" />
                    Ko'chat turlari
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Yaratish, tahrirlash va xavfsiz o'chirish bilan katalog yuritiladi.
                  </CardDescription>
                </div>
                <span className="inline-flex min-w-[62px] items-center justify-center rounded-2xl border border-accent/20 bg-white/90 px-3 py-2 text-sm font-semibold text-accent shadow-sm">
                  {seedlingTypes?.length || 0} ta
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {!seedlingTypes?.length ? (
                <div className="rounded-[28px] border border-dashed border-border/70 bg-white/70 px-5 py-10 text-sm leading-6 text-muted-foreground shadow-sm">
                  Hozircha tur qo'shilmagan.
                </div>
              ) : (
                seedlingTypes.map((type) => (
                  <div
                    key={type.id}
                    className="group rounded-[22px] border border-emerald-200/70 bg-white/95 px-4 py-3 shadow-[0_8px_22px_rgba(52,211,153,0.10)] transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_14px_30px_rgba(52,211,153,0.14)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <p className="truncate text-base font-semibold leading-5 text-foreground">
                            {type.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Ko'chat turi
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              ID #{type.id}
                            </span>
                          </div>
                        </div>
                        <p className="truncate text-sm leading-5 text-muted-foreground">
                          {type.description || "Izoh kiritilmagan"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Dialog
                          open={editingType?.id === type.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingType(null);
                          }}
                          >
                            <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                              onClick={() =>
                                setEditingType({
                                  id: type.id,
                                  name: type.name,
                                    description: type.description || "",
                                  })
                                }
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Ko'chat turini tahrirlash</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                  <Label>Nomi</Label>
                                  <Input
                                    value={editingType?.name || ""}
                                    onChange={(event) =>
                                      setEditingType((current) =>
                                        current
                                          ? { ...current, name: event.target.value }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Izoh</Label>
                                  <Input
                                    value={editingType?.description || ""}
                                    onChange={(event) =>
                                      setEditingType((current) =>
                                        current
                                          ? { ...current, description: event.target.value }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex justify-end gap-3">
                                  <Button variant="outline" onClick={() => setEditingType(null)}>
                                    Bekor qilish
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (!editingType) return;
                                      updateTypeMutation.mutate({
                                        id: editingType.id,
                                        name: editingType.name.trim(),
                                        description: editingType.description.trim() || undefined,
                                      });
                                    }}
                                    disabled={updateTypeMutation.isPending || !editingType?.name.trim()}
                                  >
                                    {updateTypeMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-destructive shadow-sm transition-colors hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive"
                          onClick={() => {
                            if (!window.confirm(`"${type.name}" turini o'chiraymi?`)) return;
                            deleteTypeMutation.mutate({ id: type.id });
                          }}
                          disabled={deleteTypeMutation.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          ) : null}

          {activeCatalogSection === "variety" ? (
          <Card className="card-elegant overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.12),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,247,0.96))]">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-accent" />
                    Navlar
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Har bir tur bo'yicha navlarni ham tahrirlash va o'chirish mumkin.
                  </CardDescription>
                </div>
                <span className="inline-flex min-w-[62px] items-center justify-center rounded-2xl border border-accent/20 bg-white/90 px-3 py-2 text-sm font-semibold text-accent shadow-sm">
                  {varieties?.length || 0} ta
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {!varieties?.length ? (
                <div className="rounded-[28px] border border-dashed border-border/70 bg-white/70 px-5 py-10 text-sm leading-6 text-muted-foreground shadow-sm">
                  Hozircha nav qo'shilmagan.
                </div>
              ) : (
                varieties.map((variety) => (
                  <div
                    key={variety.id}
                    className="group rounded-[22px] border border-lime-200/70 bg-white/95 px-4 py-3 shadow-[0_8px_22px_rgba(132,204,22,0.10)] transition-all hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-[0_14px_30px_rgba(132,204,22,0.14)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <p className="truncate text-base font-semibold leading-5 text-foreground">
                            {variety.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-semibold text-lime-700">
                              {typeNameById.get(variety.seedlingTypeId) || "Turi topilmadi"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              ID #{variety.id}
                            </span>
                          </div>
                        </div>
                        <p className="truncate text-sm leading-5 text-muted-foreground">
                          {variety.description || "Izoh kiritilmagan"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Dialog
                          open={editingVariety?.id === variety.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingVariety(null);
                          }}
                          >
                            <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                              onClick={() =>
                                setEditingVariety({
                                  id: variety.id,
                                  seedlingTypeId: variety.seedlingTypeId.toString(),
                                    name: variety.name,
                                    description: variety.description || "",
                                  })
                                }
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Navni tahrirlash</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                  <Label>Ko'chat turi</Label>
                                  <Select
                                    value={editingVariety?.seedlingTypeId || ""}
                                    onValueChange={(value) =>
                                      setEditingVariety((current) =>
                                        current
                                          ? { ...current, seedlingTypeId: value }
                                          : current
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Tanlang..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {seedlingTypes?.map((type) => (
                                        <SelectItem key={type.id} value={type.id.toString()}>
                                          {type.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Nav nomi</Label>
                                  <Input
                                    value={editingVariety?.name || ""}
                                    onChange={(event) =>
                                      setEditingVariety((current) =>
                                        current
                                          ? { ...current, name: event.target.value }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Izoh</Label>
                                  <Input
                                    value={editingVariety?.description || ""}
                                    onChange={(event) =>
                                      setEditingVariety((current) =>
                                        current
                                          ? { ...current, description: event.target.value }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex justify-end gap-3">
                                  <Button variant="outline" onClick={() => setEditingVariety(null)}>
                                    Bekor qilish
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (!editingVariety) return;
                                      updateVarietyMutation.mutate({
                                        id: editingVariety.id,
                                        seedlingTypeId: Number(editingVariety.seedlingTypeId),
                                        name: editingVariety.name.trim(),
                                        description: editingVariety.description.trim() || undefined,
                                      });
                                    }}
                                    disabled={
                                      updateVarietyMutation.isPending ||
                                      !editingVariety?.seedlingTypeId ||
                                      !editingVariety?.name.trim()
                                    }
                                  >
                                    {updateVarietyMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-destructive shadow-sm transition-colors hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive"
                          onClick={() => {
                            if (!window.confirm(`"${variety.name}" navini o'chiraymi?`)) return;
                            deleteVarietyMutation.mutate({ id: variety.id });
                          }}
                          disabled={deleteVarietyMutation.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

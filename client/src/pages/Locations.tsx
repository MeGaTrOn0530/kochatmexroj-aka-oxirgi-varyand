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
import { BarChart3, Beaker, Building2, Edit2, Plus, Trash2, Trees } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type LocationForm = {
  name: string;
  type: string;
  capacity: string;
  description: string;
  status: string;
  isSource: boolean;
};

type LocationItem = {
  id: number;
  name: string;
  code: string;
  type: "greenhouse" | "open_field" | "laboratory";
  capacity: number | null;
  description: string;
  status: string;
  totalStock: number;
  totalDefects: number;
};

const emptyForm: LocationForm = {
  name: "",
  type: "greenhouse",
  isSource: false,
  capacity: "",
  description: "",
  status: "active",
};

const typeLabel = {
  greenhouse: "Teplitsa",
  open_field: "Ochiq dala",
  laboratory: "Laboratoriya",
};

const typeIcon = {
  greenhouse: Building2,
  open_field: Trees,
  laboratory: Beaker,
};

const statusLabel = {
  active: "Faol",
  inactive: "Nofaol",
};

export default function LocationsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<LocationForm>(emptyForm);
  const [editForm, setEditForm] = useState<LocationForm>(emptyForm);

  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const { data: ghSummary } = trpc.greenhouse.getSummary.useQuery();
  const locationList = (locations || []) as LocationItem[];

  // Greenhouse lokatsiyalar uchun: batch stok o'rniga greenhouse stok ishlatiladi
  const ghStatsMap = useMemo(() => {
    const map = new Map<number, { cassette: number; grafting: number; kochat: number; ready: number; defective: number; total: number }>();
    for (const row of ghSummary || []) {
      map.set(row.locationId, {
        cassette: row.cassette,
        grafting: row.grafting,
        kochat: row.grafted,
        ready: row.ready,
        defective: row.defectTotal,
        total: row.total,
      });
    }
    return map;
  }, [ghSummary]);

  const visibleLocations = useMemo(() => {
    if (user?.role === "agranom") {
      return locationList.filter((location) => location.id === user.locationId);
    }

    return locationList;
  }, [locationList, user?.locationId, user?.role]);

  const editingLocation = useMemo(
    () => locationList.find((location) => location.id === editingLocationId) || null,
    [editingLocationId, locationList]
  );

  const locationStats = useMemo(() => {
    const stats = new Map<
      number,
      {
        total: number;
        defective: number;
        cassette: number;
        grafting: number;
        kochat: number;
        ready: number;
      }
    >();

    for (const batch of batches || []) {
      const current = stats.get(batch.locationId) || {
        total: 0,
        defective: 0,
        cassette: 0,
        grafting: 0,
        kochat: 0,
        ready: 0,
      };

      current.total += batch.quantity;
      current.defective += batch.defectiveQuantity;

      if (batch.status === "cassette") {
        current.cassette += batch.quantity;
      } else if (batch.status === "grafting") {
        current.grafting += batch.quantity;
      } else if (batch.status === "ready") {
        current.ready += batch.quantity;
      } else {
        current.kochat += batch.quantity;
      }

      stats.set(batch.locationId, current);
    }

    return stats;
  }, [batches]);

  const overview = useMemo(() => {
    return visibleLocations.reduce(
      (acc, location) => {
        const isGh = location.type === "greenhouse" && !(location as any).isSource;
        const batchStats = locationStats.get(location.id) || { total: 0, defective: 0, cassette: 0, grafting: 0, kochat: 0, ready: 0 };
        const ghStats = ghStatsMap.get(location.id);
        const stats = (isGh && ghStats) ? ghStats : batchStats;

        acc.totalLocations += 1;
        acc.totalCapacity += location.capacity || 0;
        acc.totalSeedlings += stats.total;
        acc.totalDefects += stats.defective;
        acc.ready += stats.ready;
        acc.byType[location.type] += 1;
        return acc;
      },
      {
        totalLocations: 0,
        totalCapacity: 0,
        totalSeedlings: 0,
        totalDefects: 0,
        ready: 0,
        byType: {
          greenhouse: 0,
          open_field: 0,
          laboratory: 0,
        } as Record<"greenhouse" | "open_field" | "laboratory", number>,
      }
    );
  }, [locationStats, visibleLocations, ghStatsMap]);

  const invalidateLocations = async () => {
    await Promise.all([
      utils.locations.getAll.invalidate(),
      utils.reports.getGeneral.invalidate(),
      utils.reports.getOverview.invalidate(),
    ]);
  };

  const createLocationMutation = trpc.admin.createLocation.useMutation({
    onSuccess: async () => {
      toast.success("Lokatsiya yaratildi");
      setCreateForm(emptyForm);
      setIsCreateOpen(false);
      await invalidateLocations();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Lokatsiyani yaratib bo'lmadi");
    },
  });

  const updateLocationMutation = trpc.admin.updateLocation.useMutation({
    onSuccess: async () => {
      toast.success("Lokatsiya yangilandi");
      setEditingLocationId(null);
      setEditForm(emptyForm);
      await invalidateLocations();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Lokatsiyani yangilab bo'lmadi");
    },
  });

  const deleteLocationMutation = trpc.admin.deleteLocation.useMutation({
    onSuccess: async () => {
      toast.success("Lokatsiya o'chirildi");
      await invalidateLocations();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Lokatsiyani o'chirib bo'lmadi");
    },
  });

  const openEditDialog = (location: any) => {
    setEditingLocationId(location.id);
    setEditForm({
      name: location.name,
      type: location.type,
      capacity: location.capacity ? String(location.capacity) : "",
      description: location.description || "",
      status: location.status || "active",
      isSource: Boolean(location.isSource),
    });
  };

  const handleCreateLocation = () => {
    if (!createForm.name.trim() || !createForm.type) {
      toast.error("Nomi va turi majburiy");
      return;
    }

    createLocationMutation.mutate({
      name: createForm.name.trim(),
      type: createForm.type,
      capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
      description: createForm.description.trim() || undefined,
      isSource: createForm.isSource,
    });
  };

  const handleUpdateLocation = () => {
    if (!editingLocationId || !editForm.name.trim() || !editForm.type) {
      toast.error("Nomi va turi majburiy");
      return;
    }

    updateLocationMutation.mutate({
      id: editingLocationId,
      name: editForm.name.trim(),
      type: editForm.type,
      capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
      description: editForm.description.trim() || undefined,
      status: editForm.status,
      isSource: editForm.isSource,
    });
  };

  const pageTitle = user?.role === "agranom" ? "Mening obyektim" : "Lokatsiyalar";
  const pageDescription =
    user?.role === "agranom"
      ? "Sizga biriktirilgan obyekt holati va undagi ko'chatlar kesimi."
      : "Teplitsalar, dalalar va laboratoriyalar bo'yicha holatni boshqaring.";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
              <BarChart3 className="h-8 w-8 text-accent" />
              {pageTitle}
            </h1>
            <p className="mt-1 text-muted-foreground">{pageDescription}</p>
          </div>

          {user?.role === "admin" && (
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) {
                  setCreateForm(emptyForm);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Yangi lokatsiya
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi lokatsiya</DialogTitle>
                  <DialogDescription>Teplitsa, ochiq dala yoki laboratoriya qo'shing.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Nomi</Label>
                    <Input
                      placeholder="Teplitsa 1"
                      value={createForm.name}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Turi</Label>
                    <Select
                      value={createForm.type}
                      onValueChange={(value) =>
                        setCreateForm((current) => ({ ...current, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greenhouse">Teplitsa</SelectItem>
                        <SelectItem value="open_field">Ochiq dala</SelectItem>
                        <SelectItem value="laboratory">Laboratoriya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sig'imi</Label>
                    <Input
                      type="number"
                      placeholder="5000"
                      value={createForm.capacity}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, capacity: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Izoh</Label>
                    <Textarea
                      placeholder="Qisqa tavsif yoki foydalanish maqsadi..."
                      value={createForm.description}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={createForm.isSource}
                      onChange={(e) => setCreateForm((f) => ({ ...f, isSource: e.target.checked }))}
                    />
                    <div>
                      <div className="font-medium text-amber-800 text-sm">Manba lokatsiya (Jomboy)</div>
                      <div className="text-xs text-amber-700">Bu lokatsiyada ko'chat partiyasi yaratish mumkin</div>
                    </div>
                  </label>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Bekor qilish
                    </Button>
                    <Button onClick={handleCreateLocation} disabled={createLocationMutation.isPending}>
                      {createLocationMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-elegant border-border/70 bg-background/85">
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Obyektlar
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">{overview.totalLocations}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {overview.byType.greenhouse} ta teplitsa, {overview.byType.open_field} ta ochiq dala,{" "}
                {overview.byType.laboratory} ta laboratoriya
              </div>
            </CardContent>
          </Card>
          <Card className="card-elegant border-border/70 bg-background/85">
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Jami sig'im
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">{overview.totalCapacity}</div>
              <div className="mt-2 text-sm text-muted-foreground">Barcha obyektlar quvvati</div>
            </CardContent>
          </Card>
          <Card className="card-elegant border-border/70 bg-background/85">
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Jami ko'chat
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">{overview.totalSeedlings}</div>
              <div className="mt-2 text-sm text-muted-foreground">{overview.ready} tasi tayyor holatda</div>
            </CardContent>
          </Card>
          <Card className="card-elegant border-border/70 bg-background/85">
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Nuqsonli
              </div>
              <div className="mt-2 text-3xl font-bold text-red-600">{overview.totalDefects}</div>
              <div className="mt-2 text-sm text-muted-foreground">Yig'ilgan barcha nuqsonli son</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {!visibleLocations.length ? (
            <Card className="card-elegant col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Lokatsiyalar topilmadi</p>
              </CardContent>
            </Card>
          ) : (
            visibleLocations.map((location) => {
              const Icon = typeIcon[location.type];
              const isGreenhouse = location.type === "greenhouse" && !(location as any).isSource;
              const batchStats = locationStats.get(location.id) || { total: 0, defective: 0, cassette: 0, grafting: 0, kochat: 0, ready: 0 };
              const ghStats = ghStatsMap.get(location.id);
              const stats = (isGreenhouse && ghStats) ? ghStats : batchStats;

              return (
                <div
                  key={location.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Top strip */}
                  <div className={`h-1 w-full ${location.status === "active" ? "bg-accent" : "bg-slate-300 dark:bg-slate-600"}`} />

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-base font-bold leading-tight text-foreground truncate">
                            {location.name}
                          </div>
                          {(location as any).isSource && (
                            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              JOMBOY
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{typeLabel[location.type]}</div>
                        {location.code && (
                          <div className="mt-0.5 text-xs text-muted-foreground/70">{location.code}</div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          location.status === "active"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {statusLabel[location.status as keyof typeof statusLabel] || location.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-2.5">
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sig'imi</div>
                        <div className="mt-0.5 text-base font-bold text-foreground">{location.capacity || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ko'chat</div>
                        <div className="mt-0.5 text-base font-bold text-foreground">{stats.total}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nuqsonli</div>
                        <div className="mt-0.5 text-base font-bold text-red-500">{stats.defective}</div>
                      </div>
                    </div>

                    {/* Stage breakdown */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Kaseta", value: stats.cassette },
                        { label: "Payvand", value: stats.grafting },
                        { label: "Ko'chat", value: stats.kochat },
                        { label: "Tayyor", value: stats.ready, green: true },
                      ].map(({ label, value, green }) => (
                        <div key={label} className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2 text-center">
                          <div className="text-[10px] text-muted-foreground">{label}</div>
                          <div className={`mt-0.5 text-sm font-bold ${green ? "text-green-600" : "text-foreground"}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {location.description && (
                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground line-clamp-2">
                        {location.description}
                      </div>
                    )}

                    {/* Action buttons */}
                    {user?.role === "admin" && (
                      <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openEditDialog(location)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Tahrirlash
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 hover:border-destructive"
                          disabled={deleteLocationMutation.isPending}
                          onClick={() => {
                            if (!window.confirm(`"${location.name}" lokatsiyasini o'chiraymi?`)) return;
                            deleteLocationMutation.mutate({ id: location.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          O'chirish
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Dialog
          open={editingLocationId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingLocationId(null);
              setEditForm(emptyForm);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lokatsiyani tahrirlash</DialogTitle>
              <DialogDescription>Obyekt nomi, sig'imi, holati va tavsifini yangilang.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nomi</Label>
                <Input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Turi</Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(value) =>
                      setEditForm((current) => ({ ...current, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="greenhouse">Teplitsa</SelectItem>
                      <SelectItem value="open_field">Ochiq dala</SelectItem>
                      <SelectItem value="laboratory">Laboratoriya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Faol</SelectItem>
                      <SelectItem value="inactive">Nofaol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sig'imi</Label>
                <Input
                  type="number"
                  value={editForm.capacity}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Izoh</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={editForm.isSource}
                  onChange={(e) => setEditForm((f) => ({ ...f, isSource: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-amber-800 text-sm">Manba lokatsiya (Jomboy)</div>
                  <div className="text-xs text-amber-700">Bu lokatsiyada ko'chat partiyasi yaratish mumkin</div>
                </div>
              </label>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingLocationId(null)}>
                  Bekor qilish
                </Button>
                <Button onClick={handleUpdateLocation} disabled={updateLocationMutation.isPending}>
                  {updateLocationMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

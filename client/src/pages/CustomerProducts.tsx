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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Edit2, Eye, ImagePlus, Plus, Store, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductFormState = {
  name: string;
  price: string;
  description: string;
  displayOrder: string;
  contactPhone: string;
  contactPhoneSecondary: string;
  contactNote: string;
  isActive: boolean;
  imageFile: File | null;
  existingImagePath: string | null;
};

type CustomerProductItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  imagePath: string | null;
  contactPhone: string;
  contactPhoneSecondary: string;
  contactNote: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

const emptyForm: ProductFormState = {
  name: "",
  price: "",
  description: "",
  displayOrder: "0",
  contactPhone: "",
  contactPhoneSecondary: "",
  contactNote: "",
  isActive: true,
  imageFile: null,
  existingImagePath: null,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
    maximumFractionDigits: 0,
  }).format(price || 0);
}

export default function CustomerProductsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<ProductFormState>(emptyForm);
  const [editForm, setEditForm] = useState<ProductFormState>(emptyForm);

  const { data: products } = trpc.customerProducts.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const productList = (products || []) as CustomerProductItem[];

  const editingProduct = useMemo(
    () => productList.find((item) => item.id === editingProductId) || null,
    [editingProductId, productList]
  );

  const createPreview = useMemo(
    () => (createForm.imageFile ? URL.createObjectURL(createForm.imageFile) : null),
    [createForm.imageFile]
  );
  const editPreview = useMemo(
    () => (editForm.imageFile ? URL.createObjectURL(editForm.imageFile) : editForm.existingImagePath),
    [editForm.existingImagePath, editForm.imageFile]
  );

  useEffect(() => {
    return () => {
      if (createPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(createPreview);
      }
      if (editPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editPreview);
      }
    };
  }, [createPreview, editPreview]);

  useEffect(() => {
    if (!editingProduct) {
      return;
    }

    setEditForm({
      name: editingProduct.name,
      price: String(editingProduct.price || ""),
      description: editingProduct.description || "",
      displayOrder: String(editingProduct.displayOrder || 0),
      contactPhone: editingProduct.contactPhone || "",
      contactPhoneSecondary: editingProduct.contactPhoneSecondary || "",
      contactNote: editingProduct.contactNote || "",
      isActive: editingProduct.isActive,
      imageFile: null,
      existingImagePath: editingProduct.imagePath,
    });
  }, [editingProduct]);

  const invalidateProducts = async () => {
    await Promise.all([
      utils.customerProducts.getAll.invalidate(),
      utils.customerProducts.getPublic.invalidate(),
    ]);
  };

  const createMutation = trpc.customerProducts.create.useMutation({
    onSuccess: async () => {
      toast.success("Sotuv kartasi yaratildi");
      setCreateForm(emptyForm);
      setIsCreateOpen(false);
      await invalidateProducts();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Kartani saqlab bo'lmadi");
    },
  });

  const updateMutation = trpc.customerProducts.update.useMutation({
    onSuccess: async () => {
      toast.success("Sotuv kartasi yangilandi");
      setEditingProductId(null);
      setEditForm(emptyForm);
      await invalidateProducts();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Kartani yangilab bo'lmadi");
    },
  });

  const removeMutation = trpc.customerProducts.remove.useMutation({
    onSuccess: async () => {
      toast.success("Sotuv kartasi o'chirildi");
      await invalidateProducts();
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Kartani o'chirib bo'lmadi");
    },
  });

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.price.trim() || !createForm.imageFile) {
      toast.error("Nomi, narxi va rasmi majburiy");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: createForm.name.trim(),
        price: Number(createForm.price),
        description: createForm.description.trim() || undefined,
        displayOrder: Number(createForm.displayOrder || 0),
        contactPhone: createForm.contactPhone.trim() || undefined,
        contactPhoneSecondary: createForm.contactPhoneSecondary.trim() || undefined,
        contactNote: createForm.contactNote.trim() || undefined,
        isActive: createForm.isActive,
        image: {
          name: createForm.imageFile.name,
          dataUrl: await readFileAsDataUrl(createForm.imageFile),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingProductId || !editForm.name.trim() || !editForm.price.trim()) {
      toast.error("Nomi va narxi majburiy");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingProductId,
        name: editForm.name.trim(),
        price: Number(editForm.price),
        description: editForm.description.trim() || undefined,
        displayOrder: Number(editForm.displayOrder || 0),
        contactPhone: editForm.contactPhone.trim() || undefined,
        contactPhoneSecondary: editForm.contactPhoneSecondary.trim() || undefined,
        contactNote: editForm.contactNote.trim() || undefined,
        isActive: editForm.isActive,
        image: editForm.imageFile
          ? {
              name: editForm.imageFile.name,
              dataUrl: await readFileAsDataUrl(editForm.imageFile),
            }
          : undefined,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat yo'q</CardTitle>
              <CardDescription>
                Bu bo'lim faqat admin uchun ochilgan.
              </CardDescription>
            </CardHeader>
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
              <Store className="h-8 w-8 text-accent" />
              Mijoz uchun bo'lim
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Bosh sahifada chiqadigan sotuv kartalarini shu yerdan boshqaring. Admin rasm, narx,
              izoh va ko'rinish tartibini saqlaydi.
            </p>
          </div>

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
                Yangi karta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yangi sotuv kartasi</DialogTitle>
                <DialogDescription>
                  Mijozlarga ko'rinadigan ko'chat kartasini yarating.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="create-product-name">Nomi</Label>
                  <Input
                    id="create-product-name"
                    placeholder="Pomidor ko'chati"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-product-price">Narxi</Label>
                    <Input
                      id="create-product-price"
                      type="number"
                      placeholder="15000"
                      value={createForm.price}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, price: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-product-order">Tartib</Label>
                    <Input
                      id="create-product-order"
                      type="number"
                      placeholder="0"
                      value={createForm.displayOrder}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          displayOrder: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-product-description">Izoh</Label>
                  <Textarea
                    id="create-product-description"
                    placeholder="Ko'chatning qisqa tavsifi, yetishtirish holati yoki afzalligi..."
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-product-contact-phone">Bog'lanish raqami</Label>
                    <Input
                      id="create-product-contact-phone"
                      placeholder="+998 90 123 45 67"
                      value={createForm.contactPhone}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          contactPhone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-product-contact-phone-secondary">Qo'shimcha raqam</Label>
                    <Input
                      id="create-product-contact-phone-secondary"
                      placeholder="+998 91 765 43 21"
                      value={createForm.contactPhoneSecondary}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          contactPhoneSecondary: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-product-contact-note">Bog'lanish izohi</Label>
                  <Textarea
                    id="create-product-contact-note"
                    placeholder="Masalan: ish vaqti 09:00-18:00, telegram orqali ham yozsa bo'ladi..."
                    value={createForm.contactNote}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        contactNote: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-product-image">Rasm</Label>
                  <Input
                    id="create-product-image"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        imageFile: event.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
                {createPreview && (
                  <div className="overflow-hidden rounded-2xl border border-border/70">
                    <img src={createPreview} alt="Preview" className="h-56 w-full object-cover" />
                  </div>
                )}
                <div className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Bosh sahifada ko'rsatilsin</p>
                    <p className="text-sm text-muted-foreground">
                      Ochiq bo'lsa kartalar ghost sahifada chiqadi.
                    </p>
                  </div>
                  <Switch
                    checked={createForm.isActive}
                    onCheckedChange={(checked) =>
                      setCreateForm((current) => ({ ...current, isActive: checked }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Bekor qilish
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!productList.length ? (
            <Card className="card-elegant col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ImagePlus className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="font-medium text-foreground">Hozircha mijoz kartalari yo'q</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Yangi karta yarating, shunda bosh sahifada rasmlar bilan sotuv bloklari chiqadi.
                </p>
              </CardContent>
            </Card>
          ) : (
            productList.map((product) => (
              <Card key={product.id} className="card-elegant overflow-hidden">
                <div className="relative h-56 bg-muted/30">
                  {product.imagePath ? (
                    <img src={product.imagePath} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      Rasm yo'q
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                    <Eye className="h-3.5 w-3.5 text-accent" />
                    {product.isActive ? "Saytda chiqadi" : "Yashirilgan"}
                  </div>
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{product.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {product.description || "Izoh kiritilmagan"}
                      </CardDescription>
                    </div>
                    <div className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                      {formatPrice(product.price)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ko'rinish tartibi</span>
                    <span className="font-semibold text-foreground">{product.displayOrder}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Oxirgi yangilanish</span>
                    <span className="font-semibold text-foreground">
                      {product.updatedAt ? new Date(product.updatedAt).toLocaleString("uz-UZ") : "-"}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
                    <div className="font-medium text-foreground">Buyurtma uchun bog'lanish</div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>Asosiy raqam: {product.contactPhone || "-"}</p>
                      <p>Qo'shimcha raqam: {product.contactPhoneSecondary || "-"}</p>
                      <p>Izoh: {product.contactNote || "-"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog
                      open={editingProductId === product.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingProductId(null);
                          setEditForm(emptyForm);
                        } else {
                          setEditingProductId(product.id);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => setEditingProductId(product.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                          Tahrirlash
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Sotuv kartasini tahrirlash</DialogTitle>
                          <DialogDescription>
                            Bosh sahifadagi karta ma'lumotlarini yangilang.
                          </DialogDescription>
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
                              <Label>Narxi</Label>
                              <Input
                                type="number"
                                value={editForm.price}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, price: event.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tartib</Label>
                              <Input
                                type="number"
                                value={editForm.displayOrder}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    displayOrder: event.target.value,
                                  }))
                                }
                              />
                            </div>
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
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Bog'lanish raqami</Label>
                              <Input
                                value={editForm.contactPhone}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    contactPhone: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Qo'shimcha raqam</Label>
                              <Input
                                value={editForm.contactPhoneSecondary}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    contactPhoneSecondary: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Bog'lanish izohi</Label>
                            <Textarea
                              value={editForm.contactNote}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  contactNote: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Yangi rasm</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  imageFile: event.target.files?.[0] || null,
                                }))
                              }
                            />
                          </div>
                          {editPreview && (
                            <div className="overflow-hidden rounded-2xl border border-border/70">
                              <img src={editPreview} alt={editForm.name} className="h-56 w-full object-cover" />
                            </div>
                          )}
                          <div className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">Bosh sahifada ko'rsatilsin</p>
                              <p className="text-sm text-muted-foreground">
                                O'chirilsa kartaning o'zi saqlanadi, lekin saytda chiqmaydi.
                              </p>
                            </div>
                            <Switch
                              checked={editForm.isActive}
                              onCheckedChange={(checked) =>
                                setEditForm((current) => ({ ...current, isActive: checked }))
                              }
                            />
                          </div>
                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setEditingProductId(null)}>
                              Bekor qilish
                            </Button>
                            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (!window.confirm(`"${product.name}" kartasini o'chiraymi?`)) {
                          return;
                        }

                        removeMutation.mutate({ id: product.id });
                      }}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

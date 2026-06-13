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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, MoreVertical, Users, Plus, Edit2, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type UserRole = "admin" | "bosh_agranom" | "agranom" | "bugalter" | "bosh_ofes";

// Bu rollar uchun lokatsiya talab qilinmaydi — ular barcha teplitsalarga kiradi
const UNIVERSAL_ROLES: UserRole[] = ["admin", "bosh_agranom", "bugalter", "bosh_ofes"];

export default function UsersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "agranom" as UserRole,
    locationId: "",
  });

  const { data: users } = trpc.admin.getAllUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: locations } = trpc.locations.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      toast.success("Yangi foydalanuvchi yaratildi");
      setIsCreateDialogOpen(false);
      setNewUser({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "agranom",
        locationId: "",
      });
      await utils.admin.getAllUsers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Foydalanuvchi yaratilmadi");
    },
  });

  const updateAccessMutation = trpc.admin.updateUserAccess.useMutation({
    onSuccess: async () => {
      toast.success("Foydalanuvchi ma'lumotlari yangilandi");
      setEditingUserId(null);
      setSelectedRole("");
      setSelectedLocationId("");
      await utils.admin.getAllUsers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Xato yuz berdi");
    },
  });

  const deleteUserMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: async () => {
      toast.success("Foydalanuvchi o'chirildi");
      await utils.admin.getAllUsers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Foydalanuvchini o'chirib bo'lmadi");
    },
  });

  const handleUpdateAccess = (userId: number, newRole: UserRole, locationId: string) => {
    updateAccessMutation.mutate({
      userId,
      role: newRole,
      locationId: locationId ? Number(locationId) : null,
    });
  };

  const handleCreateUser = () => {
    createUserMutation.mutate({
      ...newUser,
      locationId: newUser.locationId ? Number(newUser.locationId) : null,
    });
  };

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    bosh_agranom: "Bosh Agranom",
    agranom: "Agranom",
    bugalter: "Buxgalter",
    bosh_ofes: "Bosh Ofes",
  };

  const locationLabel = (locationId?: number | null) =>
    locations?.find((location) => location.id === locationId)?.name || "-";

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
                Foydalanuvchilarni boshqarish uchun admin roli kerak.
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-8 h-8 text-accent" />
              Foydalanuvchilar
            </h1>
            <p className="text-muted-foreground mt-1">
              Barcha foydalanuvchilarni boshqaring va rollarini o'zgartiring
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Yangi user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi foydalanuvchi yaratish</DialogTitle>
                <DialogDescription>
                  Login, parol va rolni belgilang.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Ism</Label>
                  <Input
                    id="create-name"
                    value={newUser.name}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-username">Username</Label>
                  <Input
                    id="create-username"
                    value={newUser.username}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={newUser.email}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Parol</Label>
                    <div className="relative">
                      <Input
                        id="create-password"
                        type={showCreatePassword ? "text" : "password"}
                        className="pr-11"
                        value={newUser.password}
                        onChange={(event) =>
                          setNewUser((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowCreatePassword((current) => !current)}
                        aria-label={showCreatePassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                      >
                        {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser((current) => ({
                        ...current,
                        role: value as UserRole,
                        locationId: UNIVERSAL_ROLES.includes(value as UserRole) ? "" : current.locationId,
                      }))
                    }
                  >
                    <SelectTrigger className="input-elegant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="bosh_agranom">Bosh Agranom</SelectItem>
                      <SelectItem value="bosh_ofes">Bosh Ofes</SelectItem>
                      <SelectItem value="agranom">Agranom</SelectItem>
                      <SelectItem value="bugalter">Buxgalter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {UNIVERSAL_ROLES.includes(newUser.role) ? (
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      🌐 <strong>{roleLabel[newUser.role]}</strong> barcha teplitsalarga kiradi — lokatsiya talab qilinmaydi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Lokatsiya</Label>
                    <Select
                      value={newUser.locationId}
                      onValueChange={(value) =>
                        setNewUser((current) => ({
                          ...current,
                          locationId: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger className="input-elegant">
                        <SelectValue placeholder="Tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Biriktirilmagan</SelectItem>
                        {locations?.map((location) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    onClick={handleCreateUser}
                    disabled={
                      createUserMutation.isPending ||
                      !newUser.name.trim() ||
                      !newUser.username.trim() ||
                      !newUser.password
                    }
                  >
                    {createUserMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <Card className="card-elegant">
          <CardHeader>
            <CardTitle>Foydalanuvchilar Ro'yxati</CardTitle>
            <CardDescription>
              {users?.length || 0} ta foydalanuvchi ro'yxatga olgan
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!users || users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Foydalanuvchilar topilmadi</p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Ism</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Username</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Email</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Rol</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Lokatsiya</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground text-sm">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/50 transition-smooth">
                        <td className="py-3 px-3 font-medium text-foreground"><span className="block truncate">{u.name || "-"}</span></td>
                        <td className="py-3 px-3 text-muted-foreground text-sm"><span className="block truncate">{u.username || "-"}</span></td>
                        <td className="py-3 px-3 text-muted-foreground text-sm"><span className="block truncate">{u.email || "-"}</span></td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-accent/10 text-accent truncate max-w-full">
                            {roleLabel[u.role as keyof typeof roleLabel]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground text-sm"><span className="block truncate">{locationLabel(u.locationId)}</span></td>
                        <td className="py-3 px-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl border border-border/60 hover:bg-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setSelectedRole(u.role as UserRole);
                                  setSelectedLocationId(u.locationId ? u.locationId.toString() : "");
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                disabled={deleteUserMutation.isPending}
                                onClick={() => {
                                  if (!window.confirm(`${u.name || u.username} foydalanuvchisini o'chiraymi?`)) {
                                    return;
                                  }
                                  deleteUserMutation.mutate({ userId: u.id });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                O'chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Dialog open={editingUserId === u.id} onOpenChange={(open) => {
                            if (!open) setEditingUserId(null);
                          }}>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Foydalanuvchini tahrirlash</DialogTitle>
                                <DialogDescription>
                                  {u.name} uchun yangi rol va lokatsiya tanlang
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <label className="text-sm font-medium text-foreground mb-2 block">
                                    Rol
                                  </label>
                                  <Select
                                    value={selectedRole || u.role}
                                    onValueChange={(value) => {
                                      setSelectedRole(value as UserRole);
                                      if (UNIVERSAL_ROLES.includes(value as UserRole)) {
                                        setSelectedLocationId("");
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="input-elegant">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="bosh_agranom">Bosh Agranom</SelectItem>
                                      <SelectItem value="bosh_ofes">Bosh Ofes</SelectItem>
                                      <SelectItem value="agranom">Agranom</SelectItem>
                                      <SelectItem value="bugalter">Buxgalter</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {UNIVERSAL_ROLES.includes((selectedRole || u.role) as UserRole) ? (
                                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2">
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                      🌐 <strong>{roleLabel[selectedRole || u.role]}</strong> barcha teplitsalarga kiradi.
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-sm font-medium text-foreground mb-2 block">
                                      Lokatsiya
                                    </label>
                                    <Select
                                      value={selectedLocationId || "none"}
                                      onValueChange={(value) =>
                                        setSelectedLocationId(value === "none" ? "" : value)
                                      }
                                    >
                                      <SelectTrigger className="input-elegant">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Biriktirilmagan</SelectItem>
                                        {locations?.map((location) => (
                                          <SelectItem key={location.id} value={location.id.toString()}>
                                            {location.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                <div className="flex gap-3 justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setEditingUserId(null);
                                      setSelectedLocationId("");
                                    }}
                                  >
                                    Bekor qilish
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (selectedRole) {
                                        handleUpdateAccess(u.id, selectedRole, selectedLocationId);
                                      }
                                    }}
                                    disabled={!selectedRole || updateAccessMutation.isPending}
                                  >
                                    {updateAccessMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Info */}
        <Card className="card-elegant bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Shield className="w-5 h-5" />
              Rollar Haqida
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-3">
            <div>
              <p className="font-semibold mb-1">Admin</p>
              <p className="text-xs opacity-90">Barcha tizim sozlamalari va foydalanuvchi boshqaruvi</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Bosh Agranom</p>
              <p className="text-xs opacity-90">Ko'chat partiyalarini tasdiqlash va hisobotlarni ko'rish</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Agranom</p>
              <p className="text-xs opacity-90">Ko'chat kirim qilish, bosqichlarni yangilash</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Buxgalter</p>
              <p className="text-xs opacity-90">Ko'chat transferlari va operatsion qaydlar</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

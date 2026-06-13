import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [avatarPayload, setAvatarPayload] = useState<{ name: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData((current) => ({
      ...current,
      fullName: user.fullName || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
    }));
  }, [user]);

  const avatarPreview = useMemo(
    () => avatarPayload?.dataUrl || user?.avatarPath || null,
    [avatarPayload, user?.avatarPath]
  );

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async (payload: any) => {
      const updatedUser = payload?.user;
      utils.auth.me.setData(undefined, updatedUser);
      await utils.auth.me.invalidate();
      setFormData((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setAvatarPayload(null);

      if (payload?.requiresReauth) {
        toast.success("Parol yangilandi. Qayta login qiling.");
        await logout();
        return;
      }

      toast.success("Profil yangilandi");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Profilni yangilab bo'lmadi");
    },
  });

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarPayload({ name: file.name, dataUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rasm o'qilmadi");
    }
  };

  const handleSave = async () => {
    if (!formData.fullName.trim() || !formData.username.trim()) {
      toast.error("Ism va username majburiy");
      return;
    }

    if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
      toast.error("Yangi parollar mos emas");
      return;
    }

    if (formData.newPassword && !formData.currentPassword) {
      toast.error("Parolni almashtirish uchun joriy parolni kiriting");
      return;
    }

    await updateProfileMutation.mutateAsync({
      fullName: formData.fullName.trim(),
      username: formData.username.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      currentPassword: formData.currentPassword || undefined,
      newPassword: formData.newPassword || undefined,
      avatar: avatarPayload || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <UserRound className="h-8 w-8 text-accent" />
            Profil
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Login ma'lumotlari, parol va profil rasmini shu yerda boshqaring.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle>Asosiy ma'lumotlar</CardTitle>
              <CardDescription>Profil rasmi va foydalanuvchi ma'lumotlari.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 border">
                  <AvatarImage src={avatarPreview || undefined} alt={user?.fullName || "Profil rasmi"} />
                  <AvatarFallback className="bg-gradient-to-br from-accent to-accent/70 text-lg font-semibold text-accent-foreground">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar">Profil rasmi</Label>
                  <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WEBP yoki GIF rasm yuklash mumkin.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full-name">To'liq ism</Label>
                  <Input
                    id="full-name"
                    value={formData.fullName}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-accent" />
                Xavfsizlik
              </CardTitle>
              <CardDescription>Parolni yangilang.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password">Joriy parol</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    className="pr-11"
                    value={formData.currentPassword}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, currentPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Yangi parol</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    className="pr-11"
                    value={formData.newPassword}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowNewPassword((current) => !current)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Yangi parolni tasdiqlang</Label>
                <Input
                  id="confirm-password"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.confirmNewPassword}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, confirmNewPassword: event.target.value }))
                  }
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? "Saqlanmoqda..." : "Profilni saqlash"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

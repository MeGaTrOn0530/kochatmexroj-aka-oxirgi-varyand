import { useAuth } from "@/_core/hooks/useAuth";
import { getDashboardPathByRole } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import AppFooter from "@/components/AppFooter";
import { Eye, EyeOff, Leaf, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const finishLogin = async (loggedInUser: any) => {
    // iOS Safari login inputga bosilganda zoom qiladi — navigatsiyadan oldin reset qilamiz
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewport) {
      const orig = viewport.content;
      viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
      setTimeout(() => { viewport.content = orig; }, 100);
    }
    utils.auth.me.setData(undefined, loggedInUser);
    await utils.auth.me.invalidate();
    toast.success("Tizimga muvaffaqiyatli kirdingiz");
    setLocation(getDashboardPathByRole(loggedInUser.role));
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async ({ user: loggedInUser }: any) => {
      await finishLogin(loggedInUser);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Login amalga oshmadi");
    },
  });

  useEffect(() => {
    if (!loading && user) {
      setLocation(getDashboardPathByRole(user.role));
    }
  }, [loading, setLocation, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loginMutation.mutateAsync(credentials);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_35%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(240,253,244,1)_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="hidden rounded-3xl border border-emerald-200/60 bg-white/70 p-10 shadow-2xl shadow-emerald-100/50 backdrop-blur lg:block">
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Leaf className="h-7 w-7" />
            </div>
            <h1 className="max-w-md text-4xl font-semibold tracking-tight text-slate-900">
              "SAMARQAND QULUPNAY IMPEKS" MChJ boshqaruv tizimi
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Admin, bosh agranom, agranom va bugalter uchun alohida sahifalar mavjud.
              Login qilgandan keyin tizim sizni avtomatik ravishda o'z dashboardingizga olib boradi.
            </p>
          </div>

          <Card className="border-slate-200/80 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <CardTitle className="text-3xl text-slate-900">Login</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                Username va parolni kiriting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      autoComplete="username"
                      className="h-11 pl-10"
                      placeholder="Masalan: admin"
                      value={credentials.username}
                      onChange={(event) =>
                        setCredentials((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Parol</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="h-11 pl-10 pr-11"
                      placeholder="Parolingizni kiriting"
                      value={credentials.password}
                      onChange={(event) =>
                        setCredentials((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={
                    loginMutation.isPending ||
                    !credentials.username.trim() ||
                    !credentials.password
                  }
                >
                  {loginMutation.isPending ? "Kirilmoqda..." : "Tizimga kirish"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

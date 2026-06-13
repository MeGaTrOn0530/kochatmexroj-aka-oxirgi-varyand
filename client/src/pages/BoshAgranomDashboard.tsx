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
import { BarChart3, CheckCircle2, ClipboardCheck, Leaf, ListTodo, Plus, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const supervisorActions = [
  {
    icon: ClipboardCheck,
    title: "Tasdiqlar",
    description: "Agranom tomonidan kiritilgan partiyalarni ko'rish va tasdiqlash.",
    href: "/seedlings",
  },
  {
    icon: BarChart3,
    title: "Obyektlar holati",
    description: "Har bir teplitsa, dala va laboratoriya bo'yicha umumiy holat.",
    href: "/locations",
  },
  {
    icon: Truck,
    title: "Transfer nazorati",
    description: "Ichki almashinuvlar va tasdiqlar zanjirini kuzatish.",
    href: "/transfers",
  },
  {
    icon: Leaf,
    title: "Hisobotlar",
    description: "Bosqichlar va nuqsonli ko'chatlar bo'yicha ko'rinish.",
    href: "/reports",
  },
];

const priorityLabel: Record<string, string> = {
  low: "Past",
  medium: "O'rta",
  high: "Yuqori",
  urgent: "Shoshilinch",
};

const statusLabel: Record<string, string> = {
  open: "Ochiq",
  in_progress: "Jarayonda",
  done: "Bajarildi",
  cancelled: "Bekor qilindi",
};

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function BoshAgranomDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: batches } = trpc.seedlings.getBatches.useQuery();
  const { data: transfers } = trpc.transfers.getAll.useQuery();
  const { data: bronStats } = trpc.orders.getReservationStats.useQuery();
  const { data: tasks } = trpc.tasks.getAll.useQuery();
  const { data: allUsers } = trpc.admin.getAllUsers.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    locationId: "",
    assignedTo: "",
    priority: "medium",
    dueDate: "",
  });

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      toast.success("Topshiriq yaratildi");
      setIsTaskDialogOpen(false);
      setTaskForm({ title: "", description: "", locationId: "", assignedTo: "", priority: "medium", dueDate: "" });
      await utils.tasks.getAll.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Topshiriq yaratilmadi");
    },
  });

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onSuccess: async () => {
      await utils.tasks.getAll.invalidate();
    },
  });

  if (user?.role !== "bosh_agranom") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="card-elegant max-w-md">
            <CardHeader>
              <CardTitle>Ruxsat Rad Etildi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Bu sahifa faqat bosh agronom uchun mavjud.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const readyCount = batches?.filter((batch: any) => batch.status === "ready").length || 0;
  const pendingApprovals = batches?.filter((batch: any) => !batch.approvedBy).length || 0;
  const pendingTransfers = transfers?.filter((transfer: any) => !transfer.approvedBy).length || 0;

  const openTasks = (tasks || []).filter((t: any) => t.status !== "done" && t.status !== "cancelled");
  const agronomUsers = (allUsers || []).filter((u: any) => u.role === "agranom");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <CheckCircle2 className="h-8 w-8 text-accent" />
            Bosh agronom nazorat paneli
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Tasdiqlar, partiyalar va obyektlar kesimidagi ishlab chiqarish oqimini nazorat qilish oynasi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Jami partiyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalBatches || 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">Nazorat ostidagi partiyalar</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tasdiq kutilmoqda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{pendingApprovals}</div>
              <p className="mt-1 text-xs text-muted-foreground">Agranom kirimlari</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tayyor ko'chatlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{readyCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Sotuvga yaqin bosqich</p>
            </CardContent>
          </Card>
          <Card className="card-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Faol topshiriqlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{openTasks.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">Bajarilmagan topshiriqlar</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elegant border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Bron holati (Rezervatsiya)</CardTitle>
            </div>
            <CardDescription>Mijozlar tomonidan band qilingan tayyor ko'chatlar holati.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Tayyor ko'chatlar</div>
                <div className="mt-1 text-2xl font-bold text-green-600">{readyCount}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Bron qilingan</div>
                <div className="mt-1 text-2xl font-bold text-amber-600">{bronStats?.totalReserved || 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Yetishmaydi</div>
                <div className="mt-1 text-2xl font-bold text-red-600">{bronStats?.shortage || 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground">Faol buyurtmalar</div>
                <div className="mt-1 text-2xl font-bold text-foreground">{bronStats?.activeOrderCount || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Topshiriqlar bo'limi */}
        <Card className="card-elegant">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-accent" />
                <CardTitle className="text-base">Agranomlar uchun topshiriqlar</CardTitle>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsTaskDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Yangi topshiriq
              </Button>
            </div>
            <CardDescription>Agranomlar va lokatsiyalar bo'yicha topshiriqlar holati.</CardDescription>
          </CardHeader>
          <CardContent>
            {!tasks?.length ? (
              <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                Hozircha topshiriq yo'q. "Yangi topshiriq" tugmasini bosib yarating.
              </div>
            ) : (
              <div className="space-y-2">
                {(tasks || []).map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{task.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[task.status] || "bg-muted text-muted-foreground"}`}>
                          {statusLabel[task.status] || task.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {priorityLabel[task.priority] || task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {task.assignedToName && (
                          <span>👤 {task.assignedToName}</span>
                        )}
                        {task.locationName && (
                          <span>📍 {task.locationName}</span>
                        )}
                        {task.dueDate && (
                          <span>📅 {new Date(task.dueDate).toLocaleDateString("uz-UZ")}</span>
                        )}
                      </div>
                    </div>
                    {task.status !== "done" && task.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                        onClick={() => updateTaskMutation.mutate({ id: task.id, status: "done" })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Bajarildi
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {supervisorActions.map((action) => (
            <Card key={action.title} className="card-elegant">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <action.icon className="h-5 w-5" />
                </div>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <a href={action.href} className="btn-primary block w-full text-center">
                  Ochish
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Yangi topshiriq dialogi */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yangi topshiriq yaratish</DialogTitle>
            <DialogDescription>
              Agranomga yoki lokatsiyaga topshiriq bering.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sarlavha *</Label>
              <Input
                placeholder="Masalan: Teplitsa 1 dagi ko'chatlarni tekshiring"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tavsif</Label>
              <Textarea
                placeholder="Batafsil ko'rsatma yoki izoh..."
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Agranom (ixtiyoriy)</Label>
                <Select
                  value={taskForm.assignedTo}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, assignedTo: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belgilanmagan</SelectItem>
                    {agronomUsers.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.fullName || u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lokatsiya (ixtiyoriy)</Label>
                <Select
                  value={taskForm.locationId}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, locationId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belgilanmagan</SelectItem>
                    {(locations || []).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Muhimlik darajasi</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Past</SelectItem>
                    <SelectItem value="medium">O'rta</SelectItem>
                    <SelectItem value="high">Yuqori</SelectItem>
                    <SelectItem value="urgent">Shoshilinch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Muddati (ixtiyoriy)</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Bekor qilish</Button>
              <Button
                disabled={createTaskMutation.isPending || !taskForm.title.trim()}
                onClick={() => {
                  createTaskMutation.mutate({
                    title: taskForm.title.trim(),
                    description: taskForm.description.trim() || undefined,
                    locationId: taskForm.locationId && taskForm.locationId !== "none"
                      ? Number(taskForm.locationId) : undefined,
                    assignedTo: taskForm.assignedTo && taskForm.assignedTo !== "none"
                      ? Number(taskForm.assignedTo) : undefined,
                    priority: taskForm.priority,
                    dueDate: taskForm.dueDate || undefined,
                  });
                }}
              >
                {createTaskMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

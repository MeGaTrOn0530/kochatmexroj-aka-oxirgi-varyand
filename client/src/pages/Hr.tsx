import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardList, Plus, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("uz-UZ");
}

const priorityLabel: Record<string, string> = {
  low: "Past", normal: "O'rta", high: "Yuqori", urgent: "Shoshilinch",
};
const priorityColor: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};
const taskStatusLabel: Record<string, string> = {
  pending: "Kutilmoqda", in_progress: "Jarayonda", done: "Bajarildi",
};

export default function HrPage() {
  const utils = trpc.useUtils();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", assignedTo: "", locationId: "", priority: "normal", dueDate: "",
  });
  const [showTaskForm, setShowTaskForm] = useState(false);

  const { data: users } = trpc.admin.getAllUsers.useQuery();
  const { data: locations } = trpc.locations.getAll.useQuery();
  const { data: attendance } = trpc.hr.getAttendance.useQuery(selectedDate);
  const { data: tasks } = trpc.hr.getTasks.useQuery();

  const saveMutation = trpc.hr.saveAttendance.useMutation({
    onSuccess: async () => { toast.success("Davomat saqlandi"); await utils.hr.getAttendance.invalidate(); },
  });

  const addTaskMutation = trpc.hr.addTask.useMutation({
    onSuccess: async () => {
      toast.success("Topshiriq yaratildi");
      setShowTaskForm(false);
      setTaskForm({ title: "", description: "", assignedTo: "", locationId: "", priority: "normal", dueDate: "" });
      await utils.hr.getTasks.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const taskStatusMutation = trpc.hr.updateTaskStatus.useMutation({
    onSuccess: async () => { await utils.hr.getTasks.invalidate(); },
  });

  const removeTaskMutation = trpc.hr.removeTask.useMutation({
    onSuccess: async () => { await utils.hr.getTasks.invalidate(); },
  });

  const taskRows = tasks || [];
  const pending = taskRows.filter((t: any) => t.status === "pending").length;
  const inProgress = taskRows.filter((t: any) => t.status === "in_progress").length;
  const done = taskRows.filter((t: any) => t.status === "done").length;

  const todayAttendance = attendance || [];
  const presentCount = todayAttendance.filter((a: any) => a.status === "present").length;
  const absentCount = todayAttendance.filter((a: any) => a.status === "absent").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <UserCheck className="h-8 w-8 text-accent" />
            HR — Xodimlar boshqaruvi
          </h1>
          <p className="mt-1 text-muted-foreground">Davomat nazorati va topshiriqlar boshqaruvi.</p>
        </div>

        <Tabs defaultValue="tasks">
          <TabsList className="flex h-auto gap-2 rounded-2xl bg-muted/40 p-2">
            <TabsTrigger value="tasks" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Topshiriqlar
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <UserCheck className="h-4 w-4" /> Davomat
            </TabsTrigger>
          </TabsList>

          {/* ── TOPSHIRIQLAR ── */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            {/* Stat */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Kutilmoqda", count: pending, color: "text-muted-foreground" },
                { label: "Jarayonda", count: inProgress, color: "text-amber-600" },
                { label: "Bajarildi", count: done, color: "text-green-600" },
              ].map(({ label, count, color }) => (
                <Card key={label} className="card-elegant">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className={`mt-1 text-2xl font-bold ${color}`}>{count}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button className="gap-2" onClick={() => setShowTaskForm(v => !v)}>
              <Plus className="h-4 w-4" /> Yangi topshiriq
            </Button>

            {showTaskForm && (
              <Card className="card-elegant">
                <CardHeader>
                  <CardTitle className="text-base">Yangi topshiriq yaratish</CardTitle>
                  <CardDescription>Xodimga topshiriq bering va muddatini belgilang</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Sarlavha *</Label>
                    <Input value={taskForm.title}
                      onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>Mas'ul xodim</Label>
                      <Select value={taskForm.assignedTo}
                        onValueChange={v => setTaskForm(f => ({ ...f, assignedTo: v }))}>
                        <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                        <SelectContent>
                          {(users || []).map((u: any) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name || u.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Muhimlik darajasi</Label>
                      <Select value={taskForm.priority}
                        onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Past</SelectItem>
                          <SelectItem value="normal">O'rta</SelectItem>
                          <SelectItem value="high">Yuqori</SelectItem>
                          <SelectItem value="urgent">🔴 Shoshilinch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Muddat</Label>
                      <Input type="date" value={taskForm.dueDate}
                        onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Obyekt</Label>
                      <Select value={taskForm.locationId}
                        onValueChange={v => setTaskForm(f => ({ ...f, locationId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                        <SelectContent>
                          {(locations || []).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tavsif</Label>
                    <Textarea rows={2} value={taskForm.description}
                      onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowTaskForm(false)}>Bekor</Button>
                    <Button disabled={!taskForm.title || addTaskMutation.isPending}
                      onClick={() => addTaskMutation.mutate({
                        title: taskForm.title, description: taskForm.description || undefined,
                        assignedTo: taskForm.assignedTo ? Number(taskForm.assignedTo) : undefined,
                        locationId: taskForm.locationId ? Number(taskForm.locationId) : undefined,
                        priority: taskForm.priority, dueDate: taskForm.dueDate || undefined,
                      })}>
                      Yaratish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {taskRows.map((t: any) => (
                <div key={t.id}
                  className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-shadow hover:shadow-sm ${t.status === "done" ? "border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-900/10" : "border-border/60 bg-background"}`}>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                      <span className={`font-semibold ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {t.title}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColor[t.priority] || ""}`}>
                        {priorityLabel[t.priority] || t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {t.assigned_to_name?.trim() && <span>👤 {t.assigned_to_name.trim()}</span>}
                      {t.location_name && <span>📍 {t.location_name}</span>}
                      {t.due_date && <span>⏰ Muddat: {formatDate(t.due_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.status !== "done" && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => taskStatusMutation.mutate({
                          id: t.id, status: t.status === "pending" ? "in_progress" : "done",
                        })}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t.status === "pending" ? "Boshlash" : "Bajarildi"}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeTaskMutation.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {!taskRows.length && (
                <div className="py-16 text-center">
                  <ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">Topshiriqlar yo'q</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── DAVOMAT ── */}
          <TabsContent value="attendance" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Keldi", count: presentCount, color: "text-green-600" },
                { label: "Kelmadi", count: absentCount, color: "text-red-500" },
                { label: "Jami xodim", count: (users || []).length, color: "text-foreground" },
              ].map(({ label, count, color }) => (
                <Card key={label} className="card-elegant">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className={`mt-1 text-2xl font-bold ${color}`}>{count}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Label className="shrink-0">Sana:</Label>
              <Input type="date" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)} className="w-44" />
            </div>

            <Card className="card-elegant">
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        {["Xodim", "Rol", "Kirish", "Chiqish", "Holat"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(users || []).map((u: any) => {
                        const rec = todayAttendance.find((a: any) => a.user_id === u.id);
                        return (
                          <tr key={u.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2.5 font-medium">{u.name || u.username}</td>
                            <td className="px-3 py-2.5">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{u.role}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <Input type="time" className="h-7 w-28 text-xs"
                                defaultValue={rec?.check_in || ""}
                                onBlur={e => {
                                  if (e.target.value) {
                                    saveMutation.mutate({
                                      userId: u.id, workDate: selectedDate,
                                      checkIn: e.target.value, status: rec?.status || "present",
                                    });
                                  }
                                }} />
                            </td>
                            <td className="px-3 py-2.5">
                              <Input type="time" className="h-7 w-28 text-xs"
                                defaultValue={rec?.check_out || ""}
                                onBlur={e => {
                                  if (e.target.value) {
                                    saveMutation.mutate({
                                      userId: u.id, workDate: selectedDate,
                                      checkIn: rec?.check_in || undefined,
                                      checkOut: e.target.value, status: rec?.status || "present",
                                    });
                                  }
                                }} />
                            </td>
                            <td className="px-3 py-2.5">
                              <Select
                                value={rec?.status || ""}
                                onValueChange={v => saveMutation.mutate({
                                  userId: u.id, workDate: selectedDate, status: v,
                                  checkIn: rec?.check_in || undefined,
                                  checkOut: rec?.check_out || undefined,
                                })}>
                                <SelectTrigger className="h-7 w-36 text-xs">
                                  <SelectValue placeholder="Belgilanmagan" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="present">✓ Keldi</SelectItem>
                                  <SelectItem value="absent">✗ Kelmadi</SelectItem>
                                  <SelectItem value="late">⏰ Kech keldi</SelectItem>
                                  <SelectItem value="sick">🤒 Kasallangan</SelectItem>
                                  <SelectItem value="vacation">🌴 Ta'tilda</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

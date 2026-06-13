import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart3, FileText, Leaf, TrendingUp } from "lucide-react";

export default function BoshOfesDashboard() {
  const { data: stats } = trpc.dashboard.getStats.useQuery();

  const cards = [
    { label: "Jami partiyalar", value: stats?.totalBatches ?? "-", icon: Leaf, color: "text-green-600" },
    { label: "Jami lokatsiyalar", value: stats?.totalLocations ?? "-", icon: BarChart3, color: "text-blue-600" },
    { label: "Jami transferlar", value: stats?.totalTransfers ?? "-", icon: TrendingUp, color: "text-purple-600" },
    { label: "Tasdiq kutayotgan", value: stats?.pendingApprovals ?? "-", icon: FileText, color: "text-orange-600" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bosh Ofes paneli</h1>
          <p className="text-muted-foreground mt-1">Umumiy ko'rsatkichlar</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="card-elegant">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-2xl font-bold text-foreground">{value}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Kasetada", value: stats.greenhouseCassette, color: "bg-yellow-100 text-yellow-800" },
              { label: "Payvantlash", value: stats.greenhouseGrafting, color: "bg-orange-100 text-orange-800" },
              { label: "Payvantlangan", value: stats.greenhouseGrafted, color: "bg-blue-100 text-blue-800" },
              { label: "Tayyor", value: stats.greenhouseReady, color: "bg-green-100 text-green-800" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-4 ${color}`}>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-2xl font-bold mt-1">{value ?? 0} ta</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

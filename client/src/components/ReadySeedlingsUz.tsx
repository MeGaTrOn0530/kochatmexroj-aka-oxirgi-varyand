import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

interface ReadySeedlingsProps {
  batches: Array<{
    id: number;
    status: string;
    quantity: number;
    defectiveQuantity: number;
  }>;
}

export default function ReadySeedlingsUz({ batches }: ReadySeedlingsProps) {
  // Tayyor ko'chatlar sonini hisoblash
  const readyCount = useMemo(
    () =>
      batches
        .filter((batch) => batch.status === "ready")
        .reduce((sum, batch) => sum + (batch.quantity - batch.defectiveQuantity), 0),
    [batches]
  );

  return (
    <Card className="card-elegant">
      <CardHeader>
        <CardTitle className="text-base">Tayyor ko'chatlar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tayyor ko'chatlar soni</span>
          <span className="font-semibold text-green-600 text-2xl">{readyCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

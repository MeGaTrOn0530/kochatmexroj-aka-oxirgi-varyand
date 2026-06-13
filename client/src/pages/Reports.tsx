import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { escapeHtml, printHtmlDocument } from "@/lib/print-documents";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const stageLabel = {
  cassette: "Kasetada",
  sown: "Tuvakda",
  grafting: "Payvantlash",
  grafted: "Payvantlangan",
  ready: "Ko'chat (tayyor)",
} as const;

const stageLabelMap: Record<string, string> = {
  cassette: "Kasetada",
  sown: "Tuvakda",
  grafting: "Payvantlash",
  grafted: "Payvantlangan",
  ready: "Tayyor",
};

const statusLabelMap: Record<string, string> = {
  new: "Yangi",
  partial: "Qisman (bron)",
  fulfilled: "To'liq",
  shortage: "Yetishmaydi",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

const movementTypeLabel: Record<string, string> = {
  stage_change: "Bosqich o'zgarishi",
  transfer_in: "Transfer kirim",
  transfer_out: "Transfer chiqim",
  order_sale: "Sotish",
  defect_recorded: "Nuqson",
  received: "Kirim",
  adjustment: "Tuzatish",
};

const locationTypeLabel = {
  greenhouse: "Teplitsa",
  open_field: "Ochiq dala",
  laboratory: "Laboratoriya",
} as const;

type StageKey = keyof typeof stageLabel;
type SummaryBucketKey = "cassette" | "ungrafted" | "grafted" | "ready";

type SummaryStageTotals = {
  cassette: number;
  ungrafted: number;
  grafted: number;
  totalPodvoy: number;
  ready: number;
};

type SummaryRow = {
  locationId: number | null;
  locationName: string;
  locationCode: string;
  locationType: string;
  opening: SummaryStageTotals;
  incoming: {
    transfers: number;
    received: number;
    ungrafted: number;
    ready: number;
  };
  outgoing: {
    transfers: number;
    cassette: number;
    grafted: number;
  };
  ending: SummaryStageTotals;
  defectiveQuantity: number;
  realizedQuantity: number;
};

type DetailedTableRow = {
  id: string;
  fruitTypeName: string;
  varietyName: string;
  seedlingTypeName: string;
  openingQuantity: number;
  incomingByLocation: Record<string, number>;
  outgoingByLocation: Record<string, number>;
  totalIncoming: number;
  totalOutgoing: number;
  endingQuantity: number;
};

type GreenhouseReportRow = {
  id: string;
  stageKey: StageKey;
  seedlingTypeName: string;
  varietyName: string;
  rootstockTypeName: string;
  totalQuantity: number;
  quantitiesByLocation: Record<string, number>;
};

type GreenhouseStageGroup = {
  stageKey: StageKey;
  title: string;
  rows: GreenhouseReportRow[];
  total: GreenhouseReportRow;
};

const greenhouseSectionLabel: Record<StageKey, string> = {
  cassette: "I. Kasetadagi ko'chatlar",
  sown: "II. Tuvakdagi ko'chatlar",
  grafting: "III. Payvantlash bosqichidagi ko'chatlar",
  grafted: "IV. Payvantlangan ko'chatlar",
  ready: "V. Tayyor ko'chatlar",
};

const greenhouseStageOrder: StageKey[] = ["cassette", "sown", "grafting", "grafted", "ready"];

function parseDateInput(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value || 0)));
}

function formatDateLabel(value: string) {
  if (!value) {
    return "__.__.____";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function buildRangeLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return "joriy holat bo'yicha";
  }

  if (startDate && endDate) {
    return `${formatDateLabel(startDate)} dan ${formatDateLabel(endDate)} gacha`;
  }

  if (startDate) {
    return `${formatDateLabel(startDate)} dan boshlab`;
  }

  return `${formatDateLabel(endDate)} gacha`;
}

function getLocationOrder(name: string) {
  const value = String(name || "").trim();
  const number = Number(value.match(/(\d+)/)?.[1] || 0);

  if (/teplitsa/i.test(value)) {
    return 100 + number;
  }

  if (/ochiq/i.test(value)) {
    return 200 + number;
  }

  if (/labor/i.test(value)) {
    return 300 + number;
  }

  return 400 + number;
}

function sortLocationNames(a: string, b: string) {
  const orderDiff = getLocationOrder(a) - getLocationOrder(b);
  if (orderDiff !== 0) {
    return orderDiff;
  }

  return a.localeCompare(b, "uz");
}

function getSummaryBucket(stage: string | null | undefined): SummaryBucketKey {
  switch (stage) {
    case "grafting":
      return "ungrafted";
    case "grafted":
    case "sown":
      return "grafted";
    case "ready":
      return "ready";
    default:
      return "cassette";
  }
}

function createSummaryTotals(): SummaryStageTotals {
  return {
    cassette: 0,
    ungrafted: 0,
    grafted: 0,
    totalPodvoy: 0,
    ready: 0,
  };
}

function cloneSummaryTotals(value: SummaryStageTotals): SummaryStageTotals {
  return {
    cassette: value.cassette,
    ungrafted: value.ungrafted,
    grafted: value.grafted,
    totalPodvoy: value.totalPodvoy,
    ready: value.ready,
  };
}

function addToSummaryTotals(target: SummaryStageTotals, bucket: SummaryBucketKey, amount: number) {
  target[bucket] += amount;
  target.totalPodvoy = target.ungrafted + target.grafted;
}

function sumSummaryTotals(items: SummaryStageTotals[]) {
  return items.reduce((acc, item) => {
    acc.cassette += item.cassette;
    acc.ungrafted += item.ungrafted;
    acc.grafted += item.grafted;
    acc.ready += item.ready;
    acc.totalPodvoy = acc.ungrafted + acc.grafted;
    return acc;
  }, createSummaryTotals());
}

function distributeTotals(ending: SummaryStageTotals, targetTotal: number) {
  const keys: Array<Exclude<keyof SummaryStageTotals, "totalPodvoy">> = [
    "cassette",
    "ungrafted",
    "grafted",
    "ready",
  ];
  const endingTotal = keys.reduce((sum, key) => sum + ending[key], 0);

  if (!endingTotal || targetTotal <= 0) {
    return createSummaryTotals();
  }

  const scaled = keys.map((key) => {
    const raw = (ending[key] / endingTotal) * targetTotal;
    return {
      key,
      base: Math.floor(raw),
      fraction: raw - Math.floor(raw),
    };
  });

  let remainder = targetTotal - scaled.reduce((sum, item) => sum + item.base, 0);
  scaled.sort((a, b) => b.fraction - a.fraction);

  for (const item of scaled) {
    if (remainder <= 0) {
      break;
    }

    item.base += 1;
    remainder -= 1;
  }

  const result = createSummaryTotals();
  for (const item of scaled) {
    result[item.key] = item.base;
  }
  result.totalPodvoy = result.ungrafted + result.grafted;
  return result;
}

function isWithinRange(dateValue: string | null | undefined, startDate: string, endDate: string) {
  if (!dateValue || (!startDate && !endDate)) {
    return false;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (date < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (date > end) {
      return false;
    }
  }

  return true;
}

function parseBoundaryDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMovementDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subtractFromSummaryTotals(target: SummaryStageTotals, bucket: SummaryBucketKey, amount: number) {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (!safeAmount) {
    return;
  }

  target[bucket] = Math.max(0, target[bucket] - safeAmount);
  target.totalPodvoy = target.ungrafted + target.grafted;
}

function isTransferMovement(row: any) {
  return row?.movementType === "transfer_in" || row?.movementType === "transfer_out";
}

function extractFruitType(seedlingTypeName: string, varietyName: string) {
  const typeValue = String(seedlingTypeName || "").trim();
  if (!typeValue || /aniqlanmagan/i.test(typeValue)) {
    return "Aniqlanmagan";
  }

  const cleaned = typeValue.replace(/\s+ko['’`]?chati$/i, "").trim();
  if (cleaned) {
    return cleaned;
  }

  if (varietyName && !/aniqlanmagan/i.test(varietyName)) {
    return varietyName.split(" ")[0];
  }

  return typeValue;
}

function buildTableExport(tableId: string, title: string, subtitle: string, fileName: string) {
  const table = document.getElementById(tableId);

  if (!table) {
    return;
  }

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { margin: 0 0 6px; font-size: 18px; }
        p { margin: 0 0 18px; font-size: 12px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #1f2937; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
        thead th { font-weight: 700; text-align: center; }
        .report-group-head { background: #dceaf7; }
        .report-sub-head { background: #eef5fb; }
        .report-total { background: #f3f7ea; font-weight: 700; }
        .report-section { background: #ecfccb; font-weight: 700; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      ${table.outerHTML}
    </body>
  </html>`;

  const blob = new Blob([`\ufeff${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function calculateSummaryReportTotals(rows: SummaryRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.opening = sumSummaryTotals([acc.opening, row.opening]);
      acc.incoming.transfers += row.incoming.transfers;
      acc.incoming.ungrafted += row.incoming.ungrafted + row.incoming.received;
      acc.incoming.ready += row.incoming.ready;
      acc.outgoing.transfers += row.outgoing.transfers;
      acc.outgoing.cassette += row.outgoing.cassette;
      acc.outgoing.grafted += row.outgoing.grafted;
      acc.ending = sumSummaryTotals([acc.ending, row.ending]);
      acc.realizedQuantity += row.realizedQuantity;
      return acc;
    },
    {
      opening: createSummaryTotals(),
      incoming: { transfers: 0, ungrafted: 0, ready: 0 },
      outgoing: { transfers: 0, cassette: 0, grafted: 0 },
      ending: createSummaryTotals(),
      realizedQuantity: 0,
    }
  );
}

function hasSummaryActivity(row: SummaryRow) {
  return [
    row.opening.cassette,
    row.opening.ungrafted,
    row.opening.grafted,
    row.opening.ready,
    row.incoming.transfers,
    row.incoming.received,
    row.incoming.ungrafted,
    row.incoming.ready,
    row.outgoing.transfers,
    row.outgoing.cassette,
    row.outgoing.grafted,
    row.ending.cassette,
    row.ending.ungrafted,
    row.ending.grafted,
    row.ending.ready,
    row.realizedQuantity,
    row.defectiveQuantity,
  ].some((value) => Number(value || 0) > 0);
}

function hasDetailedActivity(row: DetailedTableRow, locationColumns: string[]) {
  if (
    Number(row.openingQuantity || 0) > 0 ||
    Number(row.totalIncoming || 0) > 0 ||
    Number(row.totalOutgoing || 0) > 0 ||
    Number(row.endingQuantity || 0) > 0
  ) {
    return true;
  }

  return locationColumns.some(
    (locationName) =>
      Number(row.incomingByLocation[locationName] || 0) > 0 ||
      Number(row.outgoingByLocation[locationName] || 0) > 0
  );
}

function splitColumnsForPrint(columns: string[]) {
  if (!columns.length) {
    return [[]];
  }

  if (columns.length <= 2) {
    return [columns];
  }

  const midpoint = Math.ceil(columns.length / 2);
  return [columns.slice(0, midpoint), columns.slice(midpoint)];
}

function chunkColumns(columns: string[], chunkSize: number) {
  if (!columns.length) {
    return [[]];
  }

  const parts = [];
  for (let index = 0; index < columns.length; index += chunkSize) {
    parts.push(columns.slice(index, index + chunkSize));
  }
  return parts;
}

function buildSummaryReportPrintBody(rows: SummaryRow[], startDate: string, endDate: string) {
  const totals = calculateSummaryReportTotals(rows);
  const sections = [
    {
      title: "1-qism: Davr boshi va kirim",
      columns: [
        {
          label: `Kasetada (${startDate ? formatDateLabel(startDate) : "davr boshi"})`,
          getValue: (row: SummaryRow) => formatNumber(row.opening.cassette),
          getTotal: () => formatNumber(totals.opening.cassette),
        },
        {
          label: `Payvand qilinmagan (${startDate ? formatDateLabel(startDate) : "davr boshi"})`,
          getValue: (row: SummaryRow) => formatNumber(row.opening.ungrafted),
          getTotal: () => formatNumber(totals.opening.ungrafted),
        },
        {
          label: `Payvand qilingan (${startDate ? formatDateLabel(startDate) : "davr boshi"})`,
          getValue: (row: SummaryRow) => formatNumber(row.opening.grafted),
          getTotal: () => formatNumber(totals.opening.grafted),
        },
        {
          label: `Jami podvoy (${startDate ? formatDateLabel(startDate) : "davr boshi"})`,
          getValue: (row: SummaryRow) => formatNumber(row.opening.totalPodvoy),
          getTotal: () => formatNumber(totals.opening.totalPodvoy),
        },
        {
          label: `Tayyor ko'chat (${startDate ? formatDateLabel(startDate) : "davr boshi"})`,
          getValue: (row: SummaryRow) => formatNumber(row.opening.ready),
          getTotal: () => formatNumber(totals.opening.ready),
        },
        {
          label: "Perikidka kirimi",
          getValue: (row: SummaryRow) => formatNumber(row.incoming.transfers),
          getTotal: () => formatNumber(totals.incoming.transfers),
        },
        {
          label: "Payvand qilinmagan kirimi",
          getValue: (row: SummaryRow) => formatNumber(row.incoming.ungrafted + row.incoming.received),
          getTotal: () => formatNumber(totals.incoming.ungrafted),
        },
        {
          label: "Tayyor ko'chat kirimi",
          getValue: (row: SummaryRow) => formatNumber(row.incoming.ready),
          getTotal: () => formatNumber(totals.incoming.ready),
        },
      ],
    },
    {
      title: "2-qism: Chiqim va davr oxiri",
      columns: [
        {
          label: "Perikidka chiqimi",
          getValue: (row: SummaryRow) => formatNumber(row.outgoing.transfers),
          getTotal: () => formatNumber(totals.outgoing.transfers),
        },
        {
          label: "Kasetada chiqim",
          getValue: (row: SummaryRow) => formatNumber(row.outgoing.cassette),
          getTotal: () => formatNumber(totals.outgoing.cassette),
        },
        {
          label: "Payvand qilingan chiqim",
          getValue: (row: SummaryRow) => formatNumber(row.outgoing.grafted),
          getTotal: () => formatNumber(totals.outgoing.grafted),
        },
        {
          label: `Kasetada (${endDate ? formatDateLabel(endDate) : "davr oxiri"})`,
          getValue: (row: SummaryRow) => formatNumber(row.ending.cassette),
          getTotal: () => formatNumber(totals.ending.cassette),
        },
        {
          label: `Payvand qilinmagan (${endDate ? formatDateLabel(endDate) : "davr oxiri"})`,
          getValue: (row: SummaryRow) => formatNumber(row.ending.ungrafted),
          getTotal: () => formatNumber(totals.ending.ungrafted),
        },
        {
          label: `Payvand qilingan (${endDate ? formatDateLabel(endDate) : "davr oxiri"})`,
          getValue: (row: SummaryRow) => formatNumber(row.ending.grafted),
          getTotal: () => formatNumber(totals.ending.grafted),
        },
        {
          label: `Jami podvoy (${endDate ? formatDateLabel(endDate) : "davr oxiri"})`,
          getValue: (row: SummaryRow) => formatNumber(row.ending.totalPodvoy),
          getTotal: () => formatNumber(totals.ending.totalPodvoy),
        },
        {
          label: `Tayyor ko'chat (${endDate ? formatDateLabel(endDate) : "davr oxiri"})`,
          getValue: (row: SummaryRow) => formatNumber(row.ending.ready),
          getTotal: () => formatNumber(totals.ending.ready),
        },
        {
          label: "Realizatsiya",
          getValue: (row: SummaryRow) => formatNumber(row.realizedQuantity),
          getTotal: () => formatNumber(totals.realizedQuantity),
        },
      ],
    },
  ];

  return sections
    .map(
      (section) => `
        <section class="report-part">
          <h2>${escapeHtml(section.title)}</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 52px;">№</th>
                <th class="text-left">Obyekt nomi</th>
                ${section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td class="text-left">
                        <div>${escapeHtml(row.locationName)}</div>
                        <div class="muted">
                          ${escapeHtml(
                            `${locationTypeLabel[row.locationType as keyof typeof locationTypeLabel] || row.locationType}${
                              row.locationCode ? ` · ${row.locationCode}` : ""
                            }`
                          )}
                        </div>
                      </td>
                      ${section.columns.map((column) => `<td>${column.getValue(row)}</td>`).join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>Jami</strong></td>
                ${section.columns.map((column) => `<td><strong>${column.getTotal()}</strong></td>`).join("")}
              </tr>
            </tfoot>
          </table>
        </section>
      `
    )
    .join("");
}

function buildDetailedReportPrintBody(
  groupedRows: Array<{ fruitTypeName: string; rows: DetailedTableRow[]; total: DetailedTableRow }>,
  totalRow: DetailedTableRow,
  locationColumns: string[]
) {
  const columnParts = splitColumnsForPrint(locationColumns);

  return columnParts
    .map((columnPart, partIndex) => {
      const rowsHtml = groupedRows
        .map((group) => {
          const groupRowsHtml = group.rows
            .map(
              (row, rowIndex) => `
                <tr>
                  <td>${rowIndex + 1}</td>
                  <td class="text-left">${escapeHtml(row.fruitTypeName)}</td>
                  <td class="text-left">${escapeHtml(row.varietyName)}</td>
                  <td class="text-left">${escapeHtml(row.seedlingTypeName)}</td>
                  <td>${formatNumber(row.openingQuantity)}</td>
                  ${columnPart
                    .map((locationName) => `<td>${formatNumber(row.incomingByLocation[locationName] || 0)}</td>`)
                    .join("")}
                  <td>${formatNumber(row.totalIncoming)}</td>
                  ${columnPart
                    .map((locationName) => `<td>${formatNumber(row.outgoingByLocation[locationName] || 0)}</td>`)
                    .join("")}
                  <td>${formatNumber(row.totalOutgoing)}</td>
                  <td>${formatNumber(row.endingQuantity)}</td>
                </tr>
              `
            )
            .join("");

          const groupTotalHtml = `
            <tr>
              <td colspan="4"><strong>${escapeHtml(group.fruitTypeName)} jami</strong></td>
              <td><strong>${formatNumber(group.total.openingQuantity)}</strong></td>
              ${columnPart
                .map(
                  (locationName) =>
                    `<td><strong>${formatNumber(group.total.incomingByLocation[locationName] || 0)}</strong></td>`
                )
                .join("")}
              <td><strong>${formatNumber(group.total.totalIncoming)}</strong></td>
              ${columnPart
                .map(
                  (locationName) =>
                    `<td><strong>${formatNumber(group.total.outgoingByLocation[locationName] || 0)}</strong></td>`
                )
                .join("")}
              <td><strong>${formatNumber(group.total.totalOutgoing)}</strong></td>
              <td><strong>${formatNumber(group.total.endingQuantity)}</strong></td>
            </tr>
          `;

          return `
            <tr>
              <td colspan="${8 + columnPart.length * 2}"><strong>${escapeHtml(group.fruitTypeName)}</strong></td>
            </tr>
            ${groupRowsHtml}
            ${groupTotalHtml}
          `;
        })
        .join("");

      return `
        <section class="report-part">
          <h2>${escapeHtml(
            columnParts.length > 1 ? `Qism ${partIndex + 1}` : "Batafsil jadval"
          )}</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 52px;">№</th>
                <th class="text-left">Meva turi</th>
                <th class="text-left">Ko'chat navi</th>
                <th class="text-left">Ko'chat turi</th>
                <th>Boshlang'ich qoldiq</th>
                ${columnPart.map((locationName) => `<th>${escapeHtml(locationName)} dan</th>`).join("")}
                <th>Jami kirim</th>
                ${columnPart.map((locationName) => `<th>${escapeHtml(locationName)} ga</th>`).join("")}
                <th>Jami chiqim</th>
                <th>Yakuniy qoldiq</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"><strong>Umumiy jami</strong></td>
                <td><strong>${formatNumber(totalRow.openingQuantity)}</strong></td>
                ${columnPart
                  .map(
                    (locationName) =>
                      `<td><strong>${formatNumber(totalRow.incomingByLocation[locationName] || 0)}</strong></td>`
                  )
                  .join("")}
                <td><strong>${formatNumber(totalRow.totalIncoming)}</strong></td>
                ${columnPart
                  .map(
                    (locationName) =>
                      `<td><strong>${formatNumber(totalRow.outgoingByLocation[locationName] || 0)}</strong></td>`
                  )
                  .join("")}
                <td><strong>${formatNumber(totalRow.totalOutgoing)}</strong></td>
                <td><strong>${formatNumber(totalRow.endingQuantity)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </section>
      `;
    })
    .join("");
}

function buildGreenhouseReportPrintBody(
  stageGroups: GreenhouseStageGroup[],
  totalRow: GreenhouseReportRow,
  greenhouseColumns: string[],
  reportDate: string
) {
  const columnParts = chunkColumns(greenhouseColumns, 4);

  return columnParts
    .map((columnPart, partIndex) => {
      const columnSpan = 5 + columnPart.length;
      const totalsRow = `
        <tr class="report-total">
          <td colspan="4"><strong>Hammasi</strong></td>
          <td><strong>${formatNumber(totalRow.totalQuantity)}</strong></td>
          ${columnPart
            .map(
              (locationName) =>
                `<td><strong>${formatNumber(totalRow.quantitiesByLocation[locationName] || 0)}</strong></td>`
            )
            .join("")}
        </tr>
      `;

      const sectionsHtml = stageGroups
        .map((group) => {
          const rowsHtml = group.rows
            .map(
              (row, rowIndex) => `
                <tr>
                  <td>${rowIndex + 1}</td>
                  <td class="text-left">${escapeHtml(row.seedlingTypeName)}</td>
                  <td class="text-left">${escapeHtml(row.varietyName)}</td>
                  <td class="text-left">${escapeHtml(row.rootstockTypeName)}</td>
                  <td>${formatNumber(row.totalQuantity)}</td>
                  ${columnPart
                    .map(
                      (locationName) =>
                        `<td>${formatNumber(row.quantitiesByLocation[locationName] || 0)}</td>`
                    )
                    .join("")}
                </tr>
              `
            )
            .join("");

          return `
            <tr class="report-section">
              <td colspan="${columnSpan}"><strong>${escapeHtml(group.title)}</strong></td>
            </tr>
            <tr class="report-total">
              <td colspan="4"><strong>Jami</strong></td>
              <td><strong>${formatNumber(group.total.totalQuantity)}</strong></td>
              ${columnPart
                .map(
                  (locationName) =>
                    `<td><strong>${formatNumber(group.total.quantitiesByLocation[locationName] || 0)}</strong></td>`
                )
                .join("")}
            </tr>
            ${rowsHtml}
          `;
        })
        .join("");

      return `
        <section class="report-part">
          <div style="margin-bottom: 14px;">
            <div style="font-size: 22px; font-weight: 800; text-align: center; text-transform: uppercase;">
              Bo'limlar bo'yicha mavjud payvandtag va ko'chatlar to'g'risida ma'lumot
            </div>
            <div style="margin-top: 8px; text-align: right; font-size: 14px; font-weight: 700;">
              ${escapeHtml(formatDateLabel(reportDate))} y.
            </div>
            ${
              columnParts.length > 1
                ? `<div class="muted" style="margin-top: 6px;">Qism ${partIndex + 1}</div>`
                : ""
            }
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 52px;">№</th>
                <th class="text-left">Ko'chat nomi</th>
                <th class="text-left">Ko'chat navi</th>
                <th class="text-left">Payvandtag nomi</th>
                <th>Jami</th>
                ${columnPart.map((locationName) => `<th>${escapeHtml(locationName)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${totalsRow}
              ${sectionsHtml}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");
}

function SummaryReportTable({
  rows,
  tableId,
  startDate,
  endDate,
}: {
  rows: SummaryRow[];
  tableId: string;
  startDate: string;
  endDate: string;
}) {
  const startCaption = startDate ? formatDateLabel(startDate) : "Davr boshi";
  const endCaption = endDate ? formatDateLabel(endDate) : "Davr oxiri";
  const totals = rows.reduce(
    (acc, row) => {
      acc.opening = sumSummaryTotals([acc.opening, row.opening]);
      acc.incoming.transfers += row.incoming.transfers;
      acc.incoming.ungrafted += row.incoming.ungrafted + row.incoming.received;
      acc.incoming.ready += row.incoming.ready;
      acc.outgoing.transfers += row.outgoing.transfers;
      acc.outgoing.cassette += row.outgoing.cassette;
      acc.outgoing.grafted += row.outgoing.grafted;
      acc.ending = sumSummaryTotals([acc.ending, row.ending]);
      acc.realizedQuantity += row.realizedQuantity;
      return acc;
    },
    {
      opening: createSummaryTotals(),
      incoming: { transfers: 0, ungrafted: 0, ready: 0 },
      outgoing: { transfers: 0, cassette: 0, grafted: 0 },
      ending: createSummaryTotals(),
      realizedQuantity: 0,
    }
  );

  return (
    <div className="overflow-x-auto rounded-[1.75rem] border border-border/70 bg-background shadow-sm">
      <table id={tableId} className="report-table min-w-[1500px] border-collapse text-sm">
        <thead>
          <tr className="report-group-head bg-sky-100 dark:bg-sky-900/40 dark:text-sky-100">
            <th rowSpan={2} className="min-w-14 border border-border px-3 py-3 text-center font-semibold">
              №
            </th>
            <th rowSpan={2} className="min-w-[220px] border border-border px-3 py-3 text-left font-semibold">
              Obyekt nomi
            </th>
            <th colSpan={5} className="border border-border px-3 py-3 text-center font-semibold">
              Davr boshidagi qoldiq ({startCaption})
            </th>
            <th colSpan={3} className="border border-border px-3 py-3 text-center font-semibold">
              Davr ichidagi kirim
            </th>
            <th colSpan={3} className="border border-border px-3 py-3 text-center font-semibold">
              Davr ichidagi chiqim
            </th>
            <th colSpan={5} className="border border-border px-3 py-3 text-center font-semibold">
              Davr oxiridagi qoldiq ({endCaption})
            </th>
            <th rowSpan={2} className="min-w-[110px] border border-border px-3 py-3 text-center font-semibold">
              Realizatsiya
            </th>
          </tr>
          <tr className="report-sub-head bg-slate-50 dark:bg-slate-800/60 dark:text-slate-200">
            <th className="border border-border px-3 py-2 text-center font-medium">Kasetada</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilinmagan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilingan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Jami podvoy</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Tayyor ko'chat</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Perikidka</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilinmagan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Tayyor ko'chat</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Perikidka</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Kasetada</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilingan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Kasetada</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilinmagan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Payvand qilingan</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Jami podvoy</th>
            <th className="border border-border px-3 py-2 text-center font-medium">Tayyor ko'chat</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={19} className="border border-border px-4 py-10 text-center text-muted-foreground">
                Tanlangan filtrlar bo'yicha umumiy hisobot topilmadi.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.locationName} className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-transparent dark:even:bg-slate-800/20">
                <td className="border border-border px-3 py-3 text-center font-medium">{index + 1}</td>
                <td className="border border-border px-3 py-3">
                  <div className="font-semibold text-foreground">{row.locationName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {locationTypeLabel[row.locationType as keyof typeof locationTypeLabel] || row.locationType}
                    {row.locationCode ? ` · ${row.locationCode}` : ""}
                  </div>
                </td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.opening.cassette)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.opening.ungrafted)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.opening.grafted)}</td>
                <td className="border border-border px-3 py-3 text-center font-semibold">{formatNumber(row.opening.totalPodvoy)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.opening.ready)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.incoming.transfers)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.incoming.ungrafted + row.incoming.received)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.incoming.ready)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.outgoing.transfers)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.outgoing.cassette)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.outgoing.grafted)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.ending.cassette)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.ending.ungrafted)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.ending.grafted)}</td>
                <td className="border border-border px-3 py-3 text-center font-semibold">{formatNumber(row.ending.totalPodvoy)}</td>
                <td className="border border-border px-3 py-3 text-center">{formatNumber(row.ending.ready)}</td>
                <td className="border border-border px-3 py-3 text-center font-semibold">{formatNumber(row.realizedQuantity)}</td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length ? (
          <tfoot>
            <tr className="report-total bg-lime-50 dark:bg-lime-900/25 font-semibold">
              <td className="border border-border px-3 py-3 text-center" colSpan={2}>
                Jami
              </td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.opening.cassette)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.opening.ungrafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.opening.grafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.opening.totalPodvoy)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.opening.ready)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.incoming.transfers)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.incoming.ungrafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.incoming.ready)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.outgoing.transfers)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.outgoing.cassette)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.outgoing.grafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.ending.cassette)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.ending.ungrafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.ending.grafted)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.ending.totalPodvoy)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.ending.ready)}</td>
              <td className="border border-border px-3 py-3 text-center">{formatNumber(totals.realizedQuantity)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function DetailTotalsRow({
  label,
  row,
  locationColumns,
}: {
  label: string;
  row: DetailedTableRow;
  locationColumns: string[];
}) {
  return (
    <tr className="report-total bg-lime-50 dark:bg-lime-900/25 font-semibold">
      <td className="border border-border px-3 py-3 text-center" colSpan={4}>
        {label}
      </td>
      <td className="border border-border px-3 py-3 text-center">{formatNumber(row.openingQuantity)}</td>
      {locationColumns.map((locationName) => (
        <td key={`in-${label}-${locationName}`} className="border border-border px-3 py-3 text-center">
          {formatNumber(row.incomingByLocation[locationName] || 0)}
        </td>
      ))}
      <td className="border border-border px-3 py-3 text-center">{formatNumber(row.totalIncoming)}</td>
      {locationColumns.map((locationName) => (
        <td key={`out-${label}-${locationName}`} className="border border-border px-3 py-3 text-center">
          {formatNumber(row.outgoingByLocation[locationName] || 0)}
        </td>
      ))}
      <td className="border border-border px-3 py-3 text-center">{formatNumber(row.totalOutgoing)}</td>
      <td className="border border-border px-3 py-3 text-center">{formatNumber(row.endingQuantity)}</td>
    </tr>
  );
}

function DetailedReportTable({
  groupedRows,
  totalRow,
  locationColumns,
  tableId,
}: {
  groupedRows: Array<{ fruitTypeName: string; rows: DetailedTableRow[]; total: DetailedTableRow }>;
  totalRow: DetailedTableRow;
  locationColumns: string[];
  tableId: string;
}) {
  const columnSpan = 8 + locationColumns.length * 2;

  return (
    <div className="overflow-x-auto rounded-[1.75rem] border border-border/70 bg-background shadow-sm">
      <table id={tableId} className="report-table min-w-[1900px] border-collapse text-sm">
        <thead>
          <tr className="report-group-head bg-sky-100 dark:bg-sky-900/40 dark:text-sky-100">
            <th rowSpan={2} className="min-w-14 border border-border px-3 py-3 text-center font-semibold">
              №
            </th>
            <th rowSpan={2} className="min-w-[140px] border border-border px-3 py-3 text-left font-semibold">
              Meva turi
            </th>
            <th rowSpan={2} className="min-w-[170px] border border-border px-3 py-3 text-left font-semibold">
              Ko'chat navi
            </th>
            <th rowSpan={2} className="min-w-[170px] border border-border px-3 py-3 text-left font-semibold">
              Ko'chat turi
            </th>
            <th rowSpan={2} className="min-w-[120px] border border-border px-3 py-3 text-center font-semibold">
              Boshlang'ich qoldiq
            </th>
            <th colSpan={locationColumns.length + 1} className="border border-border px-3 py-3 text-center font-semibold">
              Kirim
            </th>
            <th colSpan={locationColumns.length + 1} className="border border-border px-3 py-3 text-center font-semibold">
              Chiqim
            </th>
            <th rowSpan={2} className="min-w-[120px] border border-border px-3 py-3 text-center font-semibold">
              Yakuniy qoldiq
            </th>
          </tr>
          <tr className="report-sub-head bg-slate-50 dark:bg-slate-800/60 dark:text-slate-200">
            {locationColumns.map((locationName) => (
              <th key={`in-head-${locationName}`} className="min-w-[118px] border border-border px-3 py-2 text-center font-medium">
                {locationName} dan
              </th>
            ))}
            <th className="min-w-[110px] border border-border px-3 py-2 text-center font-medium">Jami kirim</th>
            {locationColumns.map((locationName) => (
              <th key={`out-head-${locationName}`} className="min-w-[118px] border border-border px-3 py-2 text-center font-medium">
                {locationName} ga
              </th>
            ))}
            <th className="min-w-[110px] border border-border px-3 py-2 text-center font-medium">Jami chiqim</th>
          </tr>
        </thead>
        <tbody>
          {!groupedRows.length ? (
            <tr>
              <td colSpan={columnSpan} className="border border-border px-4 py-10 text-center text-muted-foreground">
                Tanlangan filtrlar bo'yicha batafsil hisobot topilmadi.
              </td>
            </tr>
          ) : (
            groupedRows.flatMap((group, groupIndex) => {
              const groupRows = [
                <tr key={`group-${group.fruitTypeName}-${groupIndex}`} className="report-section bg-lime-50/80 dark:bg-lime-900/20">
                  <td colSpan={columnSpan} className="border border-border px-4 py-3 text-left font-semibold">
                    {group.fruitTypeName}
                  </td>
                </tr>,
              ];

              group.rows.forEach((row, rowIndex) => {
                groupRows.push(
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-transparent dark:even:bg-slate-800/20">
                    <td className="border border-border px-3 py-3 text-center font-medium">{rowIndex + 1}</td>
                    <td className="border border-border px-3 py-3">{row.fruitTypeName}</td>
                    <td className="border border-border px-3 py-3">{row.varietyName}</td>
                    <td className="border border-border px-3 py-3">{row.seedlingTypeName}</td>
                    <td className="border border-border px-3 py-3 text-center">{formatNumber(row.openingQuantity)}</td>
                    {locationColumns.map((locationName) => (
                      <td key={`${row.id}-in-${locationName}`} className="border border-border px-3 py-3 text-center">
                        {formatNumber(row.incomingByLocation[locationName] || 0)}
                      </td>
                    ))}
                    <td className="border border-border px-3 py-3 text-center font-medium">{formatNumber(row.totalIncoming)}</td>
                    {locationColumns.map((locationName) => (
                      <td key={`${row.id}-out-${locationName}`} className="border border-border px-3 py-3 text-center">
                        {formatNumber(row.outgoingByLocation[locationName] || 0)}
                      </td>
                    ))}
                    <td className="border border-border px-3 py-3 text-center font-medium">{formatNumber(row.totalOutgoing)}</td>
                    <td className="border border-border px-3 py-3 text-center font-semibold">{formatNumber(row.endingQuantity)}</td>
                  </tr>
                );
              });

              groupRows.push(
                <DetailTotalsRow
                  key={`total-${group.fruitTypeName}-${groupIndex}`}
                  label={`${group.fruitTypeName} jami`}
                  row={group.total}
                  locationColumns={locationColumns}
                />
              );

              return groupRows;
            })
          )}
        </tbody>
        {groupedRows.length ? (
          <tfoot>
            <DetailTotalsRow label="Umumiy jami" row={totalRow} locationColumns={locationColumns} />
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function GreenhouseReportTable({
  stageGroups,
  totalRow,
  greenhouseColumns,
  tableId,
  reportDate,
}: {
  stageGroups: GreenhouseStageGroup[];
  totalRow: GreenhouseReportRow;
  greenhouseColumns: string[];
  tableId: string;
  reportDate: string;
}) {
  const columnSpan = 5 + greenhouseColumns.length;

  return (
    <div className="overflow-x-auto rounded-[1.75rem] border border-border/70 bg-background shadow-sm">
      <table id={tableId} className="report-table min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={columnSpan} className="border border-border px-4 py-4 text-center text-2xl font-black uppercase">
              Bo&apos;limlar bo&apos;yicha mavjud payvandtag va ko&apos;chatlar to&apos;g&apos;risida ma&apos;lumot
            </th>
          </tr>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            <th colSpan={columnSpan} className="border border-border px-4 py-3 text-right text-lg font-bold italic">
              {formatDateLabel(reportDate)} y.
            </th>
          </tr>
          <tr className="report-group-head bg-sky-100 dark:bg-sky-900/40 dark:text-sky-100">
            <th className="min-w-14 border border-border px-3 py-3 text-center font-semibold">№</th>
            <th className="min-w-[190px] border border-border px-3 py-3 text-left font-semibold">
              Ko&apos;chat nomi
            </th>
            <th className="min-w-[190px] border border-border px-3 py-3 text-left font-semibold">
              Ko&apos;chat navi
            </th>
            <th className="min-w-[190px] border border-border px-3 py-3 text-left font-semibold">
              Payvandtag nomi
            </th>
            <th className="min-w-[120px] border border-border px-3 py-3 text-center font-semibold">
              Jami
            </th>
            {greenhouseColumns.map((locationName) => (
              <th key={locationName} className="min-w-[135px] border border-border px-3 py-3 text-center font-semibold">
                {locationName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!stageGroups.length ? (
            <tr>
              <td colSpan={columnSpan} className="border border-border px-4 py-10 text-center text-muted-foreground">
                Tanlangan filtrlar bo&apos;yicha bo&apos;limlar hisobot topilmadi.
              </td>
            </tr>
          ) : (
            <>
              <tr className="report-total bg-amber-50">
                <td colSpan={4} className="border border-border px-4 py-3 text-center text-xl font-bold text-slate-900">
                  Hammasi
                </td>
                <td className="border border-border px-3 py-3 text-center text-xl font-bold text-slate-900">
                  {formatNumber(totalRow.totalQuantity)}
                </td>
                {greenhouseColumns.map((locationName) => (
                  <td key={`overall-${locationName}`} className="border border-border px-3 py-3 text-center text-xl font-bold text-slate-900">
                    {formatNumber(totalRow.quantitiesByLocation[locationName] || 0)}
                  </td>
                ))}
              </tr>
              {stageGroups.flatMap((group) => [
                <tr key={`${group.stageKey}-section`} className="report-section bg-sky-50">
                  <td colSpan={columnSpan} className="border border-border px-4 py-3 text-left text-xl font-bold">
                    {group.title}
                  </td>
                </tr>,
                <tr key={`${group.stageKey}-total`} className="report-total bg-slate-50 dark:bg-slate-800/50">
                  <td colSpan={4} className="border border-border px-4 py-3 text-center text-lg font-bold">
                    Jami
                  </td>
                  <td className="border border-border px-3 py-3 text-center text-lg font-bold">
                    {formatNumber(group.total.totalQuantity)}
                  </td>
                  {greenhouseColumns.map((locationName) => (
                    <td key={`${group.stageKey}-total-${locationName}`} className="border border-border px-3 py-3 text-center text-lg font-bold">
                      {formatNumber(group.total.quantitiesByLocation[locationName] || 0)}
                    </td>
                  ))}
                </tr>,
                ...group.rows.map((row, index) => (
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/30 dark:odd:bg-transparent dark:even:bg-slate-800/20">
                    <td className="border border-border px-3 py-3 text-center font-medium">{index + 1}</td>
                    <td className="border border-border px-3 py-3">{row.seedlingTypeName}</td>
                    <td className="border border-border px-3 py-3">{row.varietyName}</td>
                    <td className="border border-border px-3 py-3">{row.rootstockTypeName}</td>
                    <td className="border border-border px-3 py-3 text-center font-semibold">
                      {formatNumber(row.totalQuantity)}
                    </td>
                    {greenhouseColumns.map((locationName) => (
                      <td key={`${row.id}-${locationName}`} className="border border-border px-3 py-3 text-center">
                        {formatNumber(row.quantitiesByLocation[locationName] || 0)}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [locationType, setLocationType] = useState("all");
  const [stage, setStage] = useState("all");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [departmentSelectionReady, setDepartmentSelectionReady] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  const reportsEnabled = user?.role !== "agranom";

  const ordersReportFilters = useMemo(
    () => ({ dateFrom: startDate || undefined, dateTo: endDate || undefined }),
    [startDate, endDate]
  );
  const { data: ordersSummary } = trpc.orders.getOrdersSummary.useQuery(ordersReportFilters, {
    enabled: reportsEnabled && activeTab === "orders",
  } as any);
  const { data: financialData } = trpc.financial.getReport.useQuery(ordersReportFilters, {
    enabled: reportsEnabled && activeTab === "financial",
  } as any);
  const { data: greenhouseSummary } = trpc.greenhouse.getSummary.useQuery(undefined, {
    enabled: reportsEnabled,
  } as any);
  const { data: allOrders } = trpc.orders.getAll.useQuery(undefined, {
    enabled: reportsEnabled && activeTab === "orders",
  } as any);
  const movementsFilters = useMemo(
    () => ({
      dateFrom: startDate || undefined,
      dateTo: endDate || undefined,
      locationId: locationId !== "all" ? Number(locationId) : undefined,
      movementType: movementTypeFilter !== "all" ? movementTypeFilter : undefined,
    }),
    [startDate, endDate, locationId, movementTypeFilter]
  );
  const { data: movementsFull } = trpc.movements.getFull.useQuery(movementsFilters, {
    enabled: reportsEnabled && activeTab === "movements",
  } as any);

  useEffect(() => {
    if (user?.role === "agranom") {
      setLocation("/seedlings");
    }
  }, [setLocation, user?.role]);

  const filters = useMemo(
    () => ({
      startDate: parseDateInput(startDate),
      endDate: parseDateInput(endDate),
      locationId: locationId === "all" ? undefined : Number(locationId),
      locationType:
        locationType === "all"
          ? undefined
          : (locationType as "greenhouse" | "open_field" | "laboratory"),
      stage: stage === "all" ? undefined : (stage as StageKey),
    }),
    [endDate, locationId, locationType, stage, startDate]
  );

  const { data: locations } = trpc.locations.getAll.useQuery(undefined, { enabled: reportsEnabled });
  const { data: generalRows } = trpc.reports.getGeneral.useQuery(filters, { enabled: reportsEnabled });
  const { data: detailedRows } = trpc.reports.getDetailed.useQuery(filters, { enabled: reportsEnabled });
  const { data: movementRows } = trpc.reports.getMovements.useQuery(filters, { enabled: reportsEnabled });

  const selectedLocationId = locationId === "all" ? null : Number(locationId);
  const hasRangeFilter = Boolean(startDate || endDate);

  useEffect(() => {
    if (departmentSelectionReady || !locations?.length) {
      return;
    }

    setSelectedDepartmentIds(locations.map((item: any) => Number(item.id)));
    setDepartmentSelectionReady(true);
  }, [departmentSelectionReady, locations]);

  const transferMovementRows = useMemo(
    () => (movementRows || []).filter((row: any) => isTransferMovement(row)),
    [movementRows]
  );

  const locationColumns = useMemo(() => {
    const names = new Map<string, number>();

    transferMovementRows.forEach((row: any) => {
      if (
        locationType !== "all" &&
        row.fromLocationType !== locationType &&
        row.toLocationType !== locationType
      ) {
        return;
      }

      if (row.fromLocationName) {
        names.set(
          row.fromLocationName,
          Number(names.get(row.fromLocationName) || 0) + Number(row.quantity || 0)
        );
      }
      if (row.toLocationName) {
        names.set(
          row.toLocationName,
          Number(names.get(row.toLocationName) || 0) + Number(row.quantity || 0)
        );
      }
    });

    return Array.from(names.entries())
      .filter(([, quantity]) => Number(quantity || 0) > 0)
      .map(([name]) => name)
      .sort(sortLocationNames);
  }, [locationType, transferMovementRows]);

  const departmentOptions = useMemo(() => {
    return (locations || [])
      .filter((item: any) => locationType === "all" || item.type === locationType)
      .sort((a: any, b: any) => sortLocationNames(a.name, b.name));
  }, [locationType, locations]);

  const greenhouseLocations = useMemo(() => {
    const selectedIds = new Set(selectedDepartmentIds);
    return departmentOptions.filter((item: any) => selectedIds.has(Number(item.id)));
  }, [departmentOptions, selectedDepartmentIds]);

  const greenhouseColumns = useMemo(
    () => greenhouseLocations.map((location: any) => location.name),
    [greenhouseLocations]
  );

  const summaryReportRows = useMemo(() => {
    const rowsByLocation = new Map<string, SummaryRow>();

    const ensureRow = (base: {
      locationId?: number | null;
      locationName: string;
      locationCode?: string;
      locationType?: string;
    }) => {
      const key = base.locationName || `location-${base.locationId}`;
      if (!rowsByLocation.has(key)) {
        rowsByLocation.set(key, {
          locationId: base.locationId ?? null,
          locationName: base.locationName,
          locationCode: base.locationCode || "",
          locationType: base.locationType || "greenhouse",
          opening: createSummaryTotals(),
          incoming: { transfers: 0, received: 0, ungrafted: 0, ready: 0 },
          outgoing: { transfers: 0, cassette: 0, grafted: 0 },
          ending: createSummaryTotals(),
          defectiveQuantity: 0,
          realizedQuantity: 0,
        });
      }

      const row = rowsByLocation.get(key)!;
      if (!row.locationCode && base.locationCode) {
        row.locationCode = base.locationCode;
      }
      if ((!row.locationType || row.locationType === "greenhouse") && base.locationType) {
        row.locationType = base.locationType;
      }
      if (!row.locationId && base.locationId) {
        row.locationId = base.locationId;
      }
      return row;
    };

    (locations || []).forEach((location: any) => {
      if (locationType !== "all" && location.type !== locationType) {
        return;
      }

      ensureRow({
        locationId: location.id,
        locationName: location.name,
        locationCode: location.code,
        locationType: location.type,
      });
    });

    (generalRows || []).forEach((row: any) => {
      const target = ensureRow({
        locationId: row.locationId,
        locationName: row.locationName,
        locationCode: row.locationCode,
        locationType: row.locationType,
      });
      target.defectiveQuantity = Number(row.defectiveQuantity || 0);
      target.realizedQuantity = hasRangeFilter ? 0 : Number(row.realizedQuantity || 0);
    });

    (detailedRows || []).forEach((row: any) => {
      const target = ensureRow({
        locationId: row.locationId,
        locationName: row.locationName,
        locationCode: row.locationCode,
        locationType: row.locationType,
      });

      addToSummaryTotals(target.ending, getSummaryBucket(row.stageKey), Number(row.endingQuantity || 0));

      if (!generalRows?.length) {
        target.defectiveQuantity += Number(row.defectiveQuantity || 0);
      }
    });

    const relevantMovements = [...(movementRows || [])]
      .filter((row: any) => {
        if (
          locationType !== "all" &&
          row.fromLocationType !== locationType &&
          row.toLocationType !== locationType
        ) {
          return false;
        }

        if (
          stage !== "all" &&
          row.stageOnTransfer !== stage &&
          row.fromStage !== stage &&
          row.toStage !== stage
        ) {
          return false;
        }

        return true;
      })
      .sort((a: any, b: any) => {
        const aTime = getMovementDate(a.movementDate || a.transferDate)?.getTime() || 0;
        const bTime = getMovementDate(b.movementDate || b.transferDate)?.getTime() || 0;
        return bTime - aTime;
      });

    const ensureFromRow = (row: any) =>
      row.fromLocationName
        ? ensureRow({
            locationId: row.fromLocationId,
            locationName: row.fromLocationName,
            locationType: row.fromLocationType,
          })
        : null;

    const ensureToRow = (row: any) =>
      row.toLocationName
        ? ensureRow({
            locationId: row.toLocationId,
            locationName: row.toLocationName,
            locationType: row.toLocationType,
          })
        : null;

    const reverseRowTotals = (target: SummaryStageTotals, row: any) => {
      const quantity = Math.max(0, Number(row.quantity || 0));
      const defectQuantity = Math.max(0, Number(row.defectiveQuantity || 0));
      const fromBucket = row.fromStage ? getSummaryBucket(row.fromStage) : null;
      const toBucket = row.toStage ? getSummaryBucket(row.toStage) : fromBucket;

      switch (row.movementType) {
        case "receive":
          if (toBucket) {
            subtractFromSummaryTotals(target, toBucket, quantity);
          }
          break;
        case "stage_change":
          if (toBucket) {
            subtractFromSummaryTotals(target, toBucket, quantity);
          }
          if (fromBucket) {
            addToSummaryTotals(target, fromBucket, quantity + defectQuantity);
          }
          break;
        case "transfer_in":
          if (toBucket) {
            subtractFromSummaryTotals(target, toBucket, quantity);
          }
          break;
        case "transfer_out":
        case "order_sale":
          if (fromBucket || toBucket) {
            addToSummaryTotals(target, fromBucket || (toBucket as SummaryBucketKey), quantity);
          }
          break;
        default:
          break;
      }
    };

    const endBoundary = parseBoundaryDate(endDate, true);
    const startBoundary = parseBoundaryDate(startDate, false);

    if (endBoundary) {
      relevantMovements.forEach((row: any) => {
        const movementDate = getMovementDate(row.movementDate || row.transferDate);
        if (!movementDate || movementDate <= endBoundary) {
          return;
        }

        if (row.movementType === "receive" || row.movementType === "transfer_in") {
          const target = ensureToRow(row);
          if (target) {
            reverseRowTotals(target.ending, row);
          }
          return;
        }

        if (row.movementType === "transfer_out" || row.movementType === "order_sale") {
          const target = ensureFromRow(row);
          if (target) {
            reverseRowTotals(target.ending, row);
          }
          return;
        }

        if (row.movementType === "stage_change") {
          const target = ensureToRow(row) || ensureFromRow(row);
          if (target) {
            reverseRowTotals(target.ending, row);
          }
        }
      });
    }

    Array.from(rowsByLocation.values()).forEach((row) => {
      row.ending = cloneSummaryTotals(row.ending);
      row.ending.totalPodvoy = row.ending.ungrafted + row.ending.grafted;
      row.opening = cloneSummaryTotals(row.ending);
    });

    if (hasRangeFilter) {
      relevantMovements.forEach((row: any) => {
        const movementDate = getMovementDate(row.movementDate || row.transferDate);
        if (!movementDate) {
          return;
        }

        if (startBoundary && movementDate < startBoundary) {
          return;
        }

        if (endBoundary && movementDate > endBoundary) {
          return;
        }

        if (row.movementType === "receive" || row.movementType === "transfer_in") {
          const target = ensureToRow(row);
          if (target) {
            reverseRowTotals(target.opening, row);
          }
          return;
        }

        if (row.movementType === "transfer_out" || row.movementType === "order_sale") {
          const target = ensureFromRow(row);
          if (target) {
            reverseRowTotals(target.opening, row);
          }
          return;
        }

        if (row.movementType === "stage_change") {
          const target = ensureToRow(row) || ensureFromRow(row);
          if (target) {
            reverseRowTotals(target.opening, row);
          }
        }
      });

      relevantMovements.forEach((row: any) => {
        const movementDate = getMovementDate(row.movementDate || row.transferDate);
        if (!movementDate || !isWithinRange(movementDate.toISOString(), startDate, endDate)) {
          return;
        }

        const quantity = Math.max(0, Number(row.quantity || 0));
        const defectQuantity = Math.max(0, Number(row.defectiveQuantity || 0));
        const fromBucket = row.fromStage ? getSummaryBucket(row.fromStage) : null;
        const toBucket = row.toStage ? getSummaryBucket(row.toStage) : fromBucket;

        switch (row.movementType) {
          case "receive": {
            const target = ensureToRow(row);
            if (!target || !toBucket) {
              break;
            }
            if (toBucket === "ready") {
              target.incoming.ready += quantity;
            } else {
              target.incoming.received += quantity;
            }
            break;
          }
          case "stage_change": {
            const target = ensureToRow(row) || ensureFromRow(row);
            if (!target) {
              break;
            }
            if (toBucket === "ready") {
              target.incoming.ready += quantity;
            } else {
              target.incoming.ungrafted += quantity;
            }

            const outgoingAmount = quantity + defectQuantity;
            if (fromBucket === "cassette") {
              target.outgoing.cassette += outgoingAmount;
            } else {
              target.outgoing.grafted += outgoingAmount;
            }
            break;
          }
          case "transfer_in": {
            const target = ensureToRow(row);
            if (!target) {
              break;
            }
            target.incoming.transfers += quantity;
            if (toBucket === "ready") {
              target.incoming.ready += quantity;
            } else if (toBucket === "ungrafted" || toBucket === "grafted") {
              target.incoming.ungrafted += quantity;
            }
            break;
          }
          case "transfer_out": {
            const target = ensureFromRow(row);
            if (!target) {
              break;
            }
            target.outgoing.transfers += quantity;
            if (fromBucket === "cassette") {
              target.outgoing.cassette += quantity;
            } else {
              target.outgoing.grafted += quantity;
            }
            break;
          }
          case "order_sale": {
            const target = ensureFromRow(row) || ensureToRow(row);
            if (target) {
              target.realizedQuantity += quantity;
            }
            break;
          }
          default:
            break;
        }
      });
    }

    return Array.from(rowsByLocation.values())
      .map((row) => {
        row.opening.totalPodvoy = row.opening.ungrafted + row.opening.grafted;
        row.ending.totalPodvoy = row.ending.ungrafted + row.ending.grafted;
        return row;
      })
      .filter((row) => {
        if (selectedLocationId && row.locationId !== selectedLocationId) {
          return false;
        }

        if (locationType !== "all" && row.locationType !== locationType) {
          return false;
        }

        return hasSummaryActivity(row);
      })
      .sort((a, b) => sortLocationNames(a.locationName, b.locationName));
  }, [
    detailedRows,
    generalRows,
    hasRangeFilter,
    locationType,
    locations,
    movementRows,
    selectedLocationId,
    stage,
    startDate,
    endDate,
  ]);

  // Fix: use greenhouse_stage_stock for teplitsa ending/opening balance (current state only, no date filter)
  const summaryReportRowsFixed = useMemo(() => {
    if (!greenhouseSummary?.length || hasRangeFilter) {
      return summaryReportRows;
    }
    const ghByLocationId = new Map(
      (greenhouseSummary as any[]).map((gh) => [Number(gh.locationId), gh])
    );
    return summaryReportRows.map((row) => {
      if (!row.locationId) return row;
      const gh = ghByLocationId.get(Number(row.locationId));
      if (!gh) return row;
      const newEnding: SummaryStageTotals = {
        cassette: gh.cassette,
        ungrafted: gh.grafting,
        grafted: gh.grafted,
        ready: gh.ready,
        totalPodvoy: gh.grafting + gh.grafted,
      };
      return { ...row, ending: newEnding, opening: cloneSummaryTotals(newEnding) };
    });
  }, [summaryReportRows, greenhouseSummary, hasRangeFilter]);

  const detailedReportRows = useMemo(() => {
    const rowsByKey = new Map<string, DetailedTableRow>();

    const ensureRow = (seedlingTypeName: string, varietyName: string) => {
      const fruitTypeName = extractFruitType(seedlingTypeName, varietyName);
      const key = `${fruitTypeName}__${varietyName || "Aniqlanmagan nav"}__${seedlingTypeName || "Aniqlanmagan"}`;

      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          id: key,
          fruitTypeName,
          varietyName: varietyName || "Aniqlanmagan nav",
          seedlingTypeName: seedlingTypeName || "Aniqlanmagan",
          openingQuantity: 0,
          incomingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
          outgoingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
          totalIncoming: 0,
          totalOutgoing: 0,
          endingQuantity: 0,
        });
      }

      return rowsByKey.get(key)!;
    };

    (detailedRows || []).forEach((row: any) => {
      const target = ensureRow(row.seedlingTypeName, row.fruitVarietyName);
      target.endingQuantity += Number(row.endingQuantity || 0);
    });

    transferMovementRows.forEach((row: any) => {
      if (
        locationType !== "all" &&
        row.fromLocationType !== locationType &&
        row.toLocationType !== locationType
      ) {
        return;
      }

      if (stage !== "all" && row.stageOnTransfer !== stage) {
        return;
      }

      if (!isWithinRange(row.transferDate, startDate, endDate) && hasRangeFilter) {
        return;
      }

      const target = ensureRow(row.seedlingTypeName, row.fruitVarietyName);

      if (row.fromLocationName) {
        target.incomingByLocation[row.fromLocationName] =
          (target.incomingByLocation[row.fromLocationName] || 0) + Number(row.quantity || 0);
      }

      if (row.toLocationName) {
        target.outgoingByLocation[row.toLocationName] =
          (target.outgoingByLocation[row.toLocationName] || 0) + Number(row.quantity || 0);
      }
    });

    return Array.from(rowsByKey.values())
      .map((row) => {
        row.totalIncoming = locationColumns.reduce(
          (sum, locationName) => sum + Number(row.incomingByLocation[locationName] || 0),
          0
        );
        row.totalOutgoing = locationColumns.reduce(
          (sum, locationName) => sum + Number(row.outgoingByLocation[locationName] || 0),
          0
        );
        row.openingQuantity = hasRangeFilter
          ? Math.max(row.endingQuantity - row.totalIncoming + row.totalOutgoing, 0)
          : row.endingQuantity;
        return row;
      })
      .filter((row) => hasDetailedActivity(row, locationColumns))
      .sort((a, b) => {
        const fruitTypeCompare = a.fruitTypeName.localeCompare(b.fruitTypeName, "uz");
        if (fruitTypeCompare !== 0) {
          return fruitTypeCompare;
        }

        const typeCompare = a.seedlingTypeName.localeCompare(b.seedlingTypeName, "uz");
        if (typeCompare !== 0) {
          return typeCompare;
        }

        return a.varietyName.localeCompare(b.varietyName, "uz");
      });
  }, [detailedRows, hasRangeFilter, locationColumns, locationType, stage, startDate, endDate, transferMovementRows]);

  const groupedDetailedRows = useMemo(() => {
    const groups = new Map<string, { fruitTypeName: string; rows: DetailedTableRow[] }>();

    detailedReportRows.forEach((row) => {
      if (!groups.has(row.fruitTypeName)) {
        groups.set(row.fruitTypeName, {
          fruitTypeName: row.fruitTypeName,
          rows: [],
        });
      }

      groups.get(row.fruitTypeName)!.rows.push(row);
    });

    return Array.from(groups.values()).map((group) => {
      const total: DetailedTableRow = {
        id: `${group.fruitTypeName}-total`,
        fruitTypeName: group.fruitTypeName,
        varietyName: "",
        seedlingTypeName: "",
        openingQuantity: group.rows.reduce((sum, row) => sum + row.openingQuantity, 0),
        incomingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
        outgoingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
        totalIncoming: group.rows.reduce((sum, row) => sum + row.totalIncoming, 0),
        totalOutgoing: group.rows.reduce((sum, row) => sum + row.totalOutgoing, 0),
        endingQuantity: group.rows.reduce((sum, row) => sum + row.endingQuantity, 0),
      };

      locationColumns.forEach((locationName) => {
        total.incomingByLocation[locationName] = group.rows.reduce(
          (sum, row) => sum + Number(row.incomingByLocation[locationName] || 0),
          0
        );
        total.outgoingByLocation[locationName] = group.rows.reduce(
          (sum, row) => sum + Number(row.outgoingByLocation[locationName] || 0),
          0
        );
      });

      return {
        ...group,
        total,
      };
    });
  }, [detailedReportRows, locationColumns]);

  const detailedTotalRow = useMemo(() => {
    const total: DetailedTableRow = {
      id: "all-total",
      fruitTypeName: "Umumiy jami",
      varietyName: "",
      seedlingTypeName: "",
      openingQuantity: detailedReportRows.reduce((sum, row) => sum + row.openingQuantity, 0),
      incomingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
      outgoingByLocation: Object.fromEntries(locationColumns.map((name) => [name, 0])),
      totalIncoming: detailedReportRows.reduce((sum, row) => sum + row.totalIncoming, 0),
      totalOutgoing: detailedReportRows.reduce((sum, row) => sum + row.totalOutgoing, 0),
      endingQuantity: detailedReportRows.reduce((sum, row) => sum + row.endingQuantity, 0),
    };

    locationColumns.forEach((locationName) => {
      total.incomingByLocation[locationName] = detailedReportRows.reduce(
        (sum, row) => sum + Number(row.incomingByLocation[locationName] || 0),
        0
      );
      total.outgoingByLocation[locationName] = detailedReportRows.reduce(
        (sum, row) => sum + Number(row.outgoingByLocation[locationName] || 0),
        0
      );
    });

    return total;
  }, [detailedReportRows, locationColumns]);

  const greenhouseReportRows = useMemo(() => {
    const rowsByKey = new Map<string, GreenhouseReportRow>();

    const ensureRow = (
      stageKey: StageKey,
      seedlingTypeName: string,
      varietyName: string,
      rootstockTypeName: string
    ) => {
      const key = [stageKey, seedlingTypeName, varietyName, rootstockTypeName].join("__");

      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          id: key,
          stageKey,
          seedlingTypeName: seedlingTypeName || "Aniqlanmagan",
          varietyName: varietyName || "Aniqlanmagan nav",
          rootstockTypeName: rootstockTypeName || "Tanlanmagan",
          totalQuantity: 0,
          quantitiesByLocation: Object.fromEntries(
            greenhouseColumns.map((name: string) => [name, 0])
          ),
        });
      }

      return rowsByKey.get(key)!;
    };

    (detailedRows || []).forEach((row: any) => {
      if (stage !== "all" && row.stageKey !== stage) {
        return;
      }

      if (!greenhouseColumns.includes(row.locationName)) {
        return;
      }

      const quantity = Number(row.endingQuantity || 0);
      if (quantity <= 0) {
        return;
      }

      const target = ensureRow(
        row.stageKey || "cassette",
        row.seedlingTypeName || "Aniqlanmagan",
        row.fruitVarietyName || "Aniqlanmagan nav",
        row.rootstockTypeName || "Tanlanmagan"
      );

      target.totalQuantity += quantity;
      target.quantitiesByLocation[row.locationName] =
        (target.quantitiesByLocation[row.locationName] || 0) + quantity;
    });

    return Array.from(rowsByKey.values()).sort((a, b) => {
      const stageCompare =
        greenhouseStageOrder.indexOf(a.stageKey) - greenhouseStageOrder.indexOf(b.stageKey);
      if (stageCompare !== 0) {
        return stageCompare;
      }

      const typeCompare = a.seedlingTypeName.localeCompare(b.seedlingTypeName, "uz");
      if (typeCompare !== 0) {
        return typeCompare;
      }

      const varietyCompare = a.varietyName.localeCompare(b.varietyName, "uz");
      if (varietyCompare !== 0) {
        return varietyCompare;
      }

      return a.rootstockTypeName.localeCompare(b.rootstockTypeName, "uz");
    });
  }, [detailedRows, greenhouseColumns, selectedLocationId, stage]);

  const greenhouseStageGroups = useMemo(() => {
    return greenhouseStageOrder
      .map((stageKey) => {
        const rows = greenhouseReportRows.filter((row) => row.stageKey === stageKey);
        if (!rows.length) {
          return null;
        }

        const total: GreenhouseReportRow = {
          id: `${stageKey}-total`,
          stageKey,
          seedlingTypeName: "",
          varietyName: "",
          rootstockTypeName: "",
          totalQuantity: rows.reduce((sum, row) => sum + row.totalQuantity, 0),
          quantitiesByLocation: Object.fromEntries(
            greenhouseColumns.map((name: string) => [name, 0])
          ),
        };

        greenhouseColumns.forEach((locationName: string) => {
          total.quantitiesByLocation[locationName] = rows.reduce(
            (sum, row) => sum + Number(row.quantitiesByLocation[locationName] || 0),
            0
          );
        });

        return {
          stageKey,
          title: greenhouseSectionLabel[stageKey],
          rows,
          total,
        } as GreenhouseStageGroup;
      })
      .filter(Boolean) as GreenhouseStageGroup[];
  }, [greenhouseColumns, greenhouseReportRows]);

  const greenhouseTotalRow = useMemo(() => {
    const total: GreenhouseReportRow = {
      id: "greenhouse-total",
      stageKey: "cassette",
      seedlingTypeName: "",
      varietyName: "",
      rootstockTypeName: "",
      totalQuantity: greenhouseReportRows.reduce((sum, row) => sum + row.totalQuantity, 0),
      quantitiesByLocation: Object.fromEntries(greenhouseColumns.map((name: string) => [name, 0])),
    };

    greenhouseColumns.forEach((locationName: string) => {
      total.quantitiesByLocation[locationName] = greenhouseReportRows.reduce(
        (sum, row) => sum + Number(row.quantitiesByLocation[locationName] || 0),
        0
      );
    });

    return total;
  }, [greenhouseColumns, greenhouseReportRows]);

  const greenhouseReportDate = endDate || startDate || new Date().toISOString().slice(0, 10);
  const locationTypeFilterLabel = activeTab === "greenhouse" ? "Bo'lim turi" : "Obyekt turi";
  const locationFilterLabel = activeTab === "greenhouse" ? "Bo'lim" : "Obyekt";

  const toggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((current) => {
      if (checked) {
        return current.includes(departmentId) ? current : [...current, departmentId];
      }

      return current.filter((item) => item !== departmentId);
    });
  };

  const selectAllDepartments = () => {
    setSelectedDepartmentIds(departmentOptions.map((item: any) => Number(item.id)));
  };

  const clearDepartmentSelection = () => {
    setSelectedDepartmentIds([]);
  };

  if (!reportsEnabled) {
    return null;
  }

  const exportActiveTable = () => {
    if (activeTab === "general") {
      buildTableExport(
        "summary-report-table",
        "Umumiy yig'ma hisobot",
        `Davr: ${buildRangeLabel(startDate, endDate)}`,
        "umumiy-hisobot"
      );
      return;
    }

    if (activeTab === "greenhouse") {
      buildTableExport(
        "greenhouse-report-table",
        "Bo'limlar bo'yicha mavjud payvandtag va ko'chatlar to'g'risida ma'lumot",
        `Sana: ${formatDateLabel(greenhouseReportDate)}`,
        "bolimlar-boyicha-hisobot"
      );
      return;
    }

    buildTableExport(
      "detailed-report-table",
      "Batafsil hisobot",
      `Davr: ${buildRangeLabel(startDate, endDate)}`,
      "batafsil-hisobot"
    );
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setLocationId("all");
    setLocationType("all");
    setStage("all");
  };

  const printActiveTable = () => {
    if (activeTab === "general") {
      printHtmlDocument({
        title: "Umumiy yig'ma hisobot",
        subtitle: `Davr: ${buildRangeLabel(startDate, endDate)}`,
        bodyHtml: summaryReportRowsFixed.length
          ? buildSummaryReportPrintBody(summaryReportRowsFixed, startDate, endDate)
          : `<div class="summary-note">Tanlangan filtrlar bo'yicha umumiy hisobot topilmadi.</div>`,
        orientation: "landscape",
      });
      return;
    }

    if (activeTab === "greenhouse") {
      printHtmlDocument({
        title: "Bo'limlar bo'yicha hisobot",
        subtitle: `Sana: ${formatDateLabel(greenhouseReportDate)}`,
        bodyHtml: greenhouseStageGroups.length
          ? buildGreenhouseReportPrintBody(
              greenhouseStageGroups,
              greenhouseTotalRow,
              greenhouseColumns,
              greenhouseReportDate
            )
          : `<div class="summary-note">Tanlangan filtrlar bo'yicha bo'limlar hisobot topilmadi.</div>`,
        orientation: "landscape",
      });
      return;
    }

    printHtmlDocument({
      title: "Batafsil hisobot",
      subtitle: `Davr: ${buildRangeLabel(startDate, endDate)}`,
      bodyHtml: groupedDetailedRows.length
        ? buildDetailedReportPrintBody(groupedDetailedRows, detailedTotalRow, locationColumns)
        : `<div class="summary-note">Tanlangan filtrlar bo'yicha batafsil hisobot topilmadi.</div>`,
      orientation: "landscape",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-border/70 bg-background/80 p-6 shadow-sm">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
            <BarChart3 className="h-8 w-8 text-accent" />
            Hisobotlar
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Hisobot sahifasi endi 3 ta asosiy ko'rinishga qurilgan: umumiy yig'ma ko'rinish,
            meva turi va nav bo'yicha batafsil jadval hamda bo'limlar kesimidagi alohida hisobot.
          </p>
        </div>

        <Card className="card-elegant">
          <CardHeader>
            <CardTitle>Filtrlar</CardTitle>
            <CardDescription>
              Sana oralig'i, lokatsiya turi, aniq lokatsiya va bosqich bo'yicha hisobotni ajrating.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="reports-start-date">Boshlanish sana</Label>
              <Input
                id="reports-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reports-end-date">Tugash sana</Label>
              <Input
                id="reports-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{locationTypeFilterLabel}</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="greenhouse">Teplitsa</SelectItem>
                  <SelectItem value="open_field">Ochiq dala</SelectItem>
                  <SelectItem value="laboratory">Laboratoriya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeTab !== "greenhouse" ? (
              <div className="space-y-2">
                <Label>{locationFilterLabel}</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    {(locations || [])
                      .filter((item: any) => locationType === "all" || item.type === locationType)
                      .sort((a: any, b: any) => sortLocationNames(a.name, b.name))
                      .map((item: any) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Bo'lim tanlash</Label>
                <div className="flex h-10 items-center rounded-md border border-border/70 bg-muted/20 px-3 text-sm text-muted-foreground">
                  Kerakli bo'limlarni pastdagi hisobot blokidan tanlang.
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Bosqich</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {Object.entries(stageLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={resetFilters}>
                Filtrlarni tozalash
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-foreground">Tanlangan davr</div>
            <div className="mt-1 text-sm text-muted-foreground">{buildRangeLabel(startDate, endDate)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={exportActiveTable}>
              <Download className="h-4 w-4" />
              Excel yuklash
            </Button>
            <Button variant="outline" className="gap-2" onClick={printActiveTable}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl bg-muted/40 p-2">
            <TabsTrigger value="general">Umumiy hisobot</TabsTrigger>
            <TabsTrigger value="detailed">Batafsil hisobot</TabsTrigger>
            <TabsTrigger value="greenhouse">Bo'limlar bo'yicha</TabsTrigger>
            <TabsTrigger value="orders">Buyurtmalar</TabsTrigger>
            <TabsTrigger value="financial">Moliya</TabsTrigger>
            <TabsTrigger value="movements">Harakat tarixi</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle>Umumiy yig'ma jadval</CardTitle>
                <CardDescription>
                  Obyektlar kesimida qoldiq, kirim, chiqim va realizatsiya ko'rsatkichlari.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SummaryReportTable
                  rows={summaryReportRowsFixed}
                  tableId="summary-report-table"
                  startDate={startDate}
                  endDate={endDate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle>Batafsil transfer va qoldiq jadvali</CardTitle>
                <CardDescription>
                  Meva turi, nav va ko'chat turi bo'yicha kirim-chiqim ustunlari alohida ko'rinadi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DetailedReportTable
                  groupedRows={groupedDetailedRows}
                  totalRow={detailedTotalRow}
                  locationColumns={locationColumns}
                  tableId="detailed-report-table"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="greenhouse" className="space-y-4">
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle>Bo&apos;limlar bo&apos;yicha mavjud payvandtag va ko&apos;chatlar</CardTitle>
                <CardDescription>
                  Kerakli bo&apos;limlarni tanlang, hisobot ustunlari shu tanlov bo&apos;yicha chiqadi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Bo&apos;limlarni tanlang</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Jadval ustunlariga qaysi bo&apos;limlar chiqishi kerak bo&apos;lsa, shu bo&apos;limlarni belgilang.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllDepartments}>
                        Hammasini tanlash
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={clearDepartmentSelection}>
                        Tozalash
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {departmentOptions.map((item: any) => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
                      >
                        <Checkbox
                          checked={selectedDepartmentIds.includes(Number(item.id))}
                          onCheckedChange={(checked) =>
                            toggleDepartment(Number(item.id), Boolean(checked))
                          }
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {locationTypeLabel[item.type as keyof typeof locationTypeLabel] || item.type}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <GreenhouseReportTable
                  stageGroups={greenhouseStageGroups}
                  totalRow={greenhouseTotalRow}
                  greenhouseColumns={greenhouseColumns}
                  tableId="greenhouse-report-table"
                  reportDate={greenhouseReportDate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== BUYURTMALAR TAB ===== */}
          <TabsContent value="orders" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Jami buyurtma", value: (ordersSummary?.byStatus || []).reduce((s: number, r: any) => s + Number(r.cnt || 0), 0), color: "text-foreground" },
                { label: "Bajarilgan", value: (ordersSummary?.byStatus || []).find((r: any) => r.status === "completed")?.cnt || 0, color: "text-green-600" },
                { label: "Bron / Qisman", value: (ordersSummary?.byStatus || []).find((r: any) => r.status === "partial")?.cnt || 0, color: "text-amber-600" },
                { label: "Bekor qilingan", value: (ordersSummary?.byStatus || []).find((r: any) => r.status === "cancelled")?.cnt || 0, color: "text-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
                  <div className={`mt-1.5 text-2xl font-bold ${color}`}>{formatNumber(Number(value))}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="card-elegant">
                <CardHeader><CardTitle className="text-base">Status bo'yicha</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border/60 bg-muted/30">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs uppercase">Status</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground text-xs uppercase">Soni</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground text-xs uppercase">Miqdor</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground text-xs uppercase">Bron</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground text-xs uppercase">Summa</th>
                      </tr></thead>
                      <tbody>
                        {(ordersSummary?.byStatus || []).map((row: any) => (
                          <tr key={row.status} className="border-b border-border/40 last:border-0">
                            <td className="px-3 py-2 font-medium">{statusLabelMap[row.status] || row.status}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(Number(row.cnt))}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(Number(row.totalQty))}</td>
                            <td className="px-3 py-2 text-center text-amber-600">{formatNumber(Number(row.shortageQty || 0))}</td>
                            <td className="px-3 py-2 text-right">{formatNumber(Number(row.totalAmount))} so'm</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30 font-semibold">
                          <td className="px-3 py-2">Jami</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(ordersSummary?.totals?.totalOrdered || 0))}</td>
                          <td className="px-3 py-2 text-center"></td>
                          <td className="px-3 py-2 text-center text-amber-600">{formatNumber(Number(ordersSummary?.totals?.totalBron || 0))}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(Number(ordersSummary?.totals?.totalRevenue || 0))} so'm</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card className="card-elegant">
                <CardHeader><CardTitle className="text-base">Top 10 mijozlar</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(ordersSummary?.topCustomers || []).slice(0, 10).map((c: any, i: number) => (
                      <div key={c.customer_name} className="flex items-center gap-3 rounded-xl bg-muted/20 px-3 py-2">
                        <span className="w-6 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{c.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{formatNumber(Number(c.totalQty))} ta · {c.orderCount} buyurtma</div>
                        </div>
                        <div className="text-right text-xs font-semibold text-accent">{formatNumber(Number(c.totalAmount))} so'm</div>
                      </div>
                    ))}
                    {!(ordersSummary?.topCustomers || []).length && (
                      <p className="py-4 text-center text-sm text-muted-foreground">Ma'lumot yo'q</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="card-elegant">
              <CardHeader><CardTitle className="text-base">Oylik dinamika</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/60 bg-muted/30">
                      {["Oy", "Buyurtmalar", "Miqdor", "Bajarilgan", "Bron", "Daromad"].map(h => (
                        <th key={h} className="px-3 py-2 text-center font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(ordersSummary?.byPeriod || []).map((row: any) => (
                        <tr key={row.month} className="border-b border-border/40 last:border-0 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/40 dark:even:bg-slate-800/20">
                          <td className="px-3 py-2 text-center font-medium">{row.month}</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.cnt))}</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.totalQty))}</td>
                          <td className="px-3 py-2 text-center text-green-600">{formatNumber(Number(row.fulfilledQty || 0))}</td>
                          <td className="px-3 py-2 text-center text-amber-600">{formatNumber(Number(row.shortageQty || 0))}</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.revenue || 0))} so'm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Faol bron buyurtmalar ro'yxati */}
            {(() => {
              const activeBron = (allOrders || []).filter(
                (o: any) => o.status !== "completed" && o.status !== "cancelled"
              );
              if (!activeBron.length) return null;
              return (
                <Card className="card-elegant border-amber-200">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        {activeBron.length}
                      </span>
                      Faol bron buyurtmalar
                    </CardTitle>
                    <CardDescription>Hali yakunlanmagan — "yangi", "qisman" yoki "yetishmaydi" holatidagi buyurtmalar.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/30">
                            {["Raqam", "Mijoz", "Lokatsiya", "Buyurtma", "Bajarilgan", "Bron (yetishmaydi)", "Holat", "Sana"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs uppercase whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeBron.map((o: any) => {
                            const statusColors: Record<string, string> = {
                              new: "bg-blue-100 text-blue-700",
                              partial: "bg-amber-100 text-amber-700",
                              shortage: "bg-red-100 text-red-700",
                              fulfilled: "bg-green-100 text-green-700",
                            };
                            return (
                              <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                                <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap">#{o.orderNumber}</td>
                                <td className="px-3 py-2 font-semibold">
                                  <div>{o.customerName}</div>
                                  {o.customerPhone && <div className="text-xs text-muted-foreground">{o.customerPhone}</div>}
                                </td>
                                <td className="px-3 py-2 text-xs">{o.locationName || "-"}</td>
                                <td className="px-3 py-2 text-center font-bold">{formatNumber(o.totalQuantity)} ta</td>
                                <td className="px-3 py-2 text-center text-green-700">{formatNumber(o.fulfilledQuantity)} ta</td>
                                <td className="px-3 py-2 text-center text-amber-700 font-semibold">{formatNumber(o.shortageQuantity)} ta</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>
                                    {statusLabelMap[o.status] || o.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString("uz-UZ") : "-"}
                                  {o.expectedDate && (
                                    <div className="text-amber-700">→ {new Date(o.expectedDate).toLocaleDateString("uz-UZ")}</div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 font-semibold text-sm">
                            <td className="px-3 py-2" colSpan={3}>Jami</td>
                            <td className="px-3 py-2 text-center">
                              {formatNumber(activeBron.reduce((s: number, o: any) => s + o.totalQuantity, 0))} ta
                            </td>
                            <td className="px-3 py-2 text-center text-green-700">
                              {formatNumber(activeBron.reduce((s: number, o: any) => s + o.fulfilledQuantity, 0))} ta
                            </td>
                            <td className="px-3 py-2 text-center text-amber-700">
                              {formatNumber(activeBron.reduce((s: number, o: any) => s + o.shortageQuantity, 0))} ta
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* ===== MOLIYAVIY HISOBOT TAB ===== */}
          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Jami daromad", value: `${formatNumber(Number(financialData?.summary?.totalRevenue || 0))} so'm`, color: "text-green-600" },
                { label: "Sotilgan ko'chat", value: `${formatNumber(Number(financialData?.summary?.totalSoldQty || 0))} ta`, color: "text-foreground" },
                { label: "Bajarilgan buyurtma", value: `${formatNumber(Number(financialData?.summary?.completedOrders || 0))} ta`, color: "text-accent" },
                { label: "O'rtacha narx", value: `${formatNumber(Number(financialData?.summary?.avgPricePerUnit || 0))} so'm`, color: "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
                  <div className={`mt-1.5 text-xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="card-elegant">
                <CardHeader><CardTitle className="text-base">Lokatsiya bo'yicha daromad</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(financialData?.byLocation || []).map((row: any) => (
                      <div key={row.locationName} className="flex items-center gap-3 rounded-xl bg-muted/20 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{row.locationName}</div>
                          <div className="text-xs text-muted-foreground">{row.orderCount} buyurtma · {formatNumber(Number(row.soldQty))} ta</div>
                        </div>
                        <div className="text-right font-bold text-green-600 text-sm">{formatNumber(Number(row.revenue))} so'm</div>
                      </div>
                    ))}
                    {!(financialData?.byLocation || []).length && (
                      <p className="py-4 text-center text-sm text-muted-foreground">Ma'lumot yo'q</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="card-elegant">
                <CardHeader><CardTitle className="text-base">Ko'chat turi bo'yicha</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(financialData?.bySeedlingType || []).map((row: any) => (
                      <div key={row.seedlingTypeName} className="flex items-center gap-3 rounded-xl bg-muted/20 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{row.seedlingTypeName}</div>
                          <div className="text-xs text-muted-foreground">{formatNumber(Number(row.soldQty))} ta sotilgan</div>
                        </div>
                        <div className="text-right font-bold text-accent text-sm">{formatNumber(Number(row.revenue))} so'm</div>
                      </div>
                    ))}
                    {!(financialData?.bySeedlingType || []).length && (
                      <p className="py-4 text-center text-sm text-muted-foreground">Ma'lumot yo'q</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="card-elegant">
              <CardHeader><CardTitle className="text-base">Oylik daromad</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/60 bg-muted/30">
                      {["Oy", "Buyurtmalar", "Sotilgan", "Daromad", "O'rtacha narx"].map(h => (
                        <th key={h} className="px-3 py-2 text-center font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(financialData?.byMonth || []).map((row: any) => (
                        <tr key={row.month} className="border-b border-border/40 last:border-0 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/40 dark:even:bg-slate-800/20">
                          <td className="px-3 py-2 text-center font-medium">{row.month}</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.orderCount))}</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.soldQty))} ta</td>
                          <td className="px-3 py-2 text-center text-green-600 font-semibold">{formatNumber(Number(row.revenue))} so'm</td>
                          <td className="px-3 py-2 text-center">{formatNumber(Number(row.avgPrice))} so'm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== HARAKAT TARIXI TAB ===== */}
          <TabsContent value="movements" className="space-y-4">
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle className="text-base">Ko'chat harakati tarixi</CardTitle>
                <CardDescription>Transfer, bosqich o'zgarishi va sotish voqealari</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Harakat turi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha turlar</SelectItem>
                      <SelectItem value="stage_change">Bosqich o'zgarishi</SelectItem>
                      <SelectItem value="transfer_in">Transfer kirim</SelectItem>
                      <SelectItem value="transfer_out">Transfer chiqim</SelectItem>
                      <SelectItem value="order_sale">Sotish</SelectItem>
                      <SelectItem value="defect_recorded">Nuqson belgilash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        {["Sana", "Tur", "Partiya", "Ko'chat turi", "Miqdor", "Bosqich", "Lokatsiya", "Bajardi"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(movementsFull || []).slice(0, 200).map((row: any) => (
                        <tr key={row.id} className="border-b border-border/40 last:border-0 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/40 dark:even:bg-slate-800/20 hover:bg-muted/20">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                            {row.movementDate ? new Date(row.movementDate).toLocaleString("uz-UZ") : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.movementType === "order_sale" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                              row.movementType?.includes("transfer") ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                              row.movementType === "defect_recorded" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {movementTypeLabel[row.movementType] || row.movementType}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs font-semibold">{row.batchCode || "-"}</td>
                          <td className="px-3 py-2 text-xs max-w-[120px] truncate">{row.seedlingTypeName || "-"}</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatNumber(Number(row.quantity || 0))}</td>
                          <td className="px-3 py-2 text-xs">
                            {row.fromStage && row.toStage && row.fromStage !== row.toStage
                              ? `${stageLabelMap[row.fromStage] || row.fromStage} → ${stageLabelMap[row.toStage] || row.toStage}`
                              : (stageLabelMap[row.toStage || row.fromStage] || row.toStage || "-")}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.toLocationName || row.fromLocationName || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{row.performedByName?.trim() || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!(movementsFull || []).length && (
                    <div className="py-10 text-center text-sm text-muted-foreground">Harakat tarixi topilmadi</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

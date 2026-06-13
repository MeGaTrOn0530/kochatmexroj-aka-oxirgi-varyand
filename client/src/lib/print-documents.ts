export type PrintOrientation = "portrait" | "landscape";

type DocumentOptions = {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  fileName?: string;
  orientation?: PrintOrientation;
};

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDocumentHtml({
  title,
  subtitle,
  bodyHtml,
  orientation = "portrait",
}: DocumentOptions) {
  return `<!DOCTYPE html>
  <html lang="uz">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4 ${orientation}; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          color: #111827;
          background: #ffffff;
        }
        .sheet {
          padding: 0;
        }
        .doc-header {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #15803d;
        }
        .doc-title {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
        }
        .doc-subtitle {
          margin: 6px 0 0;
          font-size: 12px;
          color: #4b5563;
        }
        .doc-section {
          margin-top: 16px;
          break-inside: avoid;
        }
        .doc-section h2 {
          margin: 0 0 10px;
          font-size: 14px;
        }
        .meta-grid,
        .sign-grid {
          display: grid;
          gap: 10px;
        }
        .meta-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .sign-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 18px;
        }
        .meta-card,
        .sign-card {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 10px 12px;
          background: #f9fafb;
        }
        .meta-label,
        .sign-label {
          font-size: 11px;
          color: #6b7280;
        }
        .meta-value,
        .sign-value {
          margin-top: 4px;
          font-size: 14px;
          font-weight: 600;
        }
        .timeline {
          margin: 0;
          padding: 0;
          list-style: none;
          border-left: 2px solid #d1d5db;
        }
        .timeline li {
          position: relative;
          margin-left: 12px;
          padding: 0 0 14px 14px;
        }
        .timeline li::before {
          content: "";
          position: absolute;
          left: -19px;
          top: 2px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #16a34a;
        }
        .timeline-title {
          font-size: 13px;
          font-weight: 700;
        }
        .timeline-meta {
          margin-top: 4px;
          font-size: 12px;
          color: #4b5563;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          border: 1px solid #1f2937;
          padding: 6px 8px;
          font-size: 11px;
          vertical-align: middle;
        }
        th {
          background: #e5eef7;
          font-weight: 700;
          text-align: center;
        }
        td {
          text-align: center;
        }
        td.text-left,
        th.text-left {
          text-align: left;
        }
        .muted {
          color: #6b7280;
        }
        .summary-note {
          margin-top: 10px;
          font-size: 12px;
          color: #4b5563;
        }
        .report-part {
          margin-top: 18px;
          break-inside: avoid;
        }
        .report-part:first-of-type {
          margin-top: 0;
        }
        .report-part h2 {
          margin: 0 0 8px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <header class="doc-header">
          <h1 class="doc-title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="doc-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </header>
        ${bodyHtml}
      </div>
    </body>
  </html>`;
}

export function printHtmlDocument(options: DocumentOptions) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(buildDocumentHtml(options));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onafterprint = () => {
    printWindow.close();
  };

  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return true;
}

// Compact receipt — printer o'z qog'oz o'lchamini taniydi
export function printReceiptDocument(receiptHtml: string, title = "Chek") {
  const html = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: auto;
      margin: 3mm 4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0; padding: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    html, body { height: auto; overflow: visible; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 7pt;
      color: #000;
      background: #fff;
    }
    .receipt { width: 100%; }
    .center { text-align: center; }
    .bold   { font-weight: 700; }
    .small  { font-size: 6pt; color: #444; }
    .sep-dash  { border-top: 1px dashed #000; margin: 3px 0; }
    .sep-solid { border-top: 1.5px solid #000; margin: 3px 0; }
    .row { display: flex; justify-content: space-between; gap: 3px; margin: 1px 0; }
    .row .lbl { color: #555; white-space: nowrap; font-size: 6.5pt; }
    .row .val { font-weight: 600; text-align: right; font-size: 6.5pt; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin: 2px 0; }
    th { border-bottom: 1px solid #000; padding: 1px 2px; font-size: 6pt; text-align: left; }
    td { padding: 1px 2px; font-size: 6pt; vertical-align: top; }
    .num { text-align: right; }
    .total-line {
      border-top: 1.5px solid #000;
      margin-top: 3px; padding-top: 2px;
      display: flex; justify-content: space-between;
      font-weight: 700; font-size: 7.5pt;
    }
  </style>
</head>
<body>
  <div class="receipt">${receiptHtml}</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  window.setTimeout(() => win.print(), 250);
  return true;
}

export function downloadHtmlDocument({
  fileName = "document",
  ...options
}: DocumentOptions) {
  const blob = new Blob([buildDocumentHtml(options)], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

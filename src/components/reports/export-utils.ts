/**
 * Export helpers shared by every report. CSV and "Excel" (legacy HTML
 * table with an .xls extension, which Excel opens natively) are fully
 * functional client-side exports. PDF and Print both hand off to the
 * browser's native print-to-PDF via a print-optimized stylesheet
 * (see .print-report / print:hidden utility usage in ReportShell).
 */

/** Fixed "today" so server and client renders agree — mirrors the mock data period. */
export const REPORT_TODAY = new Date(2026, 7, 7); // August 7, 2026

function toCsvValue(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(content: string, filename: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportColumn {
  header: string;
  get: (row: unknown) => string;
}

export function downloadCsv(filename: string, columns: ExportColumn[], rows: unknown[]) {
  const header = columns.map((c) => toCsvValue(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => toCsvValue(c.get(r))).join(",")).join("\n");
  downloadBlob(`${header}\n${body}`, filename, "text/csv;charset=utf-8;");
}

export function downloadExcel(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: unknown[],
) {
  const header = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.get(r))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(title).slice(0, 31)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1">
    <thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  downloadBlob(html, filename, "application/vnd.ms-excel");
}

export function printCurrentView() {
  if (typeof window === "undefined") return;
  window.print();
}

export function slugFilename(title: string, ext: string) {
  const stamp = `${REPORT_TODAY.getFullYear()}-${String(REPORT_TODAY.getMonth() + 1).padStart(2, "0")}-${String(REPORT_TODAY.getDate()).padStart(2, "0")}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}-${stamp}.${ext}`;
}

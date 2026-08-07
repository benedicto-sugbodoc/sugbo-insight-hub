import { ArrowRight, FileBarChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ReportConfig } from "./types";

export interface ReportSummary {
  id: string;
  code: string;
  title: string;
  purpose: string;
  roleNote?: string;
  formatNote?: string;
}

export function summarize<T>(config: ReportConfig<T>): ReportSummary {
  return {
    id: config.id,
    code: config.code,
    title: config.title,
    purpose: config.purpose,
    ...(config.roleNote ? { roleNote: config.roleNote } : {}),
    ...(config.formatNote ? { formatNote: config.formatNote } : {}),
  };
}

export function ReportsHome({
  title,
  description,
  basePath,
  reports,
}: {
  title: string;
  description: string;
  basePath: string;
  reports: ReportSummary[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-brand">Reports</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        <p className="text-sm text-text-muted">{description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <a
            key={r.id}
            href={`${basePath}/${r.id}`}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                className="border-brand/30 bg-brand/10 text-[11px] font-medium text-brand"
              >
                {r.code}
              </Badge>
              <FileBarChart className="size-4 text-text-muted" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">{r.title}</h3>
            <p className="text-xs text-text-muted">{r.purpose}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.roleNote ? (
                <Badge
                  variant="outline"
                  className="border-warning/30 bg-warning/10 text-[10px] text-warning"
                >
                  {r.roleNote}
                </Badge>
              ) : null}
              {r.formatNote ? (
                <Badge variant="outline" className="border-border text-[10px] text-text-muted">
                  Official DOH format
                </Badge>
              ) : null}
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
              Open report <ArrowRight className="size-3.5" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

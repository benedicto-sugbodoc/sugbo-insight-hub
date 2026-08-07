import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/lgu/reports")({
  head: () => ({
    meta: [
      { title: "LGU Reports — SugboDoc Public Health Intelligence" },
      {
        name: "description",
        content:
          "Tabular, exportable and schedulable LGU reports: FHSIS, immunization coverage, maternal death audit, TB quarterly, Konsulta utilization, referrals, household profiles and dengue surveillance.",
      },
    ],
  }),
  component: LguReportsLayout,
});

function LguReportsLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-2 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2">
          <FileBarChart className="size-4 text-brand" />
          <span className="text-sm font-semibold text-text-primary">LGU Reports</span>
          <a
            href="/lgu/analytics"
            className="ml-auto text-xs text-text-muted hover:text-text-primary"
          >
            LGU analytics dashboards →
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px]">
        <Outlet />
      </div>
    </div>
  );
}

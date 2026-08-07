import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SugboDoc Hospital Intelligence" },
      {
        name: "description",
        content:
          "Tabular, exportable and schedulable hospital reports: census, admissions, PhilHealth claims, denials, revenue, physician activity and more.",
      },
    ],
  }),
  component: ReportsLayout,
});

function ReportsLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-2 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2">
          <FileBarChart className="size-4 text-brand" />
          <span className="text-sm font-semibold text-text-primary">Hospital Reports</span>
          <a href="/analytics" className="ml-auto text-xs text-text-muted hover:text-text-primary">
            Analytics dashboards →
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px]">
        <Outlet />
      </div>
    </div>
  );
}

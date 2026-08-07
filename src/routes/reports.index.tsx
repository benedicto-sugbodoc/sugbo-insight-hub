import { createFileRoute } from "@tanstack/react-router";

import { ReportsHome, summarize } from "@/components/reports/reports-home";
import { hospitalReports } from "@/lib/reports/hospital.mock";

export const Route = createFileRoute("/reports/")({
  component: ReportsIndexPage,
});

function ReportsIndexPage() {
  return (
    <div className="p-4">
      <ReportsHome
        title="Hospital Reports"
        description="Tabular, exportable, schedulable reports for Level 3 hospital operations, billing and clinical quality."
        basePath="/reports"
        reports={hospitalReports.map(summarize)}
      />
    </div>
  );
}

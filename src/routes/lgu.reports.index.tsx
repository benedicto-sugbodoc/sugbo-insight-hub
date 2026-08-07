import { createFileRoute } from "@tanstack/react-router";

import { ReportsHome, summarize } from "@/components/reports/reports-home";
import { lguReports } from "@/lib/reports/lgu.mock";

export const Route = createFileRoute("/lgu/reports/")({
  component: LguReportsIndexPage,
});

function LguReportsIndexPage() {
  return (
    <div className="p-4">
      <ReportsHome
        title="LGU Reports"
        description="Tabular, exportable, schedulable reports for the City Health Office and BHC/RHU network — DOH submission formats included."
        basePath="/lgu/reports"
        reports={lguReports.map(summarize)}
      />
    </div>
  );
}

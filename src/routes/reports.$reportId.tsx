import { createFileRoute } from "@tanstack/react-router";

import { ReportShell } from "@/components/reports/report-shell";
import { getHospitalReport } from "@/lib/reports/hospital.mock";

export const Route = createFileRoute("/reports/$reportId")({
  head: ({ params }) => {
    const report = getHospitalReport(params.reportId);
    return {
      meta: [
        { title: report ? `${report.title} — SugboDoc Reports` : "Report — SugboDoc Reports" },
      ],
    };
  },
  component: ReportDetailPage,
});

function ReportDetailPage() {
  const { reportId } = Route.useParams();
  const config = getHospitalReport(reportId);

  if (!config) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-text-muted">Report not found.</p>
        <a href="/reports" className="mt-2 inline-block text-sm text-brand hover:underline">
          ← Back to Hospital Reports
        </a>
      </div>
    );
  }

  return <ReportShell config={config} />;
}

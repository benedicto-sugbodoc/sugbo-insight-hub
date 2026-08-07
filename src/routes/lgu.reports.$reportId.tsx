import { createFileRoute } from "@tanstack/react-router";

import { ReportShell } from "@/components/reports/report-shell";
import { getLguReport } from "@/lib/reports/lgu.mock";

export const Route = createFileRoute("/lgu/reports/$reportId")({
  head: ({ params }) => {
    const report = getLguReport(params.reportId);
    return {
      meta: [
        {
          title: report
            ? `${report.title} — SugboDoc LGU Reports`
            : "Report — SugboDoc LGU Reports",
        },
      ],
    };
  },
  component: LguReportDetailPage,
});

function LguReportDetailPage() {
  const { reportId } = Route.useParams();
  const config = getLguReport(reportId);

  if (!config) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-text-muted">Report not found.</p>
        <a href="/lgu/reports" className="mt-2 inline-block text-sm text-brand hover:underline">
          ← Back to LGU Reports
        </a>
      </div>
    );
  }

  return <ReportShell config={config} />;
}

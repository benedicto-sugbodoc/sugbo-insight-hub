import { createFileRoute } from "@tanstack/react-router";

import Top20NewCharts from "@/components/analytics/Top20NewCharts";

export const Route = createFileRoute("/analytics/new-charts")({
  head: () => ({
    meta: [
      { title: "New Charts (Preview) — SugboDoc Analytics" },
      {
        name: "description",
        content:
          "Preview of 20 proposed new hospital and LGU analytics charts, built from existing report and dashboard mock data.",
      },
    ],
  }),
  component: NewChartsPage,
});

function NewChartsPage() {
  return <Top20NewCharts />;
}

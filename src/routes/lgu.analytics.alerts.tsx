import { createFileRoute } from "@tanstack/react-router";

import { AlertCenter } from "@/components/analytics/alert-center";
import { lguAlertRefreshPool, lguAlerts } from "@/lib/analytics/lgu/alerts.mock";

export const Route = createFileRoute("/lgu/analytics/alerts")({
  head: () => ({
    meta: [
      { title: "Alert & Notification Center — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Real-time feed of critical, warning and informational alerts across surveillance, immunization, TB-DOTS, Konsulta and maternal health.",
      },
    ],
  }),
  component: LguAlertsPage,
});

function LguAlertsPage() {
  return (
    <AlertCenter
      title="Alert & Notification Center"
      description="Critical, warning and informational alerts across the City Health Office and BHC/RHU network, newest first."
      initialAlerts={lguAlerts}
      refreshPool={lguAlertRefreshPool}
      storageKey="lgu"
    />
  );
}

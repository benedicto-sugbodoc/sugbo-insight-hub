import { createFileRoute } from "@tanstack/react-router";

import { AlertCenter } from "@/components/analytics/alert-center";
import { hospitalAlertRefreshPool, hospitalAlerts } from "@/lib/analytics/alerts.mock";

export const Route = createFileRoute("/analytics/alerts")({
  head: () => ({
    meta: [
      { title: "Alert & Notification Center — SugboDoc Analytics" },
      {
        name: "description",
        content:
          "Real-time feed of critical, warning and informational alerts across census, laboratory, claims and billing.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  return (
    <AlertCenter
      title="Alert & Notification Center"
      description="Critical, warning and informational alerts across the hospital, newest first."
      initialAlerts={hospitalAlerts}
      refreshPool={hospitalAlertRefreshPool}
      storageKey="hospital"
    />
  );
}

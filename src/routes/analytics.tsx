import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Clock,
  FlaskConical,
  HeartPulse,
  LineChart,
  MapPinned,
  Receipt,
  ShieldCheck,
  Smile,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { HospitalFilterProvider } from "@/components/analytics/hospital-filter-context";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SugboDoc Hospital Intelligence" },
      {
        name: "description",
        content:
          "Executive, clinical, revenue, claims, quality and laboratory analytics for Level 3 hospitals on SugboDoc.",
      },
      { property: "og:title", content: "Analytics — SugboDoc Hospital Intelligence" },
      {
        property: "og:description",
        content: "Role-based hospital analytics dashboards for Philippine Level 3 facilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsLayout,
});

// Hierarchy tier 1: Overview → Comparison → Financial/Claims investigation →
// Patient/Experience investigation. Backed by the shared synthetic dataset
// (src/lib/data/hospital) and the shared HospitalFilterProvider below.
const hierarchySections = [
  { to: "/analytics/executive", label: "Overview", icon: LineChart },
  { to: "/analytics/performance", label: "Performance", icon: TrendingUp },
  { to: "/analytics/revenue", label: "Financial", icon: Receipt },
  { to: "/analytics/claims", label: "Claims", icon: ShieldCheck },
  { to: "/analytics/patient-experience", label: "Patient Experience", icon: Smile },
] as const;

// Detailed/specialist tools — still on legacy per-file mock data pending
// migration (see schema.md "Legacy Mock Data"), so they intentionally sit
// outside the shared-filter hierarchy above rather than pretending to honor it.
const detailSections = [
  { to: "/analytics/clinical", label: "Clinical", icon: HeartPulse },
  { to: "/analytics/quality", label: "Quality", icon: Activity },
  { to: "/analytics/laboratory", label: "Lab", icon: FlaskConical },
  { to: "/analytics/cohorts", label: "Cohort Builder", icon: Users },
  { to: "/analytics/patterns", label: "Patterns", icon: Clock },
  { to: "/analytics/alerts", label: "Alerts", icon: Bell },
  { to: "/analytics/new-charts", label: "New Charts", icon: Sparkles },
] as const;

function AnalyticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const renderTab = (item: { to: string; label: string; icon: typeof LineChart }) => {
    const active = pathname.startsWith(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-brand text-brand-foreground"
            : "text-text-secondary hover:bg-muted hover:text-text-primary",
        )}
      >
        <item.icon className="size-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <HospitalFilterProvider>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2">
            <Link
              to="/"
              className="mr-2 shrink-0 text-sm font-semibold tracking-tight text-brand hover:opacity-80"
            >
              SugboDoc
            </Link>
            <div className="mr-1 h-5 w-px shrink-0 bg-border" />
            {hierarchySections.map(renderTab)}
            <div className="mx-1 h-5 w-px shrink-0 bg-border" />
            <span className="mr-1 shrink-0 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              Detail
            </span>
            {detailSections.map(renderTab)}
            <Link
              to="/lgu/analytics/executive"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
            >
              <MapPinned className="size-4" />
              LGU / City Health
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1600px] px-4 py-6">
          <Outlet />
        </div>
      </div>
    </HospitalFilterProvider>
  );
}

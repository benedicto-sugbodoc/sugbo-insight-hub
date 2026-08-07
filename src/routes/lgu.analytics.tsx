import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Baby,
  Bell,
  Building2,
  Clock,
  Filter,
  HeartHandshake,
  LineChart,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lgu/analytics")({
  head: () => ({
    meta: [
      { title: "LGU Analytics — SugboDoc Public Health Intelligence" },
      {
        name: "description",
        content:
          "City Health Office analytics: Konsulta, immunization, maternal & child health, NCD management, TB-DOTS and disease surveillance for LGU / BHC-RHU networks.",
      },
      { property: "og:title", content: "LGU Analytics — SugboDoc Public Health Intelligence" },
      {
        property: "og:description",
        content: "Role-based public health dashboards for city and municipal health offices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LguAnalyticsLayout,
});

const subSections = [
  { to: "/lgu/analytics/executive", label: "Executive / CHO", icon: LineChart },
  { to: "/lgu/analytics/maternal", label: "Maternal & Child Health", icon: Baby },
  { to: "/lgu/analytics/ncd", label: "NCD Management", icon: HeartHandshake },
  { to: "/lgu/analytics/tb", label: "TB-DOTS", icon: Stethoscope },
  { to: "/lgu/analytics/konsulta", label: "Konsulta / PhilHealth", icon: Syringe },
  { to: "/lgu/analytics/population", label: "Population Health", icon: Users },
  { to: "/lgu/analytics/cohorts", label: "Cohort Builder", icon: Filter },
  { to: "/lgu/analytics/patterns", label: "Patterns", icon: Clock },
  { to: "/lgu/analytics/alerts", label: "Alerts", icon: Bell },
] as const;

function LguAnalyticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
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
          <span className="mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand">
            <Activity className="size-3.5" />
            LGU / City Health
          </span>
          {subSections.map((item) => {
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
          })}
          <Link
            to="/analytics/executive"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <Building2 className="size-4" />
            Hospital
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}

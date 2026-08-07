import * as React from "react";
import { AlertTriangle, Bell, Check, Info, RefreshCw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartDrillDrawer } from "@/components/analytics/interactive";
import { InlineSearch } from "@/components/analytics/interactive";
import { cn } from "@/lib/utils";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  module: string;
  minutesAgo: number;
  actionLabel: string;
  actionHref?: string;
}

const severityMeta: Record<
  AlertSeverity,
  { label: string; icon: React.ElementType; classes: string; dot: string }
> = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    classes: "border-l-danger bg-danger/[0.03]",
    dot: "bg-danger",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    classes: "border-l-warning bg-warning/[0.03]",
    dot: "bg-warning",
  },
  info: { label: "Info", icon: Info, classes: "border-l-brand bg-brand/[0.03]", dot: "bg-brand" },
};

function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AlertCenter({
  title,
  description,
  initialAlerts,
  refreshPool,
  storageKey,
}: {
  title: string;
  description: string;
  initialAlerts: AlertItem[];
  refreshPool: AlertItem[];
  storageKey: string;
}) {
  const [alerts, setAlerts] = React.useState<AlertItem[]>(initialAlerts);
  const [acknowledged, setAcknowledged] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState<"all" | AlertSeverity>("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<AlertItem | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState<string | null>(null);
  const [refreshPoolIndex, setRefreshPoolIndex] = React.useState(0);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`sugbodoc-alerts-ack-${storageKey}`);
      if (raw) setAcknowledged(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [storageKey]);

  const persistAck = (next: Set<string>) => {
    setAcknowledged(next);
    if (hydrated.current) {
      try {
        window.localStorage.setItem(
          `sugbodoc-alerts-ack-${storageKey}`,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore
      }
    }
  };

  const counts = {
    critical: alerts.filter((a) => a.severity === "critical" && !acknowledged.has(a.id)).length,
    warning: alerts.filter((a) => a.severity === "warning" && !acknowledged.has(a.id)).length,
    info: alerts.filter((a) => a.severity === "info" && !acknowledged.has(a.id)).length,
  };
  const unacknowledged = counts.critical + counts.warning + counts.info;

  const visible = alerts
    .filter((a) => filter === "all" || a.severity === filter)
    .filter(
      (a) =>
        !search.trim() ||
        `${a.title} ${a.detail} ${a.module}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => a.minutesAgo - b.minutesAgo);

  const handleRefresh = () => {
    const next = refreshPool[refreshPoolIndex % refreshPool.length];
    if (next) {
      setAlerts((prev) => [{ ...next, id: `${next.id}-${Date.now()}`, minutesAgo: 0 }, ...prev]);
      setRefreshPoolIndex((i) => i + 1);
    }
    setLastRefreshed("Just now");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-brand/30 bg-brand/10 text-brand">
            <Bell className="size-3" />
            {unacknowledged} unacknowledged
          </Badge>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRefresh}>
            <RefreshCw className="size-3.5" />
            {lastRefreshed ? `Refreshed ${lastRefreshed}` : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | AlertSeverity)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">
              All ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs">
              Critical ({counts.critical})
            </TabsTrigger>
            <TabsTrigger value="warning" className="text-xs">
              Warning ({counts.warning})
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs">
              Info ({counts.info})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <InlineSearch value={search} onChange={setSearch} placeholder="Search alerts…" />
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
            No alerts match this filter.
          </div>
        ) : (
          visible.map((alert) => {
            const meta = severityMeta[alert.severity];
            const Icon = meta.icon;
            const isAck = acknowledged.has(alert.id);
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-l-4 bg-card p-3.5 shadow-sm transition-opacity hover:shadow-md",
                  meta.classes,
                  isAck && "opacity-50",
                )}
                onClick={() => setSelected(alert)}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", meta.dot.replace("bg-", "text-"))} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{alert.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {alert.module}
                    </Badge>
                    {isAck ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Check className="size-2.5" />
                        Acknowledged
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">{alert.detail}</p>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {relativeTime(alert.minutesAgo)}
                  </p>
                </div>
                {!isAck ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      persistAck(new Set([...acknowledged, alert.id]));
                    }}
                  >
                    <Check className="size-3" />
                    Acknowledge
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <ChartDrillDrawer
        open={selected !== null}
        onOpenChange={(v) => (v ? null : setSelected(null))}
        metricName={selected?.title ?? ""}
        value={selected ? severityMeta[selected.severity].label : ""}
        dateRangeLabel={selected ? relativeTime(selected.minutesAgo) : ""}
        {...(selected?.module ? { filterLabel: selected.module } : {})}
      >
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{selected.detail}</p>
            {selected.actionHref ? (
              <Button
                asChild
                className="w-full justify-between bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <a href={selected.actionHref}>{selected.actionLabel}</a>
              </Button>
            ) : (
              <Button
                className="w-full justify-between bg-brand text-brand-foreground hover:bg-brand/90"
                disabled
              >
                {selected.actionLabel}
              </Button>
            )}
            {!acknowledged.has(selected.id) ? (
              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => {
                  persistAck(new Set([...acknowledged, selected.id]));
                  setSelected(null);
                }}
              >
                <Check className="size-3.5" />
                Mark as acknowledged
              </Button>
            ) : null}
          </div>
        ) : null}
      </ChartDrillDrawer>
    </div>
  );
}

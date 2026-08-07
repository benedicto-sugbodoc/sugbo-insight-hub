import * as React from "react";
import { AlertTriangle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ReportDrawerData } from "./types";

/**
 * Shared 480px drill-down drawer. Every report row opens this same
 * shape: Detail / Documents / Related Records / Actions.
 */
export function RecordDrawer({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReportDrawerData | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        {data ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{data.heading}</SheetTitle>
              {data.subheading ? (
                <SheetDescription className="text-xs">{data.subheading}</SheetDescription>
              ) : null}
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8">
              {data.alert ? (
                <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {data.alert}
                </div>
              ) : null}

              <Tabs defaultValue="detail">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="detail" className="text-xs">
                    Detail
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">
                    Docs
                  </TabsTrigger>
                  <TabsTrigger value="related" className="text-xs">
                    Related
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="text-xs">
                    Actions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="detail" className="mt-3 space-y-1">
                  {data.detail.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0"
                    >
                      <span className="text-text-secondary">{f.label}</span>
                      <span className="text-right font-medium text-text-primary">{f.value}</span>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="documents" className="mt-3 space-y-2">
                  {data.documents && data.documents.length > 0 ? (
                    data.documents.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-brand" />
                          <div>
                            <p className="text-xs font-medium text-text-primary">{doc.name}</p>
                            <p className="text-[11px] text-text-muted">{doc.type}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="text-xs">
                          Preview
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No linked documents on file.</p>
                  )}
                </TabsContent>

                <TabsContent value="related" className="mt-3 space-y-1">
                  {data.related && data.related.length > 0 ? (
                    data.related.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0"
                      >
                        <span className="text-text-secondary">{r.label}</span>
                        <span className="text-right font-medium text-text-primary">{r.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No related records found.</p>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-3 space-y-2">
                  {data.actions && data.actions.length > 0 ? (
                    data.actions.map((a, i) => (
                      <Button
                        key={i}
                        variant={a.variant ?? "outline"}
                        className={cn(
                          "w-full justify-center text-xs",
                          a.variant === "default" &&
                            "bg-brand text-brand-foreground hover:bg-brand/90",
                        )}
                      >
                        {a.label}
                      </Button>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">
                      No actions available for this record's current status.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

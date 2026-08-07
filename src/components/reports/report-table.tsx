import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "./types";

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function ReportTable<T>({
  columns,
  rows,
  sort,
  onSortChange,
  onRowClick,
  rowAlert,
  summaryRow,
}: {
  columns: ReportColumn<T>[];
  rows: T[];
  sort: SortState | null;
  onSortChange: (key: string) => void;
  onRowClick: (row: T) => void;
  rowAlert?: (row: T) => boolean;
  summaryRow?: Record<string, React.ReactNode>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  "whitespace-nowrap text-xs",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.sortable && "cursor-pointer select-none hover:text-text-primary",
                )}
                onClick={() => c.sortable && onSortChange(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortable ? (
                    sort?.key === c.key ? (
                      sort.dir === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-40" />
                    )
                  ) : null}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-10 text-center text-sm text-text-muted"
              >
                No results match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => {
              const alert = rowAlert?.(row);
              return (
                <TableRow
                  key={i}
                  onClick={() => onRowClick(row)}
                  className={cn(
                    "cursor-pointer text-sm hover:bg-muted/60",
                    alert && "bg-danger/5 hover:bg-danger/10",
                  )}
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "whitespace-nowrap text-xs",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        alert && c === columns[0] && "font-medium text-danger",
                      )}
                    >
                      {c.render
                        ? c.render(row)
                        : String((row as Record<string, unknown>)[c.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
        {summaryRow ? (
          <tfoot>
            <TableRow className="bg-muted/60 font-medium">
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap text-xs",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {summaryRow[c.key] ?? ""}
                </TableCell>
              ))}
            </TableRow>
          </tfoot>
        ) : null}
      </Table>
    </div>
  );
}

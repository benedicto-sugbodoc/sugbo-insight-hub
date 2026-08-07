import * as React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
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

/** Rows beyond this count get paginated (Phase 8: "paginate at 50 rows"). */
const DEFAULT_PAGE_SIZE = 50;

export function ReportTable<T>({
  columns,
  rows,
  sort,
  onSortChange,
  onRowClick,
  rowAlert,
  summaryRow,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: ReportColumn<T>[];
  rows: T[];
  sort: SortState | null;
  onSortChange: (key: string) => void;
  onRowClick: (row: T) => void;
  rowAlert?: (row: T) => boolean;
  summaryRow?: Record<string, React.ReactNode>;
  pageSize?: number;
}) {
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);

  React.useEffect(() => {
    setPage(0);
  }, [rows.length, pageSize]);

  const pagedRows =
    rows.length > pageSize
      ? rows.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)
      : rows;

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
            pagedRows.map((row, i) => {
              const alert = rowAlert?.(row);
              return (
                <TableRow
                  key={clampedPage * pageSize + i}
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
      {rows.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-text-muted">
          <span>
            Showing {clampedPage * pageSize + 1}
            {"–"}
            {Math.min(rows.length, clampedPage * pageSize + pageSize)} of {rows.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ArrowLeft className="size-3" />
              Prev
            </Button>
            <span className="tabular-nums">
              Page {clampedPage + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2"
              disabled={clampedPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              aria-label="Next page"
            >
              Next
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

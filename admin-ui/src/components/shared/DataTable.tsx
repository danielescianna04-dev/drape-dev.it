import { type ReactNode, useState, useMemo } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  rowClassName?: (item: T) => string;
}

type SortDir = "asc" | "desc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data available",
  loading = false,
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDir]);

  return (
    <div className="overflow-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={`px-4 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium whitespace-nowrap ${
                  col.sortable ? "cursor-pointer select-none hover:text-zinc-300" : ""
                } ${col.className ?? ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-purple-500">
                      {sortDir === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-white/[0.04]">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
                    </td>
                  ))}
                </tr>
              ))
            : sortedData.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-zinc-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
              : sortedData.map((item, idx) => (
                <tr
                  key={idx}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${rowClassName ? rowClassName(item) : ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-white whitespace-nowrap ${col.className ?? ""}`}
                    >
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as ReactNode) ?? "\u2014"}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

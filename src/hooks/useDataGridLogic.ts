import React, { useMemo } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export type DataGridRow = Record<string, string>;

export function useDataGridLogic(input: { data: string[][] }) {
  const { data } = input;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const tableData = useMemo<DataGridRow[]>(() => {
    if (data.length === 0) return [];

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map((row) => {
      const rowObj: DataGridRow = {};
      headers.forEach((_header, idx) => {
        rowObj[`col_${idx}`] = row[idx] || "";
      });
      return rowObj;
    });
  }, [data]);

  const columns = useMemo<ColumnDef<DataGridRow>[]>(() => {
    if (data.length === 0) return [];

    const headers = data[0];
    return headers.map((header, idx) => ({
      accessorKey: `col_${idx}`,
      header: header || `Column ${idx + 1}`,
      cell: (info) => info.getValue(),
    }));
  }, [data]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  return {
    // state
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,

    // computed
    tableData,
    columns,

    // table
    table,
    rows,
    rowVirtualizer,
    tableContainerRef,

    // utilities used by UI
    flexRender,
  };
}

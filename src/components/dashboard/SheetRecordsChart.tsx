"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SheetRecordsChartProps {
  data: Array<{
    sheetName: string;
    records: number;
    successRecords: number;
    errorRecords: number;
  }>;
}

export default function SheetRecordsChart({ data }: SheetRecordsChartProps) {
  // データが空の場合はプレースホルダーを表示
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-neutral-400">
        <div className="text-center">
          <div className="text-sm">データがありません</div>
          <div className="text-xs mt-2">シートデータが作成されると表示されます</div>
        </div>
      </div>
    );
  }

  // シート名を短縮する関数（長すぎる場合）
  const truncateSheetName = (name: string, maxLength: number = 12) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + "...";
  };

  // データを整形（シート名を短縮）
  const chartData = data.map((item) => ({
    ...item,
    name: truncateSheetName(item.sheetName),
    fullName: item.sheetName,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{
          top: 30,
          right: 30,
          left: 20,
          bottom: 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
        <XAxis 
          dataKey="name" 
          className="text-xs"
          tick={{ fill: "currentColor", fontSize: 10 }}
          stroke="currentColor"
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          className="text-xs"
          tick={{ fill: "currentColor" }}
          stroke="currentColor"
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'var(--tooltip-bg, white)',
            border: '1px solid var(--tooltip-border, #ccc)',
            borderRadius: '4px',
          }}
          labelStyle={{ color: 'var(--tooltip-text, black)' }}
          formatter={(value: number | undefined, name: string | undefined) => {
            if (value === undefined || name === undefined) return ['', ''];
            const labels: Record<string, string> = {
              successRecords: '成功',
              errorRecords: 'エラー',
              records: '総数',
            };
            return [value.toLocaleString(), labels[name] || name];
          }}
          labelFormatter={(label: string) => {
            // 元のフルネームを表示
            const item = chartData.find((d) => d.name === label);
            return item?.fullName || label;
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={24}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="successRecords"
          name="成功レコード"
          fill="#10b981"
          stackId="a"
        />
        <Bar
          dataKey="errorRecords"
          name="エラーレコード"
          fill="#ef4444"
          stackId="a"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

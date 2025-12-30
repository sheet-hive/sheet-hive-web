"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataQualityChartProps {
  data: Array<{
    date: string;
    qualityScore: number;
    successRate: number;
  }>;
}

export default function DataQualityChart({ data }: DataQualityChartProps) {
  // データが空の場合はプレースホルダーを表示
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-neutral-400">
        <div className="text-center">
          <div className="text-sm">データがありません</div>
          <div className="text-xs mt-2">変換履歴が作成されると表示されます</div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          stroke="currentColor"
        />
        <YAxis 
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          stroke="currentColor"
          domain={[0, 100]}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'var(--tooltip-bg, white)',
            border: '1px solid var(--tooltip-border, #ccc)',
            borderRadius: '4px',
          }}
          labelStyle={{ color: 'var(--tooltip-text, black)' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="qualityScore"
          name="品質スコア (%)"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="successRate"
          name="成功率 (%)"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

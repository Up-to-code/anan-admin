"use client";

import * as React from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  muted: "hsl(var(--muted))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  blue: "#0B2C4B",
  emerald: "#10b981",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  rose: "#f43f5e",
  cyan: "#06b6d4",
};

const chartColors = [
  COLORS.blue,
  COLORS.emerald,
  COLORS.amber,
  COLORS.violet,
  COLORS.rose,
  COLORS.cyan,
];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-2 shadow-lg">
      {label && <p className="text-xs font-medium mb-1">{label}</p>}
      {payload.map((item, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium">
            {formatter ? formatter(item.value, item.name) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface LineChartProps {
  data: Array<Record<string, any>>;
  index: string;
  categories: string[];
  className?: string;
  height?: number;
  colors?: string[];
  valueFormatter?: (value: number, name: string) => string;
  showGrid?: boolean;
  showTooltip?: boolean;
  curveType?: "linear" | "monotone" | "step";
}

export function LineChart({
  data,
  index,
  categories,
  className,
  height = 300,
  colors = chartColors,
  valueFormatter,
  showGrid = true,
  showTooltip = true,
  curveType = "monotone",
}: LineChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={index}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            dx={-10}
          />
          {showTooltip && (
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          )}
          {categories.map((category, i) => (
            <Line
              key={category}
              type={curveType}
              dataKey={category}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: colors[i % colors.length] }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AreaChartProps {
  data: Array<Record<string, any>>;
  index: string;
  categories: string[];
  className?: string;
  height?: number;
  colors?: string[];
  valueFormatter?: (value: number, name: string) => string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showGradient?: boolean;
  curveType?: "linear" | "monotone" | "step";
}

export function AreaChart({
  data,
  index,
  categories,
  className,
  height = 300,
  colors = chartColors,
  valueFormatter,
  showGrid = true,
  showTooltip = true,
  showGradient = true,
  curveType = "monotone",
}: AreaChartProps) {
  const gradientId = React.useId();

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            {showGradient &&
              categories.map((_, i) => (
                <linearGradient
                  key={`${gradientId}-${i}`}
                  id={`${gradientId}-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={colors[i % colors.length]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={colors[i % colors.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={index}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            dx={-10}
          />
          {showTooltip && (
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          )}
          {categories.map((category, i) => (
            <Area
              key={category}
              type={curveType}
              dataKey={category}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              fill={
                showGradient
                  ? `url(#${gradientId}-${i})`
                  : colors[i % colors.length]
              }
              fillOpacity={showGradient ? 1 : 0.1}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps {
  data: Array<Record<string, any>>;
  index: string;
  categories: string[];
  className?: string;
  height?: number;
  colors?: string[];
  valueFormatter?: (value: number, name: string) => string;
  showGrid?: boolean;
  showTooltip?: boolean;
  layout?: "horizontal" | "vertical";
  radius?: number;
}

export function BarChart({
  data,
  index,
  categories,
  className,
  height = 300,
  colors = chartColors,
  valueFormatter,
  showGrid = true,
  showTooltip = true,
  layout = "horizontal",
  radius = 4,
}: BarChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={layout === "horizontal"}
              horizontal={layout === "vertical"}
            />
          )}
          {layout === "horizontal" ? (
            <>
              <XAxis
                dataKey={index}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                dx={-10}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey={index}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                width={80}
              />
            </>
          )}
          {showTooltip && (
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          )}
          {categories.map((category, i) => (
            <Bar
              key={category}
              dataKey={category}
              fill={colors[i % colors.length]}
              radius={radius}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PieChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  className?: string;
  height?: number;
  colors?: string[];
  valueFormatter?: (value: number, name: string) => string;
  showTooltip?: boolean;
  showLabel?: boolean;
  innerRadius?: number;
}

export function PieChart({
  data,
  className,
  height = 300,
  colors = chartColors,
  valueFormatter,
  showTooltip = true,
  showLabel = true,
  innerRadius = 0,
}: PieChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          {showTooltip && (
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          )}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={height / 3}
            paddingAngle={2}
            dataKey="value"
            label={
              showLabel
                ? ({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                : false
            }
            labelLine={showLabel}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
              />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { COLORS, chartColors };

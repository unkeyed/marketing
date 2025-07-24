"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartConfig = {
  [k: string]: {
    label?: string;
    color?: string;
  };
};

export type ChartMetric = {
  key: string;
  label: string;
  color: string;
  formatter?: (value: number) => string;
};

type RegionData = {
  name: string;
  [provider: string]: string | number;
};

type TooltipPayload = {
  name: string;
  value: number;
  color: string;
  dataKey: string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};

type CustomBarTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};

export type TimeseriesChartLabels = {
  title: string;
  rangeLabel: string;
  metrics: ChartMetric[];
  showRightSide?: boolean;
  reverse?: boolean;
};

export interface TimeseriesLineChartProps {
  data?: any[];
  config?: ChartConfig;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  isLoading?: boolean;
  isError?: boolean;
  enableSelection?: boolean;
  labels?: TimeseriesChartLabels;
  yAxisDomain?: [number, number];
}

const REGION_NAMES: Record<string, string> = {
  bom1: "Mumbai, India",
  fra1: "Frankfurt, Germany",
  iad1: "Washington, DC",
  kix1: "Osaka, Japan",
  lhr1: "London, UK",
  sfo1: "San Francisco, CA",
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  const date = new Date(label || "");
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="rounded-lg shadow-lg border border-gray-200 bg-white dark:bg-gray-800 p-3">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{formattedTime}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-gray-700 dark:text-gray-200">
            {item.name
              ?.replace("unkey-", "Unkey ")
              .replace("upstash-", "Redis ")
              .replace("bom1", "Mumbai, India")
              .replace("fra1", "Frankfurt, Germany")
              .replace("iad1", "Washington, DC")
              .replace("kix1", "Osaka, Japan")
              .replace("lhr1", "London, UK")
              .replace("sfo1", "San Francisco, CA")}
            :
          </span>
          <span className="font-mono text-gray-900 dark:text-gray-100 font-medium">
            {Math.round(item.value as number)}ms
          </span>
        </div>
      ))}
    </div>
  );
};

// Custom Tooltip for Bar Chart
const CustomBarTooltip = ({ active, payload, label }: CustomBarTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg shadow-lg border border-gray-200 bg-white dark:bg-gray-800 p-3">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
        {label ? REGION_NAMES[label] || label : "Unknown"}
      </p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-gray-700 dark:text-gray-200 capitalize">{item.dataKey}:</span>
          <span className="font-mono text-gray-900 dark:text-gray-100 font-medium">
            {Math.round(item.value as number)}ms
          </span>
        </div>
      ))}
    </div>
  );
};

export const BarChart = ({
  data = [],
}: {
  data: {
    category: string;
    x: string;
    y: number;
  }[];
}) => {
  // Return early if no data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500">
        No data to display
      </div>
    );
  }

  // Transform data to group by region
  const transformedData = data.reduce((acc: RegionData[], item) => {
    // Extract region from category (e.g., 'unkey-bom1' -> 'bom1')
    const parts = item.category.split("-");
    const provider = parts[0]; // 'unkey' or 'upstash'
    const region = parts[1]; // 'bom1', 'fra1', etc.

    if (!provider || !region) {
      return acc;
    }

    let existingRegion = acc.find((point) => point.name === region);

    if (!existingRegion) {
      existingRegion = { name: region };
      acc.push(existingRegion);
    }

    // Use the latest value for each provider in this region
    existingRegion[provider] = item.y;

    return acc;
  }, []);

  // Sort regions alphabetically
  transformedData.sort((a, b) => a.name.localeCompare(b.name));

  // Define colors for providers
  const providerColors = {
    unkey: "#000000", // black
    upstash: "#00BD7D", // Upstash Green
  };

  return (
    <div className="w-full" style={{ height: "400px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={transformedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal
            vertical={false}
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          <XAxis
            dataKey="name"
            tickFormatter={(value) => {
              const shortName = REGION_NAMES[value]?.split(",")[0] || value;
              return shortName;
            }}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#666" }}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            tickFormatter={(value) => `${Math.round(value)}ms`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#666" }}
          />

          <Tooltip cursor={{ fill: "rgba(0, 0, 0, 0.05)" }} content={<CustomBarTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            formatter={(value) => (
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{value}</span>
            )}
          />

          <Bar
            dataKey="unkey"
            fill={providerColors.unkey}
            radius={[2, 2, 0, 0]}
            name="Unkey"
            isAnimationActive={false}
          />
          <Bar
            dataKey="upstash"
            fill={providerColors.upstash}
            radius={[2, 2, 0, 0]}
            name="Upstash"
            isAnimationActive={false}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LineChart = ({
  data = [],
  yAxisDomain,
}: {
  data: {
    category: string;
    x: string;
    y: number;
  }[];
  yAxisDomain?: [number, number];
}) => {
  const [isFirstRender, setIsFirstRender] = useState(true);
  const prevDataRef = useRef<any[]>([]);

  useEffect(() => {
    if (isFirstRender && data.length > 0) {
      setIsFirstRender(false);
    }
    prevDataRef.current = data;
  }, [data, isFirstRender]);

  // Return early if no data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500">
        No data to display
      </div>
    );
  }

  // Transform data to work with recharts
  const transformedData = data.reduce((acc: any[], item) => {
    const timeKey = item.x;
    const existingPoint = acc.find((point) => point.time === timeKey);

    if (existingPoint) {
      existingPoint[item.category] = item.y;
    } else {
      acc.push({
        time: timeKey,
        [item.category]: item.y,
      });
    }

    return acc;
  }, []);

  // Sort by time
  transformedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Get unique categories for colors
  const categories = [...new Set(data.map((item) => item.category))];
  const colors: Record<string, string> = {
    "unkey-bom1": "#7a2c65",
    "unkey-fra1": "#3b9e9d",
    "unkey-iad1": "#e27c9d",
    "unkey-kix1": "#8a7141",
    "unkey-lhr1": "#309e25",
    "unkey-sfo1": "#f1d632",

    "upstash-bom1": "#7a2c65",
    "upstash-fra1": "#3b9e9d",
    "upstash-iad1": "#e27c9d",
    "upstash-kix1": "#8a7141",
    "upstash-lhr1": "#309e25",
    "upstash-sfo1": "#f1d632",
  };

  return (
    <div className="w-full" style={{ height: "450px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={transformedData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          <XAxis
            dataKey="time"
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            }}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#666" }}
          />

          <YAxis
            tickFormatter={(value) => `${Math.round(value)}ms`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#666" }}
            domain={yAxisDomain}
          />

          <Tooltip
            cursor={{
              stroke: "#ccc",
              strokeWidth: 1,
              strokeDasharray: "5 5",
              strokeOpacity: 0.7,
            }}
            content={<CustomTooltip />}
          />

          {categories.map((category) => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              stroke={colors[category] || "#6b7280"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={isFirstRender}
              animationDuration={isFirstRender ? 1000 : 0}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

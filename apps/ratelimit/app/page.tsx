"use client";
import * as React from "react";

import { BarChart, LineChart } from "@/components/ratelimit/charts";
import { EmptyPlaceholder } from "@/components/ratelimit/empty-placeholder";
import { Loading } from "@/components/ratelimit/loading";
import { PageHeader } from "@/components/ratelimit/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { parseAsInteger, parseAsStringEnum, useQueryState } from "nuqs";
import { useLocalStorage } from "usehooks-ts";
export const dynamic = "force-dynamic";
export const runtime = "edge";

export type RegionData = {
  latency: number;
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type Data = {
  time: number;
  id: string;
  unkey: Record<string, RegionData>;
  upstash: Record<string, RegionData>;
};

const REGIONS = [
  { code: "bom1", name: " Mumbai, India" },
  { code: "fra1", name: "Frankfurt, Germany" },
  { code: "iad1", name: "Washington, DC" },
  { code: "kix1", name: "Osaka, Japan" },
  { code: "lhr1", name: "London, UK" },
  { code: "sfo1", name: "San Francisco" },
];

const getRegionColor = (category: string): string => {
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
  return colors[category] || "#6b7280";
};

export default function RatelimitPage() {
  const [isTesting, setTesting] = React.useState(false);
  const [isResetting, setResetting] = React.useState(false);
  const [data, setData] = useLocalStorage<Data[]>("unkey-ratelimit-demo-compare", []);
  const [_reset, setReset] = React.useState<number | null>(null);
  React.useEffect(() => {
    const last = data.at(-1);
    if (!last) {
      setReset(null);
      return;
    }
  }, [data]);

  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({
      history: "push",
    }),
  );

  const [duration, setDuration] = useQueryState(
    "duration",
    parseAsStringEnum(["10s", "60s", "5m"]).withDefault("10s").withOptions({
      history: "push",
    }),
  );

  async function test(): Promise<void> {
    setTesting(true);
    const testId = Date.now().toString();

    try {
      const promises = REGIONS.map(async (region) => {
        return fetch(`/${region.code}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            limit,
            duration,
          }),
        }).then((r) => r.json());
      });

      const results = await Promise.all(promises);

      if (results.length > 0) {
        const combinedData: Data = {
          time: Date.now(),
          id: testId,
          unkey: {},
          upstash: {},
        };

        results.forEach((result, index) => {
          if (result) {
            const region = REGIONS[index];
            combinedData.unkey[region.code] = result.unkey;
            combinedData.upstash[region.code] = result.upstash;
          }
        });

        setData([...data, combinedData]);
      }
    } catch (error) {
      console.error("Test failed:", error);
    } finally {
      setTesting(false);
    }
  }
  async function resetLimit(): Promise<void> {
    setResetting(true);
    await fetch("/reset", {
      method: "POST",
    }).finally(() => setResetting(false));
    setData([]);
  }
  const unkeyChartData = React.useMemo(() => {
    return data.filter(Boolean).flatMap((d) => {
      const points: { x: string; y: number; category: string }[] = [];

      // Add Unkey data for each region
      Object.entries(d.unkey || {}).forEach(([region, regionData]) => {
        points.push({
          x: new Date(d.time).toISOString(),
          y: regionData.latency,
          category: `unkey-${region}`,
        });
      });

      return points;
    });
  }, [data]);

  const upstashChartData = React.useMemo(() => {
    return data.filter(Boolean).flatMap((d) => {
      const points: { x: string; y: number; category: string }[] = [];

      // Add Upstash data for each region
      Object.entries(d.upstash || {}).forEach(([region, regionData]) => {
        points.push({
          x: new Date(d.time).toISOString(),
          y: regionData.latency,
          category: `upstash-${region}`,
        });
      });

      return points;
    });
  }, [data]);

  const Chart = React.memo(LineChart);
  const BarChartMemo = React.memo(BarChart);

  // Calculate max latency for synchronized Y-axis
  const maxLatency = React.useMemo(() => {
    const allLatencies = [...unkeyChartData.map((d) => d.y), ...upstashChartData.map((d) => d.y)];
    return allLatencies.length > 0 ? Math.max(...allLatencies) + 50 : 100;
  }, [unkeyChartData, upstashChartData]);

  const yAxisDomain: [number, number] = [0, maxLatency];

  const combinedChartData = React.useMemo(() => {
    return data.filter(Boolean).flatMap((d) => {
      const points: { x: string; y: number; category: string }[] = [];

      // Add Unkey data for each region
      Object.entries(d.unkey || {}).forEach(([region, regionData]) => {
        points.push({
          x: new Date(d.time).toISOString(),
          y: regionData.latency,
          category: `unkey-${region}`,
        });
      });

      // Add Upstash data for each region
      Object.entries(d.upstash || {}).forEach(([region, regionData]) => {
        points.push({
          x: new Date(d.time).toISOString(),
          y: regionData.latency,
          category: `upstash-${region}`,
        });
      });

      return points;
    });
  }, [data]);
  return (
    <div className="container relative pb-16 mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sticky top-0 py-4 bg-background z-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Ratelimit demo"
          description="Measuring latency between the Vercel Edge function, that is closest to you, and the ratelimit service"
          actions={[
            <Link className="cursor-pointer" href="/explainer" key="explainer">
              <Button className="cursor-pointer" variant="outline">
                How it works
              </Button>
            </Link>,
            <a href="https://unkey.com" key="app">
              <Button className="cursor-pointer">Check out Unkey</Button>
            </a>,
            <a href="https://go.unkey.com/so-quick" key="app">
              <Button className="cursor-pointer">Read the code</Button>
            </a>,
          ]}
        />
      </div>

      <main className="flex flex-col gap-4 mt-8 mb-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-center gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div key="limit" className="flex flex-col gap-1">
              <Label>Limit</Label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number.parseInt(e.currentTarget.value))}
                className="w-full"
              />
            </div>
            <div key="duration" className="flex flex-col gap-1">
              <Label>Duration</Label>
              <Select
                value={duration}
                onValueChange={(d) => {
                  setDuration(d as "10s" | "60s" | "5m");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue defaultValue={duration} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10s">10s</SelectItem>
                  <SelectItem value="60s">60s</SelectItem>
                  <SelectItem value="5m">5m</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            className="cursor-pointer"
            key="test"
            onClick={() => test()}
            disabled={isTesting}
          >
            {isTesting ? <Loading /> : "Test"}
          </Button>
          <Button
            type="button"
            key="reset"
            className="cursor-pointer"
            onClick={() => resetLimit()}
            disabled={isResetting}
          >
            {isResetting ? <Loading /> : "Reset"}
          </Button>
        </div>
        <div>
          {data.length > 0 ? (
            <div className="flex flex-col gap-6">
              {/* Bar Chart Comparison */}
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Latency Comparison by Region</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <BarChartMemo data={combinedChartData} />
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Why does latency go to 0 in Washington after being limited?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-justify">
                    Once ratelimited both Unkey and Upstash have 0 latency that is because we
                    enabled ephemeralCache. This is important because Upstash charges per request,
                    regardless if the user is being ratelimited. So this will reduce costs by
                    avoiding round trips.
                  </div>
                  <div className="my-2">
                    Unkey does not charge for ratelimited requests so for the most part this is a
                    pointless feature to enable.
                  </div>
                </CardContent>
              </Card>

              {/* Line Charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Unkey Chart */}
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>Unkey Latency by Region</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Legend for Unkey */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {REGIONS.map((region) => (
                        <div key={`unkey-${region.code}`} className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: getRegionColor(`unkey-${region.code}`),
                            }}
                          />
                          <span>{region.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="h-[400px]">
                      <Chart data={unkeyChartData} yAxisDomain={yAxisDomain} />
                    </div>
                  </CardContent>
                </Card>

                {/* Upstash Chart */}
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>Upstash Latency by Region</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Legend for Upstash */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {REGIONS.map((region) => (
                        <div key={`upstash-${region.code}`} className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: getRegionColor(`upstash-${region.code}`),
                            }}
                          />
                          <span>{region.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="h-[400px]">
                      <Chart data={upstashChartData} yAxisDomain={yAxisDomain} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data cards below charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Unkey Regions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Unkey Regions</h3>
                  {REGIONS.map((region) => {
                    const latestData = data.at(-1);
                    if (!latestData) {
                      return null;
                    }
                    const regionData = latestData.unkey?.[region.code];
                    if (!regionData) {
                      return null;
                    }

                    return (
                      <Card key={`unkey-${region.code}`}>
                        <CardHeader>
                          <CardTitle>{region.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 sm:grid-cols-4 divide-x">
                          <Metric
                            label="Result"
                            value={
                              regionData.success ? (
                                "Pass"
                              ) : (
                                <span className="text-alert">Ratelimited</span>
                              )
                            }
                          />
                          <Metric label="Remaining" value={regionData.remaining} />
                          <Metric label="Limit" value={regionData.limit} />
                          <Metric
                            label="Latency"
                            value={`${Math.round(regionData.latency ?? 0)} ms`}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Upstash Regions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Upstash Regions</h3>
                  {REGIONS.map((region) => {
                    const latestData = data.at(-1);
                    if (!latestData) {
                      return null;
                    }
                    const regionData = latestData.upstash?.[region.code];
                    if (!regionData) {
                      return null;
                    }

                    return (
                      <Card key={`upstash-${region.code}`}>
                        <CardHeader>
                          <CardTitle>{region.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 sm:grid-cols-4 divide-x">
                          <Metric
                            label="Result"
                            value={
                              regionData.success ? (
                                "Pass"
                              ) : (
                                <span className="text-alert">Ratelimited</span>
                              )
                            }
                          />
                          <Metric label="Remaining" value={regionData.remaining} />
                          <Metric label="Limit" value={regionData.limit} />
                          <Metric
                            label="Latency"
                            value={`${Math.round(regionData.latency ?? 0)} ms`}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <EmptyPlaceholder>
              <EmptyPlaceholder.Title>No data</EmptyPlaceholder.Title>
              <EmptyPlaceholder.Description>Run a test first</EmptyPlaceholder.Description>
            </EmptyPlaceholder>
          )}
        </div>
      </main>
    </div>
  );
}

const Metric: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
}> = ({ label, value }) => {
  return (
    <div className="flex flex-col items-start justify-center px-4 py-2">
      <p className="text-sm text-content-subtle">{label}</p>
      <div className="text-2xl font-semibold leading-none tracking-tight">{value}</div>
    </div>
  );
};

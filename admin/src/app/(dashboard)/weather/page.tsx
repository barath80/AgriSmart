import type { Metadata } from "next";

import { Badge, ErrorPanel, formatDate, formatNumber, PageHeader, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { WeatherCacheRow } from "@/lib/types";

export const metadata: Metadata = { title: "Weather cache" };

export default async function WeatherPage() {
  const result = await load(api.get<WeatherCacheRow[]>("/admin/weather/cache"));
  return (
    <>
      <PageHeader title="Weather cache"
                  description="Forecasts are cached per ~1 km grid cell in PostgreSQL, so farmers in the same village share one call to the weather API." />
      {result.data ? (
        <Table head={["Grid cell", "Now", "Rain, last 90 days", "Fetched", "Status"]} empty={!result.data.length}>
          {result.data.map((row) => (
            <tr key={row.key}>
              <Td className="tabular text-xs">{row.key}</Td>
              <Td>{row.current ? `${formatNumber(row.current.temperature_c)}°C · ${row.current.humidity_pct}% · ${row.current.condition}` : "—"}</Td>
              <Td className="tabular">{formatNumber(row.rainfall_last_90_days_mm)} mm</Td>
              <Td className="text-ink-2">{formatDate(row.fetched_at)}</Td>
              <Td><Badge tone={row.fresh ? "good" : "neutral"}>{row.fresh ? "Fresh" : "Expired"}</Badge></Td>
            </tr>
          ))}
        </Table>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}

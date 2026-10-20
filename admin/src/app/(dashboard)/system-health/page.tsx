import type { Metadata } from "next";

import { Badge, Card, ErrorPanel, formatNumber, PageHeader, StatTile, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { SystemHealth } from "@/lib/types";

export const metadata: Metadata = { title: "System health" };

const parseKey = (key: string) => {
  const match = key.match(/^(\w+)\{(.*)\}$/);
  return match ? { metric: match[1]!, label: match[2]! } : { metric: key, label: "" };
};

export default async function SystemHealthPage() {
  const result = await load(api.get<SystemHealth>("/admin/system"));
  if (!result.data) return <ErrorPanel message={result.error} />;
  const h = result.data;
  const counters = h.metrics.counters;

  const routes = Object.entries(h.metrics.latency)
    .map(([key, value]) => ({ ...parseKey(key), ...value }))
    .filter((r) => r.metric === "http_latency")
    .map((r) => ({ ...r, failures: counters[`http_failures{${r.label}}`] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const inference = Object.entries(h.metrics.latency)
    .map(([key, value]) => ({ ...parseKey(key), ...value }))
    .filter((r) => r.metric !== "http_latency");
  const totalRequests = routes.reduce((s, r) => s + r.count, 0);
  const totalFailures = routes.reduce((s, r) => s + r.failures, 0);
  const slowest = routes.reduce((m, r) => Math.max(m, r.avg_ms), 0);

  return (
    <>
      <PageHeader title="System health"
                  description="Live figures from the API instance that served this page. With several instances behind the load balancer, scrape /metrics from each (Prometheus format) for fleet-wide totals." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Database round-trip" value={`${h.database_latency_ms} ms`} tone={h.database_latency_ms > 50 ? "warning" : undefined} />
        <StatTile label="Requests (this instance)" value={formatNumber(totalRequests)} hint={`up ${Math.round(h.metrics.uptime_seconds / 60)} min`} />
        <StatTile label="Server errors (5xx)" value={formatNumber(totalFailures)} tone={totalFailures ? "critical" : undefined} />
        <StatTile label="Slowest route (avg)" value={`${formatNumber(slowest)} ms`} tone={slowest > 2000 ? "warning" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Providers">
          <ul className="space-y-2 text-sm">
            {Object.entries(h.providers).map(([name, value]) => (
              <li key={name} className="flex justify-between capitalize">
                <span className="text-ink-2">{name}</span>
                <Badge tone={value === "not configured" || value === "none" ? "warning" : "good"}>{value}</Badge>
              </li>
            ))}
            {Object.entries(h.voice_capabilities).map(([name, enabled]) => (
              <li key={name} className="flex justify-between">
                <span className="text-ink-2">Voice: {name.toUpperCase()}</span>
                <Badge tone={enabled ? "good" : "warning"}>{enabled ? "available" : "off"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Models">
          <ul className="space-y-2 text-sm">
            {Object.entries(h.models_active).map(([name, version]) => (
              <li key={name} className="flex justify-between">
                <span className="capitalize text-ink-2">{name}</span>
                <span className="flex gap-2">
                  <Badge tone={version ? "good" : "warning"}>{version ?? "none active"}</Badge>
                  {version && h.models_loaded_here[name] !== version ? <Badge>loads on first use</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Inference & provider latency">
          {inference.length ? (
            <ul className="tabular space-y-2 text-sm">
              {inference.map((r) => (
                <li key={`${r.metric}-${r.label}`} className="flex justify-between">
                  <span className="text-ink-2">{r.metric.replaceAll("_", " ")} · {r.label}</span>
                  <span>{formatNumber(r.avg_ms)} ms <span className="text-ink-3">×{r.count}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No model or provider calls yet on this instance.</p>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Route latency (this instance)</h2>
      <Table head={["Route", "Requests", "Avg latency", "5xx"]} empty={!routes.length}>
        {routes.map((r) => (
          <tr key={r.label}>
            <Td className="font-mono text-xs">{r.label}</Td>
            <Td className="tabular">{formatNumber(r.count)}</Td>
            <Td className="tabular">
              {formatNumber(r.avg_ms)} ms {r.avg_ms > 2000 ? <Badge tone="warning">slow</Badge> : null}
            </Td>
            <Td className="tabular">{r.failures ? <Badge tone="critical">{r.failures}</Badge> : 0}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

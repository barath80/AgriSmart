import type { Metadata } from "next";
import Link from "next/link";

import { BarList, LineChart } from "@/components/charts";
import { Badge, Card, ErrorPanel, formatNumber, PageHeader, StatTile } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { Analytics, SystemHealth } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function Dashboard() {
  const [analytics, health] = await Promise.all([
    load(api.get<Analytics>("/admin/analytics")),
    load(api.get<SystemHealth>("/admin/system")),
  ]);
  if (!analytics.data) return <ErrorPanel message={analytics.error} />;
  const a = analytics.data;
  const failRate = a.assistant_requests_7d ? a.failed_assistant_answers_7d / a.assistant_requests_7d : 0;
  const missingModels = health.data ? Object.entries(health.data.models_active).filter(([, v]) => !v).map(([k]) => k) : [];

  return (
    <>
      <PageHeader title="Dashboard" description="How farmers are using AgriSmart over the last 7 days." />

      {missingModels.length ? (
        <div role="status" className="mb-6 rounded-xl border border-line bg-warning-surface p-4 text-sm text-warning">
          <strong>! No active model:</strong> {missingModels.join(", ")}. Those features answer “not available yet”.{" "}
          <Link href="/models" className="underline">Register a model</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Farmers" value={formatNumber(a.total_farmers)} hint={`+${formatNumber(a.new_farmers_7d)} this week`} />
        <StatTile label="Active users (7d)" value={formatNumber(a.active_users_7d)} />
        <StatTile label="AI requests (24h)" value={formatNumber(a.assistant_requests_24h)} hint={`${formatNumber(a.assistant_requests_7d)} in 7 days`} />
        <StatTile label="Voice sessions (7d)" value={formatNumber(a.voice_sessions_7d)} />
        <StatTile label="Disease checks (7d)" value={formatNumber(a.disease_predictions_7d)}
                  hint={a.diagnosis_acceptance_rate !== null ? `${Math.round(a.diagnosis_acceptance_rate * 100)}% confident enough to answer` : undefined} />
        <StatTile label="Crop advice (7d)" value={formatNumber(a.crop_recommendations_7d)} hint={`${formatNumber(a.yield_predictions_7d)} yield estimates`} />
        <StatTile label="Unanswered (7d)" value={formatNumber(a.failed_assistant_answers_7d)}
                  hint={`${(failRate * 100).toFixed(1)}% of AI requests`} tone={failRate > 0.1 ? "warning" : undefined} />
        <StatTile label="Avg AI latency" value={a.avg_assistant_latency_ms !== null ? `${formatNumber(a.avg_assistant_latency_ms)} ms` : "—"}
                  tone={(a.avg_assistant_latency_ms ?? 0) > 3000 ? "warning" : undefined} />
      </div>

      <Card title="Activity, last 14 days" className="mt-6">
        <LineChart
          title="Daily AI requests, disease checks and crop recommendations"
          data={a.daily}
          xLabels={a.daily.map((d) => shortDay(d.date))}
          series={[
            { key: "assistant_requests", label: "AI requests" },
            { key: "diagnoses", label: "Disease checks" },
            { key: "recommendations", label: "Crop advice" },
          ]}
        />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="What farmers ask about (7d)">
          <BarList label="Intents" items={a.intents.map((i) => ({ ...i, label: i.key.replaceAll("_", " ") }))} />
        </Card>
        <Card title="Service status" action={<Link href="/system-health" className="text-xs text-info hover:underline">Details</Link>}>
          {health.data ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-ink-2">Database</span><Badge tone="good">{health.data.database_latency_ms} ms</Badge></li>
              {Object.entries(health.data.providers).map(([name, value]) => (
                <li key={name} className="flex justify-between">
                  <span className="capitalize text-ink-2">{name}</span>
                  <Badge tone={value === "not configured" || value === "none" ? "warning" : "good"}>{value}</Badge>
                </li>
              ))}
              <li className="flex justify-between"><span className="text-ink-2">Pending notifications</span><span className="tabular">{health.data.pending_notifications}</span></li>
            </ul>
          ) : (
            <ErrorPanel message={health.error} />
          )}
        </Card>
      </div>
    </>
  );
}

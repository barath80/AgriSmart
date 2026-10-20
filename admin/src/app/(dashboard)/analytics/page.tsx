import type { Metadata } from "next";

import { BarList } from "@/components/charts";
import { Card, ErrorPanel, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { languageName } from "@/lib/languages";
import { load } from "@/lib/load";
import type { Analytics, CountByKey } from "@/lib/types";

export const metadata: Metadata = { title: "Analytics" };

const withLabels = (items: CountByKey[], format: (key: string) => string) =>
  items.map((item) => ({ ...item, label: format(item.key) }));

const HANDLED_BY: Record<string, string> = {
  tool: "Answered by a service/model", template: "Greeting or help", llm: "Open conversation (LLM)",
  fallback: "Could not answer",
};

export default async function AnalyticsPage() {
  const result = await load(api.get<Analytics>("/admin/analytics"));
  if (!result.data) return <ErrorPanel message={result.error} />;
  const a = result.data;
  return (
    <>
      <PageHeader title="Analytics" description="Who uses AgriSmart, in which language and channel, and how questions get answered." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Farmers by language"><BarList label="Languages" items={withLabels(a.languages, languageName)} /></Card>
        <Card title="Farmers by channel"><BarList label="Channels" items={withLabels(a.channels, (k) => (k === "phone" ? "Button phone (voice call)" : "Smartphone app"))} /></Card>
        <Card title="Farmers by state"><BarList label="States" items={a.states} /></Card>
        <Card title="How questions were answered (7d)">
          <BarList label="Handled by" items={withLabels(a.handled_by, (k) => HANDLED_BY[k] ?? k)} />
          <p className="mt-3 text-xs text-ink-3">The LLM only handles open conversation; prices, weather, eligibility and predictions always come from services and models.</p>
        </Card>
        <Card title="Questions by topic (7d)"><BarList label="Intents" items={withLabels(a.intents, (k) => k.replaceAll("_", " "))} /></Card>
        <Card title="Notification deliveries"><BarList label="Deliveries" items={a.notification_deliveries} /></Card>
      </div>
    </>
  );
}
